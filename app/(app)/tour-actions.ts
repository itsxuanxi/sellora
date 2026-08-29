"use server";

import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/revenue/money";

/**
 * What the guided story actually achieved, read back from the record.
 *
 * Nothing here is remembered by the tour. The "before" figures are the
 * opportunity's earliest score snapshot — written when the sandbox was
 * seeded — and the "after" figures are its latest. If the visitor skipped
 * the actions, before and after are the same and the screen says so, which
 * is the honest outcome for someone who clicked through without doing
 * anything.
 */

export interface TourOutcome {
  company: string;
  dealValue: string;
  winBefore: number;
  winAfter: number;
  expectedBefore: string;
  expectedAfter: string;
  upliftLabel: string;
  upliftPositive: boolean;
  stageBefore: string | null;
  stageAfter: string;
  /** Buyer reactions recorded during the session. */
  responsesLogged: number;
  /** Recommendations the visitor acted on. */
  actionsTaken: number;
  changed: boolean;
}

export async function getTourOutcome(): Promise<TourOutcome | null> {
  const session = await requireSession();

  const opportunity = await db.opportunity.findFirst({
    where: { orgId: session.orgId, account: { name: "Cloudmint" } },
    select: {
      id: true,
      dealValue: true,
      currency: true,
      stage: true,
      winProbability: true,
      account: { select: { name: true } },
    },
  });
  if (!opportunity) return null;

  const [snapshots, responsesLogged, actionsTaken] = await Promise.all([
    db.opportunityScoreSnapshot.findMany({
      where: { orgId: session.orgId, opportunityId: opportunity.id },
      orderBy: { createdAt: "asc" },
      select: { winProbability: true, expectedValue: true, createdAt: true },
    }),
    db.response.count({ where: { orgId: session.orgId, opportunityId: opportunity.id } }),
    db.recommendation.count({
      where: {
        orgId: session.orgId,
        opportunityId: opportunity.id,
        status: "COMPLETED",
      },
    }),
  ]);

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  if (!first || !last) return null;

  const currency = opportunity.currency;
  const uplift = last.expectedValue - first.expectedValue;

  return {
    company: opportunity.account.name,
    dealValue: formatMoney(opportunity.dealValue, currency),
    winBefore: first.winProbability,
    winAfter: last.winProbability,
    expectedBefore: formatMoney(first.expectedValue, currency),
    expectedAfter: formatMoney(last.expectedValue, currency),
    upliftLabel: `${uplift >= 0 ? "+" : "−"}${formatMoney(Math.abs(uplift), currency)}`,
    upliftPositive: uplift > 0,
    stageBefore: null,
    stageAfter: opportunity.stage,
    responsesLogged,
    actionsTaken,
    changed: snapshots.length > 1 && uplift !== 0,
  };
}
