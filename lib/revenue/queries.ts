import "server-only";
import { db } from "@/lib/db";
import { BEHAVIOURAL_SIGNALS, SIGNAL_LABELS, type SignalType } from "@/lib/intent/config";
import {
  DAILY_PRIORITY_COUNT,
  LEAK_RULES,
  OPEN_STAGES,
  isOpenStage,
  type LeakType,
  type Urgency,
} from "@/lib/revenue/config";
import { detectLeaks, revenueAtRisk, type DetectedLeak } from "@/lib/revenue/leaks";
import { expectedRevenue } from "@/lib/revenue/money";
import { decideNextAction, type NextAction } from "@/lib/revenue/next-action";
import { signalImportance } from "@/lib/intent/signals";

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
  /** Expected revenue exposed by the primary leak — 0 when nothing is leaking. */
  atRisk: number;
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

  const [signals, emails] = await Promise.all([
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
    db.email.findMany({
      where: { orgId, prospect: { accountId: { in: accountIds } } },
      select: {
        sentAt: true,
        openedAt: true,
        repliedAt: true,
        prospect: { select: { accountId: true } },
      },
    }),
  ]);

  const signalsByAccount = new Map<string, typeof signals>();
  for (const s of signals) {
    const list = signalsByAccount.get(s.accountId) ?? [];
    list.push(s);
    signalsByAccount.set(s.accountId, list);
  }

  const emailsByAccount = new Map<string, typeof emails>();
  for (const e of emails) {
    const id = e.prospect.accountId;
    if (!id) continue;
    const list = emailsByAccount.get(id) ?? [];
    list.push(e);
    emailsByAccount.set(id, list);
  }

  return opportunities.map((opp) => {
    const accSignals = signalsByAccount.get(opp.accountId) ?? [];
    const accEmails = emailsByAccount.get(opp.accountId) ?? [];

    const latest = (dates: (Date | null)[]) =>
      dates.filter((d): d is Date => d != null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const lastOutboundAt = latest(accEmails.map((e) => e.sentAt));
    const lastRepliedAt = latest(accEmails.map((e) => e.repliedAt));
    const signalAt = (t: SignalType) =>
      latest(accSignals.filter((s) => s.signalType === t).map((s) => s.occurredAt));

    const value = expectedRevenue(opp.dealValue, opp.winProbability);

    // Interaction kinds that represent *us* acting, as opposed to the
    // prospect opening or replying to something.
    const ourAction =
      opp.lastInteractionKind != null &&
      ["email_sent", "call", "meeting", "proposal_sent", "note"].includes(
        opp.lastInteractionKind
      );
    const lastTouchAt = latest([
      lastOutboundAt,
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
        lastOutboundAt,
        lastTouchAt,
        neverReplied: lastRepliedAt == null,
        signals: accSignals,
      },
      now
    );

    const quietDays = daysSince(opp.lastInteractionAt, now);

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
      theyRepliedLast: Boolean(lastRepliedAt && (!lastOutboundAt || lastRepliedAt > lastOutboundAt)),
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
      lastInteractionAt: opp.lastInteractionAt,
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

// ── Revenue Leak Feed (§4) ────────────────────────────────────────────────

/** Opportunities with an active leak, most money at risk first. */
export async function getLeakFeed(orgId: string, take = 25): Promise<EnrichedOpportunity[]> {
  const opps = await loadEnrichedOpportunities(orgId);
  return opps
    .filter((o) => o.primaryLeak !== null)
    .sort((a, b) => b.atRisk - a.atRisk)
    .slice(0, take);
}

// ── Today's Revenue Opportunities (§6) ────────────────────────────────────

/**
 * The morning list. Ranked by urgency first, then expected value — a
 * $9k deal that dies today outranks a $40k deal that can wait a week.
 */
export async function getTodaysPriorities(
  orgId: string,
  take = DAILY_PRIORITY_COUNT
): Promise<EnrichedOpportunity[]> {
  const opps = await loadEnrichedOpportunities(orgId, { stages: [...OPEN_STAGES] });
  return opps
    .filter((o) => o.nextAction.actionType !== "wait")
    .sort((a, b) => priorityWeight(b) - priorityWeight(a))
    .slice(0, take);
}

/**
 * Blends urgency into expected value rather than bucketing by it.
 *
 * Strict urgency-first ordering ranked a $765 deal above a $13,440 one
 * purely because one was flagged "today" and the other "this week" — which
 * inverts the whole premise that attention should follow expected revenue
 * (§17). Urgency now tilts the ranking instead of overriding it.
 */
function priorityWeight(o: EnrichedOpportunity): number {
  const multiplier: Record<Urgency, number> = {
    now: 1.6,
    today: 1.25,
    this_week: 1,
    monitor: 0.4,
  };
  return o.expectedValue * multiplier[o.nextAction.urgency as Urgency];
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
  revenueRecovered: number;
  pipelineInfluenced: number;
  opportunitiesSaved: number;
  meetingsGenerated: number;
  dealsWon: number;
  wonValue: number;
  recommendationsActedOn: number;
  recommendationsShown: number;
  followUpCoverage: number; // percent of leaking deals that have been actioned
  avgResponseDays: number | null;
  monthLabel: string;
  hasData: boolean;
}

export async function getImpactSummary(orgId: string): Promise<ImpactSummary> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [attributions, recs, wonOpps, respondedOpps] = await Promise.all([
    db.revenueAttribution.findMany({
      where: { orgId, occurredAt: { gte: monthStart } },
      select: { kind: true, amount: true },
    }),
    db.recommendation.findMany({
      where: { orgId, createdAt: { gte: monthStart } },
      select: { status: true, completedAt: true, createdAt: true },
    }),
    db.opportunity.findMany({
      where: { orgId, stage: "WON", closedAt: { gte: monthStart } },
      select: { dealValue: true },
    }),
    db.opportunity.findMany({
      where: { orgId, stage: { in: [...OPEN_STAGES] } },
      select: { lastInteractionAt: true },
    }),
  ]);

  const sumOf = (kinds: string[]) =>
    attributions.filter((a) => kinds.includes(a.kind)).reduce((s, a) => s + a.amount, 0);

  const actedOn = recs.filter((r) => r.status === "COMPLETED");
  const responseDays = actedOn
    .filter((r) => r.completedAt)
    .map((r) => (r.completedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));

  return {
    revenueRecovered: sumOf(["recovered", "saved"]),
    pipelineInfluenced: sumOf(["influenced", "saved", "recovered", "meeting"]),
    opportunitiesSaved: attributions.filter((a) => a.kind === "saved").length,
    meetingsGenerated: attributions.filter((a) => a.kind === "meeting").length,
    dealsWon: wonOpps.length,
    wonValue: wonOpps.reduce((s, o) => s + o.dealValue, 0),
    recommendationsActedOn: actedOn.length,
    recommendationsShown: recs.length,
    followUpCoverage: recs.length
      ? Math.round((actedOn.length / recs.length) * 100)
      : 0,
    avgResponseDays: responseDays.length
      ? Math.round((responseDays.reduce((a, b) => a + b, 0) / responseDays.length) * 10) / 10
      : null,
    monthLabel: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    hasData: attributions.length > 0 || recs.length > 0 || respondedOpps.length > 0,
  };
}
