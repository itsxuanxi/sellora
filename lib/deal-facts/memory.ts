/**
 * What this agency keeps running into.
 *
 * Deliberately modest. With a few dozen deals there is nothing here a
 * statistician would sign off, and the honest thing is to say so rather than
 * to dress a handful of rows up as a finding. So every figure carries its
 * sample size, anything under the threshold is labelled insufficient rather
 * than hidden, and no line claims that doing X caused Y.
 *
 * The causal restraint is the important part. "Deals where you answered the
 * scope question closed more often" is a correlation that will be true of any
 * sample where the engaged deals also happen to be the ones that closed, and
 * stating it as advice is how a tool starts being wrong confidently.
 */

import type { FactKind } from "@/lib/deal-facts/kinds";

/** Below this, a pattern is an anecdote. */
export const MIN_SAMPLE = 8;

export interface ObjectionTally {
  value: string;
  /** How many distinct deals raised it. */
  deals: number;
}

export interface MemoryInsight {
  title: string;
  /** The finding, phrased as an observation and never as a cause. */
  body: string;
  /** How many deals it is based on. Always shown. */
  sampleSize: number;
  /** True when there is not yet enough to say anything. */
  insufficient: boolean;
}

/** Normalizes for counting without destroying the agency's own wording. */
function canonical(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
}

/**
 * Objections that come up repeatedly, most common first.
 *
 * Counted per deal, not per mention: a client who says "it's expensive" four
 * times in one thread is one deal with a price objection, and counting the
 * mentions would make the loudest thread look like a trend.
 */
export function recurringObjections(
  objections: { opportunityId: string; value: string }[]
): ObjectionTally[] {
  const byPhrase = new Map<string, { label: string; deals: Set<string> }>();

  for (const o of objections) {
    const key = canonical(o.value);
    if (!key) continue;
    const entry = byPhrase.get(key) ?? { label: o.value.trim(), deals: new Set<string>() };
    entry.deals.add(o.opportunityId);
    byPhrase.set(key, entry);
  }

  return [...byPhrase.values()]
    .map((e) => ({ value: e.label, deals: e.deals.size }))
    .filter((t) => t.deals > 1)
    .sort((a, b) => b.deals - a.deals || a.value.localeCompare(b.value));
}

export interface OutcomeCounts {
  /** Deals that reached a terminal stage in the period. */
  closed: number;
  won: number;
  lost: number;
  /** Loss reasons recorded, by reason. */
  lossReasons: Record<string, number>;
}

/**
 * A plain summary of what happened, with no inference attached.
 *
 * Returns the counts and leaves the reading of them to the person. There is
 * no win-rate trend, no "you are improving", no projection.
 */
export function outcomeSummary(counts: OutcomeCounts): MemoryInsight {
  const insufficient = counts.closed < MIN_SAMPLE;
  if (insufficient) {
    return {
      title: "Outcomes",
      body: `${counts.closed} deal${counts.closed === 1 ? "" : "s"} closed so far — too few to read anything into yet.`,
      sampleSize: counts.closed,
      insufficient: true,
    };
  }

  const topReason = Object.entries(counts.lossReasons).sort((a, b) => b[1] - a[1])[0];
  const reasonLine = topReason
    ? ` The most common recorded reason for a loss was ${topReason[0].replace(/_/g, " ")} (${topReason[1]} of ${counts.lost}).`
    : "";

  return {
    title: "Outcomes",
    body: `Of ${counts.closed} closed deals, ${counts.won} were won and ${counts.lost} lost.${reasonLine}`,
    sampleSize: counts.closed,
    insufficient: false,
  };
}

/** The objection pattern, stated as a pattern and nothing more. */
export function objectionInsight(
  tallies: ObjectionTally[],
  dealsConsidered: number
): MemoryInsight {
  if (dealsConsidered < MIN_SAMPLE || tallies.length === 0) {
    return {
      title: "Recurring objections",
      body:
        dealsConsidered < MIN_SAMPLE
          ? `Based on ${dealsConsidered} deal${dealsConsidered === 1 ? "" : "s"} — not enough yet to call anything recurring.`
          : "No objection has come up on more than one deal yet.",
      sampleSize: dealsConsidered,
      insufficient: true,
    };
  }

  const top = tallies[0];
  return {
    title: "Recurring objections",
    body: `“${top.value}” has come up on ${top.deals} of ${dealsConsidered} deals. Worth having a prepared answer — this is a count, not a diagnosis.`,
    sampleSize: dealsConsidered,
    insufficient: false,
  };
}

/** Fact kinds most often missing, to show where the record is thin. */
export function coverageGaps(
  present: Record<FactKind, number>,
  totalDeals: number
): { kind: FactKind; missing: number }[] {
  return (Object.keys(present) as FactKind[])
    .map((kind) => ({ kind, missing: totalDeals - (present[kind] ?? 0) }))
    .filter((g) => g.missing > 0)
    .sort((a, b) => b.missing - a.missing);
}
