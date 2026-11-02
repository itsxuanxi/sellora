import "server-only";
import { db } from "@/lib/db";
import { STAGE_LABELS, type OpportunityStage } from "@/lib/revenue/config";
import { exclusionsForOpportunities, factsForOpportunities } from "@/lib/deal-facts/queries";
import {
  compareRecovery,
  evaluateRecovery,
  type ExclusionReason,
  type RecoveryCandidate,
  type RecoveryReason,
} from "@/lib/recovery/eligibility";

/**
 * Finding the dormant deals worth another conversation.
 *
 * Every query is scoped by `orgId`. The eligibility rules themselves live in
 * `eligibility.ts` and are pure; this only gathers the facts they need and
 * reports what they decide.
 *
 * Note what is absent: no total. The module returns a list and a count, and
 * nothing anywhere adds the deal values up — "£340,000 of recoverable
 * revenue" is a number that is always wrong and it is the reason tools like
 * this get switched off.
 */

export interface RecoveryItem {
  opportunityId: string;
  accountName: string;
  amount: number | null;
  currency: string;
  stage: string;
  reason: RecoveryReason;
  contact: { id: string; name: string; email: string } | null;
  lastActivityAt: Date | null;
}

export interface RecoveryResult {
  items: RecoveryItem[];
  /** How many were looked at, so "3 of 180" can be said honestly. */
  considered: number;
  /** Ruled out, by why — shown so the filtering is visible, not magic. */
  setAside: Record<string, number>;
}

export async function getRecoveryCandidates(
  orgId: string,
  now: Date = new Date()
): Promise<RecoveryResult> {
  const opportunities = await db.opportunity.findMany({
    where: { orgId },
    select: {
      id: true,
      stage: true,
      dealValue: true,
      dealValueBasis: true,
      currency: true,
      closedAt: true,
      lostReason: true,
      lastInteractionAt: true,
      account: { select: { name: true } },
      primaryContact: { select: { id: true, name: true, email: true } },
    },
  });

  const setAside: Record<string, number> = {};
  const result: RecoveryResult = { items: [], considered: opportunities.length, setAside };
  if (opportunities.length === 0) return result;

  const ids = opportunities.map((o) => o.id);

  const [events, exclusions, facts] = await Promise.all([
    db.revenueEvent.findMany({
      where: { orgId, opportunityId: { in: ids } },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        eventType: true,
        actorType: true,
        occurredAt: true,
        opportunityId: true,
      },
    }),
    exclusionsForOpportunities(orgId, ids),
    factsForOpportunities(orgId, ids),
  ]);

  const byOpportunity = new Map<string, typeof events>();
  for (const e of events) {
    if (!e.opportunityId) continue;
    const list = byOpportunity.get(e.opportunityId) ?? [];
    list.push(e);
    byOpportunity.set(e.opportunityId, list);
  }

  const eligible: (RecoveryItem & { reason: RecoveryReason })[] = [];

  for (const opp of opportunities) {
    const rows = byOpportunity.get(opp.id) ?? [];

    // Real engagement means the buyer did something — replied, met, called.
    // Our own outbound does not count, or every imported row would qualify.
    const everEngaged = rows.some(
      (e) => e.actorType === "buyer" || e.eventType.startsWith("meeting.")
    );
    const proposal = rows.find((e) => e.eventType === "email.sent");

    // A date the client named, where one was extracted or confirmed.
    const decisionDate = facts.get(opp.id)?.decision_date?.value ?? null;
    const postponedUntil = decisionDate ? parseDate(decisionDate) : null;

    const candidate: RecoveryCandidate = {
      opportunityId: opp.id,
      accountName: opp.account.name,
      amount: opp.dealValueBasis === "user_entered" ? opp.dealValue : null,
      currency: opp.currency,
      stageKey: opp.stage,
      closedAt: opp.closedAt,
      lostReason: opp.lostReason,
      proposalSentAt: proposal?.occurredAt ?? null,
      lastActivityAt: opp.lastInteractionAt ?? rows[0]?.occurredAt ?? null,
      everEngaged,
      postponedUntil,
      exclusions: (exclusions.get(opp.id) ?? []) as ExclusionReason[],
      evidenceIds: rows.slice(0, 3).map((e) => e.id),
    };

    const verdict = evaluateRecovery(candidate, now);
    if (!verdict.eligible) {
      const key = verdict.why === "excluded" ? `excluded:${verdict.exclusion}` : verdict.why;
      setAside[key] = (setAside[key] ?? 0) + 1;
      continue;
    }

    eligible.push({
      opportunityId: opp.id,
      accountName: opp.account.name,
      amount: candidate.amount,
      currency: opp.currency,
      stage: STAGE_LABELS[opp.stage as OpportunityStage] ?? opp.stage,
      reason: verdict.reason,
      contact: opp.primaryContact,
      lastActivityAt: candidate.lastActivityAt,
    });
  }

  result.items = eligible.sort(compareRecovery);
  return result;
}

/** Permissive but never inventive: an unparseable date is simply no date. */
function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
