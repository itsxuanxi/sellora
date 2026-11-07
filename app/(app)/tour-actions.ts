"use server";

import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/revenue/money";

/**
 * What the guided story actually achieved, read back from the record.
 *
 * Nothing here is remembered by the tour; it is all counted from the
 * database. The visitor who clicked through without approving anything gets
 * zeroes and a screen that says so, which is the honest outcome for them.
 *
 * It used to close on "Win probability 62% → 71%" and an expected-revenue
 * delta — the payoff of the whole demo was two uncalibrated estimates and
 * their difference, stated to the point. What a visitor actually did is
 * countable: they approved a follow-up, they recorded what the buyer said,
 * the deal is at a stage. Those are the three now, and the screen still says
 * plainly that the deal has not been won.
 */

export interface TourOutcome {
  company: string;
  dealValue: string;
  stageAfter: string;
  /** Buyer reactions recorded during the session. */
  responsesLogged: number;
  /** Recommendations the visitor acted on. */
  actionsTaken: number;
  /** Whether the visitor did anything, rather than whether a figure moved. */
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
      account: { select: { name: true } },
    },
  });
  if (!opportunity) return null;

  // The score snapshots used to be read here, for the before/after
  // probability figures. Nothing needs them now.
  const [responsesLogged, actionsTaken] = await Promise.all([
    db.response.count({ where: { orgId: session.orgId, opportunityId: opportunity.id } }),
    db.recommendation.count({
      where: {
        orgId: session.orgId,
        opportunityId: opportunity.id,
        status: "COMPLETED",
      },
    }),
  ]);

  return {
    company: opportunity.account.name,
    dealValue: formatMoney(opportunity.dealValue, opportunity.currency),
    stageAfter: opportunity.stage,
    responsesLogged,
    actionsTaken,
    // Did the visitor do anything — not did a modelled number move. Those
    // are different questions, and the second one answered "no" for someone
    // who had approved a follow-up whose effect the score had not yet shown.
    changed: actionsTaken > 0 || responsesLogged > 0,
  };
}
