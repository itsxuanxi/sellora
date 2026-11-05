import "server-only";
import { db } from "@/lib/db";
import { BEHAVIOURAL_SIGNALS, SIGNAL_LABELS, type SignalType } from "@/lib/intent/config";
import {
  LEAK_RULES,
  OPEN_STAGES,
  isOpenStage,
  type LeakType,
} from "@/lib/revenue/config";
import { detectLeaks, revenueAtRisk, type DetectedLeak } from "@/lib/revenue/leaks";
import { expectedRevenue } from "@/lib/revenue/money";
import { decideNextAction, type NextAction } from "@/lib/revenue/next-action";
import { signalImportance } from "@/lib/intent/signals";
import { loadFactsForOpportunities } from "@/lib/revenue/facts-load";
import { describeReplyState, emptyFacts, type OpportunityFacts } from "@/lib/revenue/facts";

/**
 * Read models for the Revenue Intelligence screens.
 *
 * Everything ranks by expected revenue (deal value × win probability), never
 * by recency — that ordering *is* the product thesis: attention is scarce,
 * so it should flow to where it earns the most.
 *
 * Leaks and next actions are computed here rather than read from a table
 * (see the note in lib/revenue/leaks.ts), so every page is always current.
 * The batch loader below exists to make that affordable: signals and emails
 * are fetched once per workspace and grouped in memory rather than
 * re-queried per opportunity.
 */

export interface EnrichedOpportunity {
  id: string;
  name: string;
  stage: string;
  dealValue: number;
  currency: string;
  dealValueBasis: string;
  winProbability: number;
  expectedValue: number;
  score: number | null;
  scoreBand: string | null;
  confidence: string | null;
  whyNow: string[];
  lastInteractionAt: Date | null;
  lastInteractionKind: string | null;
  nextStepDueAt: Date | null;
  daysSinceContact: number | null;
  account: { id: string; name: string; industry: string | null; domain: string | null };
  contact: { id: string; name: string; position: string | null; email: string } | null;
  signals: {
    id: string;
    signalType: string;
    title: string;
    occurredAt: Date;
    label: string;
    /** 0-100, how much this signal type should move a deal. */
    importanceScore: number;
  }[];
  leaks: DetectedLeak[];
  primaryLeak: DetectedLeak | null;
  nextAction: NextAction;
  /**
   * Estimated share of this deal's estimated expected revenue that the
   * primary leak puts at risk — 0 when nothing is leaking.
   *
   * An estimate twice over: `expectedValue` is already deal value × an
   * uncalibrated stage baseline, and the exposure fraction is a judgement.
   * Never realized or attributable revenue. See `revenueAtRisk`.
   */
  atRisk: number;
  /** The shared reply/activity facts every screen reads. */
  facts: OpportunityFacts;
  /** The one sentence allowed to describe the buyer's silence. */
  replySummary: string;
}

