import "server-only";
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/auth";
import { BEHAVIOURAL_SIGNALS, type SignalType } from "@/lib/intent/config";
import type { Confidence } from "@/lib/intent/scoring";
import { isOpenStage, type OpportunityStage } from "@/lib/revenue/config";
import { estimateDealValue, expectedRevenue } from "@/lib/revenue/money";
import {
  computeOpportunityScore,
  type OpportunityScoreInput,
  type OpportunityScoreResult,
} from "@/lib/revenue/opportunity-score";
import { loadFactsForOpportunity } from "@/lib/revenue/facts-load";
import type { OpportunityFacts } from "@/lib/revenue/facts";

/**
 * Server-side scoring pipeline: gathers the evidence an opportunity's score
 * depends on, runs the pure scorer, and persists an auditable snapshot.
 *
 * All behavioural evidence (pricing-page visits, proposal opens, meetings)
 * arrives as BuyingSignal rows rather than bespoke columns. That is what
 * makes §14's integrations tractable: a Gmail or HubSpot connector only ever
 * has to write signals, and every downstream score, leak and recommendation
 * updates itself.
 */

const SITE_VISIT_SIGNALS: SignalType[] = [
  "pricing_page_viewed",
  "demo_page_viewed",
  "repeat_site_visit",
];

export interface OpportunityEvidence {
  signals: { id: string; signalType: string; occurredAt: Date; confidence: Confidence; expired: boolean; title: string }[];
  engagement: OpportunityScoreInput["engagement"];
  lastInteractionAt: Date | null;
  lastInteractionKind: string | null;
  theyRepliedLast: boolean;
  lastOutboundAt: Date | null;
  lastMeetingAt: Date | null;
  proposalOpenedAt: Date | null;
  /**
   * The shared reply/activity facts this evidence was read from. Carried
   * through rather than flattened to a boolean so callers downstream — the
   * leak rules, the recommendation writer — reach the same three-state
   * answer instead of re-deriving their own.
   */
  facts: OpportunityFacts;
}

