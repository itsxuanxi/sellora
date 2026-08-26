import "server-only";
import { db } from "@/lib/db";
import { isOpenStage } from "@/lib/revenue/config";
import { loadEnrichedOpportunities } from "@/lib/revenue/queries";

/**
 * The recommendation ledger — the part of §15's data moat that this MVP
 * actually implements.
 *
 * Every action Sellora puts in front of a human is written down before they
 * act on it, and the row records what happened next: completed, dismissed
 * (and why), or ignored. That chain — recommended → acted → outcome — is the
 * only honest foundation for the outcome-based learning described in Phase 3.
 *
 * To be explicit about what this is NOT: nothing here trains a model or
 * adjusts a weight. The scoring config is hand-tuned and static. This
 * records the data such a system would need, which is the prerequisite the
 * spec asks for ("Build the data foundation first") — not the system itself.
 */

/**
 * Regenerates the open recommendation set for a workspace.
 *
 * Upserts on (opportunityId, dedupeKey) so a recurring situation updates the
 * existing row — keeping its original createdAt, which is what makes "this
 * has been sitting for 4 days" true — instead of spawning a duplicate every
 * time a page loads. Recommendations whose situation has resolved are
 * closed out rather than deleted, so the history stays intact.
 */
export async function syncRecommendations(orgId: string): Promise<{
  created: number;
  updated: number;
  resolved: number;
}> {
  const opps = await loadEnrichedOpportunities(orgId);
  const existing = await db.recommendation.findMany({
    where: { orgId, status: "OPEN" },
    select: { id: true, opportunityId: true, dedupeKey: true },
  });

  const existingByKey = new Map(
    existing.map((r) => [`${r.opportunityId}:${r.dedupeKey}`, r.id])
  );
  const stillLive = new Set<string>();

  let created = 0;
  let updated = 0;

  for (const opp of opps) {
    const action = opp.nextAction;
    // "Wait" and closed deals are advice, not tasks — they never become rows.
    if (action.actionType === "wait" || !isOpenStage(opp.stage)) continue;

    const key = `${opp.id}:${action.dedupeKey}`;
    stillLive.add(key);

    const data = {
      actionType: action.actionType,
      headline: action.headline,
      rationale: action.rationale,
      urgency: action.urgency,
      leakType: action.leakType,
      expectedValue: action.expectedValue,
      dealValue: opp.dealValue,
    };

    if (existingByKey.has(key)) {
      await db.recommendation.update({
        where: { id: existingByKey.get(key)! },
        data,
      });
      updated++;
    } else {
      await db.recommendation.upsert({
        where: {
          opportunityId_dedupeKey: {
            opportunityId: opp.id,
            dedupeKey: action.dedupeKey,
          },
        },
        // A previously dismissed/completed recommendation reopens if the
        // situation has genuinely recurred.
        update: { ...data, status: "OPEN", dismissedAt: null, completedAt: null },
        create: {
          orgId,
          opportunityId: opp.id,
          dedupeKey: action.dedupeKey,
          ...data,
        },
      });
      created++;
    }
  }

  // Anything open that no longer corresponds to a live situation resolved
  // itself — the rep followed up, the deal moved, the signal expired.
  const stale = existing.filter(
    (r) => !stillLive.has(`${r.opportunityId}:${r.dedupeKey}`)
  );
  if (stale.length > 0) {
    await db.recommendation.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedBy: "auto_resolved",
      },
    });
  }

  return { created, updated, resolved: stale.length };
}

/**
 * Materializes the recommendation for a single opportunity from its live
 * computed next action, returning the row id.
 *
 * The feed computes next actions on every render, but the ledger row is only
 * written when it needs to exist. This lets a user act on a recommendation
 * the first time they see it, without having to run a workspace-wide refresh
 * to bring the ledger into being.
 */
