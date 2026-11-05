/**
 * The four money quantities Selryn is allowed to show, and the words for them.
 *
 * They were being blurred, and the blur ran one direction: toward making the
 * product look like it had earned money. The Impact page showed "Revenue
 * recovered" in dollars, and the number came from `RevenueAttribution.amount`
 * rows written the instant somebody clicked "mark complete" on a
 * recommendation — with the amount set to deal value × an uncalibrated win
 * probability. So ticking off a task produced revenue. Nothing had closed,
 * nothing had been collected, and the figure sat on the same page as real
 * closed-won value in the same formatting.
 *
 * The four are kept apart here, each with the definition and the caveat that
 * must travel with it. A screen imports the label rather than typing one, so
 * an estimate cannot quietly acquire the voice of a fact.
 *
 *   1. DEAL VALUE — what the CRM holds, or what a person typed. A fact about
 *      a record, not about the world: the deal may never close.
 *   2. ESTIMATED EXPECTED REVENUE — deal value × an estimated probability.
 *      An estimate built on an uncalibrated stage baseline. Never summed
 *      into anything presented as earnings.
 *   3. OPPORTUNITY VALUE AT RISK — the share of (2) a detected problem
 *      exposes. An estimate of an estimate, and labelled as such.
 *   4. CLOSED-WON VALUE — the deal value of deals that actually closed won.
 *      The only realized figure, and still not "revenue Selryn produced":
 *      see `ATTRIBUTION_CAVEAT`.
 *
 * The rule that falls out of this: a reply, a booked meeting, a completed
 * recommendation or a stage change are *events*. They are counted as events.
 * None of them may be converted into a money figure that reads as earnings.
 */

export type RevenueQuantity =
  | "deal_value"
  | "estimated_expected_revenue"
  | "value_at_risk"
  | "closed_won_value";

export interface QuantityVocabulary {
  /** The column heading or stat label. */
  label: string;
  /** One line under it. States what the number is, including that it is an estimate. */
  help: string;
  /** True when the number is modelled rather than observed. */
  estimated: boolean;
}

export const REVENUE_VOCABULARY: Record<RevenueQuantity, QuantityVocabulary> = {
  deal_value: {
    label: "Deal value",
    help: "The amount on the deal in your CRM. Not a forecast.",
    estimated: false,
  },
  estimated_expected_revenue: {
    label: "Estimated expected revenue",
    help: "Deal value × an estimated close likelihood. An estimate, not a forecast or a commitment.",
    estimated: true,
  },
  value_at_risk: {
    label: "Estimated value at risk",
    help: "The share of this deal's estimated expected revenue that the problem above could cost. An estimate of an estimate.",
    estimated: true,
  },
  closed_won_value: {
    label: "Closed-won value",
    help: "Deal value on deals that actually closed won. The only figure here that is not an estimate.",
    estimated: false,
  },
};

/**
 * The sentence that must accompany any figure tying money to Selryn's work.
 *
 * `markOpportunityWon` used to write an attribution row of the deal's full
 * value with the reason "closed won after Selryn surfaced and recovered it",
 * on the sole condition that Selryn had touched the deal at some earlier
 * point. One completed recommendation therefore claimed the entire win. There
 * is no way to establish that from the data available, and the honest answer
 * is to report the overlap and let the reader draw the conclusion.
 */
export const ATTRIBUTION_CAVEAT =
  "Deals Selryn flagged and someone then worked. Overlap, not credit — Selryn cannot measure how much of the outcome it caused.";

/** Why the likelihood figure is not a forecast. Shown wherever it appears. */
export const WIN_PROBABILITY_CAVEAT =
  "An estimate from the deal's stage, adjusted by its score. It is not calibrated against your own win history, so treat it as a rough ordering rather than a probability.";

/**
 * Whether a probability figure may be shown as a percentage at all.
 *
 * A number like "62%" asserts a precision the derivation does not have: it is
 * a generic stage baseline multiplied by a hand-tuned score factor. Showing
 * the band instead keeps the ordering, which is the useful part, and drops the
 * false precision.
 */
export function likelihoodBand(winProbability: number): {
  label: string;
  detail: string;
} {
  if (winProbability >= 80) {
    return { label: "Very likely", detail: "Late-stage deals like this usually close." };
  }
  if (winProbability >= 55) {
    return { label: "Likely", detail: "More of these close than not." };
  }
  if (winProbability >= 30) {
    return { label: "Even odds", detail: "Roughly as likely to close as not." };
  }
  if (winProbability >= 10) {
    return { label: "Unlikely", detail: "Most deals at this stage do not close." };
  }
  return { label: "Long shot", detail: "Very few deals at this stage close." };
}