function daysSince(d: Date | null, now: Date): number | null {
  if (!d) return null;
  return Math.floor(Math.max(0, (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Loads opportunities and enriches each with its leaks and next action.
 * One query per entity type regardless of how many opportunities there are.
 */
export async function loadEnrichedOpportunities(
  orgId: string,
  opts: { stages?: string[]; take?: number } = {}
): Promise<EnrichedOpportunity[]> {
  const now = new Date();

  const opportunities = await db.opportunity.findMany({
    where: { orgId, ...(opts.stages ? { stage: { in: opts.stages } } : {}) },
    include: {
      account: { select: { id: true, name: true, industry: true, domain: true } },
      primaryContact: { select: { id: true, name: true, position: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
    ...(opts.take ? { take: opts.take } : {}),
  });
  if (opportunities.length === 0) return [];

  const accountIds = [...new Set(opportunities.map((o) => o.accountId))];

  // Reply and activity facts come from one shared derivation (see
  // lib/revenue/facts.ts). This file used to compute its own, from Email
  // plus the event log but not the Response table, while the deal detail
  // page computed a third from Email alone — which is how one page could
  // show a reply in the timeline and "never replied" in the leak panel.
  const [factsByOpportunity, signals] = await Promise.all([
    loadFactsForOpportunities(orgId, opportunities),
    db.buyingSignal.findMany({
      where: { orgId, accountId: { in: accountIds }, expired: false },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        accountId: true,
        signalType: true,
        title: true,
        occurredAt: true,
        importanceScore: true,
      },
    }),
  ]);

  const signalsByAccount = new Map<string, typeof signals>();
  for (const s of signals) {
    const list = signalsByAccount.get(s.accountId) ?? [];
    list.push(s);
    signalsByAccount.set(s.accountId, list);
  }

  return opportunities.map((opp) => {
    const accSignals = signalsByAccount.get(opp.accountId) ?? [];
    const facts = factsByOpportunity.get(opp.id) ?? emptyFacts(opp.id);

    const latest = (dates: (Date | null)[]) =>
      dates.filter((d): d is Date => d != null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const signalAt = (t: SignalType) =>
      latest(accSignals.filter((s) => s.signalType === t).map((s) => s.occurredAt));

    const value = expectedRevenue(opp.dealValue, opp.winProbability);

    // "Us acting" is narrower than "something happened": a prospect opening
    // an email is not a follow-up, so a rule asking "has anyone actioned
    // this?" must not be satisfied by it. The cached column is consulted as
    // a fallback because a manually logged touch lands there and nowhere the
    // facts module can see.
    const ourAction =
      opp.lastInteractionKind != null &&
      ["email_sent", "call", "meeting", "proposal_sent", "note"].includes(
        opp.lastInteractionKind
      );
    const lastTouchAt = latest([
      facts.lastOutboundAt,
      ourAction ? opp.lastInteractionAt : null,
    ]);

    const leaks = detectLeaks(
      {
        stage: opp.stage,
        score: opp.score ?? 0,
        dealValue: opp.dealValue,
        winProbability: opp.winProbability,
        lastInteractionAt: opp.lastInteractionAt,
        lastInteractionKind: opp.lastInteractionKind,
        nextStepDueAt: opp.nextStepDueAt,
        closedAt: opp.closedAt,
        lastMeetingAt: signalAt("meeting_attended"),
        proposalOpenedAt: signalAt("proposal_opened"),
        lastOutboundAt: facts.lastOutboundAt,
        lastTouchAt,
        replyState: facts.replyState,
        daysSinceReply: facts.daysSinceReply,
        outboundSinceLastReply: facts.outboundSinceLastReply,
        signals: accSignals,
      },
      now
    );

    // Read from the shared facts rather than the cached column: the column
    // is only as fresh as the last rescore, and a list that disagrees with
    // the detail page about "days since contact" is the same class of bug as
    // the reply inconsistency this refactor removes.
    const quietDays = facts.daysSinceAnyActivity ?? daysSince(opp.lastInteractionAt, now);

    const nextAction = decideNextAction({
      stage: opp.stage,
      score: opp.score ?? 0,
      dealValue: opp.dealValue,
      winProbability: opp.winProbability,
      contactName: opp.primaryContact?.name ?? null,
      accountName: opp.account.name,
      leaks,
      quietDays,
      hasProposal: signalAt("proposal_opened") != null || opp.stage === "PROPOSAL" || opp.stage === "NEGOTIATION",
      hasMeeting: signalAt("meeting_attended") != null,
      theyRepliedLast: facts.replyState === "they_replied_last",
    });

    const primaryLeak = leaks[0] ?? null;

    return {
      id: opp.id,
      name: opp.name,
      stage: opp.stage,
      dealValue: opp.dealValue,
      currency: opp.currency,
      dealValueBasis: opp.dealValueBasis,
      winProbability: opp.winProbability,
      expectedValue: value,
      score: opp.score,
      scoreBand: opp.scoreBand,
      confidence: opp.confidence,
      whyNow: opp.whyNow ? opp.whyNow.split("\n").filter(Boolean) : [],
      lastInteractionAt: facts.lastActivityAt ?? opp.lastInteractionAt,
      lastInteractionKind: opp.lastInteractionKind,
      nextStepDueAt: opp.nextStepDueAt,
      daysSinceContact: quietDays,
      account: opp.account,
      contact: opp.primaryContact,
      signals: accSignals.slice(0, 6).map((s) => ({
        id: s.id,
        signalType: s.signalType,
        title: s.title,
        occurredAt: s.occurredAt,
        label: SIGNAL_LABELS[s.signalType as SignalType] ?? s.signalType,
        importanceScore: s.importanceScore ?? signalImportance(s.signalType),
      })),
      leaks,
      primaryLeak,
      nextAction,
      atRisk: primaryLeak
        ? revenueAtRisk(
            opp.dealValue,
            opp.winProbability,
            primaryLeak.severity,
            primaryLeak.type
          )
        : 0,
      facts,
      replySummary: describeReplyState(facts),
    };
  });
}

// ── Overview (§3) ─────────────────────────────────────────────────────────

export interface RevenueOverview {
  revenueAtRisk: number;
  opportunitiesAtRisk: number;
  revenueRecoveredThisMonth: number;
  highIntentCount: number;
  dealsAtRiskCount: number;
  followUpsOverdue: number;
  pipelineInfluenced: number;
  totalOpenPipeline: number;
  openCount: number;
  currency: string;
  hasData: boolean;
}

export async function getRevenueOverview(orgId: string): Promise<RevenueOverview> {
  const opps = await loadEnrichedOpportunities(orgId);
  const open = opps.filter((o) => isOpenStage(o.stage));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [recovered, influenced] = await Promise.all([
    db.revenueAttribution.aggregate({
      where: { orgId, kind: { in: ["recovered", "saved"] }, occurredAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.revenueAttribution.aggregate({
      where: { orgId, kind: { in: ["influenced", "saved", "recovered", "meeting"] } },
      _sum: { amount: true },
    }),
  ]);

  const leaking = open.filter((o) => o.primaryLeak);

  return {
    revenueAtRisk: leaking.reduce((sum, o) => sum + o.atRisk, 0),
    opportunitiesAtRisk: leaking.length,
    revenueRecoveredThisMonth: recovered._sum.amount ?? 0,
    highIntentCount: open.filter((o) => (o.score ?? 0) >= 70).length,
    dealsAtRiskCount: leaking.filter((o) => o.primaryLeak!.severity !== "watch").length,
    followUpsOverdue: open.filter((o) =>
      o.leaks.some((l) => l.type === "needs_follow_up" || l.type === "proposal_viewed_no_followup")
    ).length,
    pipelineInfluenced: influenced._sum.amount ?? 0,
    totalOpenPipeline: open.reduce((sum, o) => sum + o.dealValue, 0),
    openCount: open.length,
    currency: opps[0]?.currency ?? "USD",
    hasData: opps.length > 0,
  };
}

// ── Recovery queue (§8) ───────────────────────────────────────────────────

export interface RecoveryCategory {
  type: LeakType;
  title: string;
  detects: string;
  severity: string;
  opportunities: EnrichedOpportunity[];
  totalRecoverable: number;
}

export async function getRecoveryQueue(orgId: string): Promise<{
  categories: RecoveryCategory[];
  totalRecoverable: number;
  count: number;
}> {
  const opps = await loadEnrichedOpportunities(orgId);

  const categories: RecoveryCategory[] = LEAK_RULES.map((rule) => {
    // An opportunity appears under its *primary* leak only, so the same deal
    // is never counted twice in the recoverable total.
    const matching = opps
      .filter((o) => o.primaryLeak?.type === rule.type)
      .sort((a, b) => b.atRisk - a.atRisk);
    return {
      type: rule.type,
      title: rule.category,
      detects: rule.detects,
      severity: rule.severity,
      opportunities: matching,
      totalRecoverable: matching.reduce((sum, o) => sum + o.atRisk, 0),
    };
  }).filter((c) => c.opportunities.length > 0);

  return {
    categories,
    totalRecoverable: categories.reduce((sum, c) => sum + c.totalRecoverable, 0),
    count: categories.reduce((sum, c) => sum + c.opportunities.length, 0),
  };
}

// ── Signals (§9) ──────────────────────────────────────────────────────────

export async function getSignalFeed(orgId: string, take = 60) {
  const signals = await db.buyingSignal.findMany({
    where: { orgId, expired: false },
    orderBy: { occurredAt: "desc" },
    take,
    include: {
      account: {
        select: {
          id: true,
          name: true,
          opportunities: {
            select: { id: true, dealValue: true, winProbability: true, stage: true },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      },
      source: { select: { kind: true, name: true } },
    },
  });

  return signals.map((s) => ({
    id: s.id,
    accountId: s.account.id,
    accountName: s.account.name,
    signalType: s.signalType,
    label: SIGNAL_LABELS[s.signalType as SignalType] ?? s.signalType,
    family: (BEHAVIOURAL_SIGNALS as string[]).includes(s.signalType)
      ? ("behavioural" as const)
      : ("firmographic" as const),
    title: s.title,
    description: s.description,
    evidence: s.evidence,
    occurredAt: s.occurredAt,
    confidence: s.confidence,
    sourceKind: s.source?.kind ?? null,
    sourceName: s.source?.name ?? null,
    opportunityId: s.account.opportunities[0]?.id ?? null,
    expectedValue: s.account.opportunities[0]
      ? expectedRevenue(
          s.account.opportunities[0].dealValue,
          s.account.opportunities[0].winProbability
        )
      : null,
  }));
}

// ── Impact / attribution (§12) ────────────────────────────────────────────

export interface ImpactSummary {
  // ── Realized money. The only figures here that are not estimates. ──
  /** Deal value of everything that closed won this month. */
  closedWonValue: number;
  dealsWon: number;
  /** Of those, the ones Selryn had flagged. Overlap, never credit. */
  closedWonValueFlagged: number;
  dealsWonFlagged: number;

  // ── Pipeline, in CRM deal value. Not revenue, and not an estimate. ──
  /** Deal value of the open deals Selryn flagged and someone then worked. */
  openPipelineWorked: number;
  dealsWorked: number;

  // ── Events. Counted as events, never converted to money. ──
  meetingsBooked: number;
  recommendationsActedOn: number;
  recommendationsShown: number;
  followUpCoverage: number; // percent of recommendations that have been actioned
  avgResponseDays: number | null;

  monthLabel: string;
  hasData: boolean;
}

/**
 * What Selryn can honestly say it did this month.
 *
 * Rewritten because the previous version manufactured revenue. It summed
 * `RevenueAttribution.amount` into a field called `revenueRecovered` and the
 * Impact page printed it as money — but those rows are written the moment
 * someone marks a recommendation complete, with the amount set to deal value
 * × an uncalibrated win probability. Clicking "done" produced revenue.
 *
 * Two further faults in that sum, both silent:
 *
 *  - It added one row per completed recommendation, so three completed
 *    recommendations on one deal reported that deal's value three times.
 *    Sums over per-row estimates double-count by construction; the figures
 *    below group by opportunity instead.
 *
 *  - A won deal with any prior attribution contributed its entire value as
 *    "recovered", asserting that Selryn caused the whole win on the strength
 *    of having once suggested a follow-up.
 *
 * So: realized money comes only from deals that actually closed won, in CRM
 * deal value. Pipeline is reported as pipeline. Everything else is a count of
 * things that happened. `ATTRIBUTION_CAVEAT` travels with the overlap figures.
 */
export async function getImpactSummary(orgId: string): Promise<ImpactSummary> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [attributions, recs, wonOpps, openWorked] = await Promise.all([
    // Every attribution ever, not just this month: a deal flagged in March
    // and won in April was still flagged by Selryn.
    db.revenueAttribution.findMany({
      where: { orgId },
      select: { kind: true, opportunityId: true },
    }),
    db.recommendation.findMany({
      where: { orgId, createdAt: { gte: monthStart } },
      select: { status: true, completedAt: true, createdAt: true },
    }),
    db.opportunity.findMany({
      where: { orgId, stage: "WON", closedAt: { gte: monthStart } },
      select: { id: true, dealValue: true },
    }),
    db.opportunity.findMany({
      where: { orgId, stage: { in: [...OPEN_STAGES] } },
      select: { id: true, dealValue: true },
    }),
  ]);

  // Grouped by opportunity, so a deal counts once however many times it was
  // worked.
  const flagged = new Set(attributions.map((a) => a.opportunityId));

  const wonFlagged = wonOpps.filter((o) => flagged.has(o.id));
  const workedOpen = openWorked.filter((o) => flagged.has(o.id));

  const actedOn = recs.filter((r) => r.status === "COMPLETED");
  const responseDays = actedOn
    .filter((r) => r.completedAt)
    .map((r) => (r.completedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));

  return {
    closedWonValue: wonOpps.reduce((s, o) => s + o.dealValue, 0),
    dealsWon: wonOpps.length,
    closedWonValueFlagged: wonFlagged.reduce((s, o) => s + o.dealValue, 0),
    dealsWonFlagged: wonFlagged.length,

    openPipelineWorked: workedOpen.reduce((s, o) => s + o.dealValue, 0),
    dealsWorked: workedOpen.length,

    // Distinct opportunities, not rows: booking two meetings on one deal is
    // two meetings, but the same meeting recorded twice is not.
    meetingsBooked: new Set(
      attributions.filter((a) => a.kind === "meeting").map((a) => a.opportunityId)
    ).size,
    recommendationsActedOn: actedOn.length,
    recommendationsShown: recs.length,
    followUpCoverage: recs.length
      ? Math.round((actedOn.length / recs.length) * 100)
      : 0,
    avgResponseDays: responseDays.length
      ? Math.round((responseDays.reduce((a, b) => a + b, 0) / responseDays.length) * 10) / 10
      : null,

    monthLabel: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    hasData: attributions.length > 0 || recs.length > 0 || wonOpps.length > 0,
  };
}