export async function ensureRecommendation(
  orgId: string,
  opportunityId: string
): Promise<string | null> {
  const existing = await db.recommendation.findFirst({
    where: { orgId, opportunityId, status: "OPEN" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const opps = await loadEnrichedOpportunities(orgId);
  const opp = opps.find((o) => o.id === opportunityId);
  if (!opp || opp.nextAction.actionType === "wait" || !isOpenStage(opp.stage)) return null;

  const action = opp.nextAction;
  const rec = await db.recommendation.upsert({
    where: {
      opportunityId_dedupeKey: { opportunityId, dedupeKey: action.dedupeKey },
    },
    update: { status: "OPEN", dismissedAt: null, completedAt: null },
    create: {
      orgId,
      opportunityId,
      dedupeKey: action.dedupeKey,
      actionType: action.actionType,
      headline: action.headline,
      rationale: action.rationale,
      urgency: action.urgency,
      leakType: action.leakType,
      expectedValue: action.expectedValue,
      dealValue: opp.dealValue,
    },
    select: { id: true },
  });
  return rec.id;
}

/**
 * Marks a recommendation done and records the revenue attribution that
 * follows from it.
 *
 * Attribution is written only here, on a real user action — never inferred
 * at read time. That is what lets the Impact page claim to report facts.
 */
export async function completeRecommendation(
  orgId: string,
  recommendationId: string,
  userId: string
): Promise<void> {
  const rec = await db.recommendation.findFirst({
    where: { id: recommendationId, orgId },
    include: { opportunity: { select: { id: true, stage: true, dealValue: true, winProbability: true } } },
  });
  if (!rec || rec.status === "COMPLETED") return;

  const now = new Date();

  // A rescued leak is "saved"; ordinary advance-the-deal work is "influenced";
  // booking a meeting is tracked separately because §12 counts meetings.
  const kind =
    rec.actionType === "book_meeting"
      ? "meeting"
      : rec.leakType
        ? "saved"
        : "influenced";

  await db.$transaction([
    db.recommendation.update({
      where: { id: rec.id },
      data: { status: "COMPLETED", completedAt: now, completedBy: userId },
    }),
    db.revenueAttribution.create({
      data: {
        orgId,
        opportunityId: rec.opportunityId,
        recommendationId: rec.id,
        kind,
        amount: rec.expectedValue,
        reason: rec.leakType
          ? `Acted on "${rec.headline}" — recovered a deal flagged as ${rec.leakType.replace(/_/g, " ")}.`
          : `Acted on "${rec.headline}".`,
        occurredAt: now,
      },
    }),
    db.opportunity.update({
      where: { id: rec.opportunityId },
      data: { lastInteractionAt: now, lastInteractionKind: "note" },
    }),
  ]);
}

export async function dismissRecommendation(
  orgId: string,
  recommendationId: string,
  reason?: string
): Promise<void> {
  const rec = await db.recommendation.findFirst({
    where: { id: recommendationId, orgId },
    select: { id: true },
  });
  if (!rec) return;

  // Dismissals are kept, not deleted: "Sellora suggested this and a human
  // said no" is the most useful training signal in the whole table.
  await db.recommendation.update({
    where: { id: rec.id },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissReason: reason?.slice(0, 500) ?? null,
    },
  });
}

export async function snoozeRecommendation(
  orgId: string,
  recommendationId: string,
  days: number
): Promise<void> {
  const rec = await db.recommendation.findFirst({
    where: { id: recommendationId, orgId },
    select: { id: true },
  });
  if (!rec) return;

  const until = new Date();
  until.setDate(until.getDate() + Math.max(1, Math.min(30, days)));

  await db.recommendation.update({
    where: { id: rec.id },
    data: { status: "SNOOZED", snoozedUntil: until },
  });
}

/**
 * Records that an opportunity was won and, if Sellora influenced it,
 * attributes the recovered revenue.
 */
export async function markOpportunityWon(
  orgId: string,
  opportunityId: string
): Promise<void> {
  const opp = await db.opportunity.findFirst({
    where: { id: opportunityId, orgId },
    include: { attributions: { select: { id: true }, take: 1 } },
  });
  if (!opp) return;

  const now = new Date();
  await db.opportunity.update({
    where: { id: opp.id },
    data: { stage: "WON", closedAt: now, winProbability: 100 },
  });

  // Only claim the revenue if Sellora actually touched this deal.
  if (opp.attributions.length > 0) {
    await db.revenueAttribution.create({
      data: {
        orgId,
        opportunityId: opp.id,
        kind: "recovered",
        amount: opp.dealValue,
        reason: "Deal closed won after Sellora surfaced and recovered it.",
        occurredAt: now,
      },
    });
  }

  await db.outcome.create({
    data: {
      orgId,
      accountId: opp.accountId,
      opportunityId: opp.id,
      stage: "won",
      detail: `${opp.name} closed won`,
      occurredAt: now,
    },
  });
}

/** Open recommendations for one opportunity, most urgent first. */
export async function getOpenRecommendations(orgId: string, opportunityId: string) {
  return db.recommendation.findMany({
    where: { orgId, opportunityId, status: "OPEN" },
    orderBy: { createdAt: "asc" },
  });
}