/** Splits a comma-separated ICP field into a normalized set. */
function listSet(v: string | null | undefined): Set<string> {
  return new Set(
    (v ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function matchesAny(value: string | null | undefined, set: Set<string>): boolean {
  if (!value || set.size === 0) return false;
  const v = value.toLowerCase();
  for (const entry of set) {
    if (v.includes(entry) || entry.includes(v)) return true;
  }
  return false;
}

/**
 * Collects every piece of evidence bearing on one opportunity. Reads are
 * scoped to the account, because engagement with any contact at a company is
 * evidence about the deal with that company.
 */
export async function gatherEvidence(
  orgId: string,
  accountId: string,
  opportunityId: string
): Promise<OpportunityEvidence> {
  const [signals, facts] = await Promise.all([
    db.buyingSignal.findMany({
      where: { orgId, accountId, expired: false },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        signalType: true,
        occurredAt: true,
        confidence: true,
        expired: true,
        title: true,
      },
    }),
    loadFactsForOpportunity(orgId, opportunityId),
  ]);

  const signalAt = (types: SignalType[]): Date | null => {
    const dates = signals
      .filter((s) => (types as string[]).includes(s.signalType))
      .map((s) => s.occurredAt)
      .sort((a, b) => b.getTime() - a.getTime());
    return dates[0] ?? null;
  };

  const proposalOpenedAt = signalAt(["proposal_opened"]);
  const siteVisits = signals.filter((s) =>
    (SITE_VISIT_SIGNALS as string[]).includes(s.signalType)
  ).length;

  return {
    signals: signals.map((s) => ({
      ...s,
      confidence: s.confidence as Confidence,
    })),
    engagement: {
      emailsOpened: facts.emailsOpened,
      emailsReplied: facts.emailsReplied,
      meetingsHeld: facts.meetingsHeld,
      proposalsSent: proposalOpenedAt || facts.proposalViews > 0 ? 1 : 0,
      siteVisits,
      // Messages sent with no answer after them. When they have never
      // replied this is every message sent; the facts module already
      // resolves that distinction, so it is not re-derived here.
      unansweredOutbound: facts.outboundSinceLastReply,
    },
    lastInteractionAt: facts.lastActivityAt,
    lastInteractionKind: interactionKind(facts),
    theyRepliedLast: facts.replyState === "they_replied_last",
    lastOutboundAt: facts.lastOutboundAt,
    lastMeetingAt: facts.lastBuyerActivityKind === "meeting" ? facts.lastBuyerActivityAt : signalAt(["meeting_attended"]),
    proposalOpenedAt,
    facts,
  };
}

/** The legacy `lastInteractionKind` vocabulary, from the shared facts. */
function interactionKind(facts: OpportunityFacts): string | null {
  switch (facts.lastActivityKind) {
    case "reply":
      return "email_replied";
    case "meeting":
      return "meeting";
    case "email_open":
      return "email_opened";
    case "proposal_view":
      return "proposal_sent";
    case "site_visit":
    case "other_signal":
      return "signal";
    case "outbound":
      return "email_sent";
    default:
      return null;
  }
}

/**
 * Recomputes one opportunity's score, writes a new (never-overwritten)
 * snapshot with its factor breakdown, and refreshes the denormalized cache
 * columns the list views sort by.
 */
export async function rescoreOpportunity(
  orgId: string,
  opportunityId: string
): Promise<OpportunityScoreResult | null> {
  const opp = await db.opportunity.findFirst({
    where: { id: opportunityId, orgId },
    include: {
      account: true,
      primaryContact: true,
    },
  });
  if (!opp) return null;

  const [icp, evidence] = await Promise.all([
    db.icpProfile.findUnique({ where: { orgId } }),
    gatherEvidence(orgId, opp.accountId, opp.id),
  ]);

  const industries = listSet(icp?.industries);
  const sizes = listSet(icp?.companySizes);
  const regions = listSet(icp?.regions);
  const titles = listSet(icp?.buyerTitles);
  const icpUnknown = !icp?.completed && industries.size === 0 && sizes.size === 0;

  const result = computeOpportunityScore({
    stage: opp.stage,
    dealValue: opp.dealValue,
    signals: evidence.signals,
    fit: {
      icpUnknown,
      industryMatch: matchesAny(opp.account.industry, industries),
      companySizeMatch: matchesAny(opp.account.companySize, sizes),
      regionMatch: matchesAny(opp.account.region, regions),
      buyerTitleMatch: matchesAny(opp.primaryContact?.position, titles),
    },
    engagement: evidence.engagement,
    lastInteractionAt: evidence.lastInteractionAt,
    theyRepliedLast: evidence.theyRepliedLast,
    icpDealRange: { min: icp?.dealValueMin ?? null, max: icp?.dealValueMax ?? null },
  });

  await db.$transaction([
    db.opportunityScoreSnapshot.create({
      data: {
        orgId,
        opportunityId,
        score: result.score,
        band: result.band,
        confidence: result.confidence,
        winProbability: result.winProbability,
        expectedValue: result.expectedValue,
        whyNow: result.whyNow.join("\n"),
        version: result.version,
        factors: {
          create: result.factors.map((f) => ({
            dimension: f.dimension,
            ruleKey: f.ruleKey,
            label: f.label,
            points: f.points,
            reason: f.reason,
          })),
        },
      },
    }),
    db.opportunity.update({
      where: { id: opportunityId },
      data: {
        score: result.score,
        scoreBand: result.band,
        confidence: result.confidence,
        winProbability: result.winProbability,
        whyNow: result.whyNow.join("\n"),
        scoredAt: new Date(),
        // Never overwrite a stored date with nothing.
        //
        // `evidence.lastInteractionAt` is derived from activity *records* —
        // emails, events, responses, signals. A deal imported from a
        // spreadsheet has none of those: it has a `last_contacted` column the
        // customer filled in, which lands in exactly this field. Writing the
        // derived value unconditionally erased it, so rescoring a freshly
        // imported pipeline silently deleted the only date it had, and every
        // rule that needs a last-contact date then found nothing. Today came
        // up empty straight after the primary onboarding path.
        //
        // Takes the newer of the two instead: real activity supersedes the
        // imported field, and the absence of activity supersedes nothing.
        ...(evidence.lastInteractionAt &&
        (!opp.lastInteractionAt || evidence.lastInteractionAt > opp.lastInteractionAt)
          ? {
              lastInteractionAt: evidence.lastInteractionAt,
              lastInteractionKind: evidence.lastInteractionKind,
            }
          : {}),
      },
    }),
  ]);

  return result;
}

/** Rescores every open opportunity in a workspace. */
export async function rescoreAllOpportunities(orgId: string): Promise<number> {
  const open = await db.opportunity.findMany({
    where: { orgId, stage: { in: ["NEW", "QUALIFYING", "MEETING", "PROPOSAL", "NEGOTIATION"] } },
    select: { id: true },
  });
  for (const o of open) await rescoreOpportunity(orgId, o.id);
  return open.length;
}

/** Pipeline stage on a Prospect → the deal stage it implies. */
const PROSPECT_STAGE_MAP: Record<string, OpportunityStage> = {
  NEW_LEAD: "NEW",
  CONTACTED: "QUALIFYING",
  INTERESTED: "QUALIFYING",
  MEETING: "MEETING",
  PROPOSAL: "PROPOSAL",
  WON: "WON",
  LOST: "LOST",
};

/**
 * Creates opportunities for accounts that do not have one yet, deriving the
 * deal from the account's most advanced contact.
 *
 * This is what lets an existing Selryn workspace light up immediately
 * rather than showing an empty revenue dashboard: the pipeline data is
 * already there, it just had no money attached to it. Idempotent — an
 * account that already has an opportunity is skipped.
 */
export async function syncOpportunitiesFromAccounts(
  session: SessionContext
): Promise<number> {
  const orgId = session.orgId;
  const [accounts, icp] = await Promise.all([
    db.account.findMany({
      where: { orgId, opportunities: { none: {} } },
      include: {
        prospects: { orderBy: { updatedAt: "desc" } },
      },
    }),
    db.icpProfile.findUnique({ where: { orgId } }),
  ]);

  let created = 0;
  for (const account of accounts) {
    // Skip accounts with no contacts at all — there is no deal to speak of.
    if (account.prospects.length === 0) continue;

    // The furthest-along contact defines the deal's stage.
    const ranked = [...account.prospects].sort(
      (a, b) => stageRank(b.stage) - stageRank(a.stage)
    );
    const lead = ranked[0];
    const stage = PROSPECT_STAGE_MAP[lead.stage] ?? "NEW";

    const { dealValue, basis } = estimateDealValue({
      icpMin: icp?.dealValueMin,
      icpMax: icp?.dealValueMax,
      companySize: account.companySize,
    });

    const opp = await db.opportunity.create({
      data: {
        orgId,
        accountId: account.id,
        primaryContactId: lead.id,
        name: `${account.name} — new business`,
        stage,
        source: "derived_from_prospect",
        dealValue,
        dealValueBasis: basis,
        closedAt: isOpenStage(stage) ? null : new Date(),
      },
    });
    await rescoreOpportunity(orgId, opp.id);
    created++;
  }
  return created;
}

function stageRank(stage: string): number {
  const order = ["LOST", "NEW_LEAD", "CONTACTED", "INTERESTED", "MEETING", "PROPOSAL", "WON"];
  const i = order.indexOf(stage);
  return i === -1 ? 0 : i;
}

/** Expected revenue for an opportunity row, using its cached numbers. */
export function oppExpectedValue(opp: { dealValue: number; winProbability: number }): number {
  return expectedRevenue(opp.dealValue, opp.winProbability);
}
