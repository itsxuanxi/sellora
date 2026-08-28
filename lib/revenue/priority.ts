/**
 * Action Priority — how Selryn decides which of fifty open deals a rep
 * should look at first.
 *
 * A pure function, deliberately: it takes numbers in and returns a score and
 * the arithmetic that produced it, so every value in the queue can be
 * explained down to the component that moved it. No database, no clock, no
 * hidden state — which is also what makes it testable.
 *
 * The composition is transparent and hand-tuned, not learned. It is stated as
 * such everywhere it surfaces. The one component that *is* derived from real
 * history is `effectiveness`, which reads this workspace's own hit rate for
 * the recommended action type; when there is not enough history for that
 * action, it contributes nothing rather than guessing.
 *
 * Bump PRIORITY_CONFIG_VERSION on any weight change — Recommendation stores
 * the version that produced it, so the learning layer can compare the hit
 * rate of one generation of weights against another.
 */

import { URGENCY_RANK, type Urgency } from "@/lib/revenue/config";

export const PRIORITY_CONFIG_VERSION = 1;

/**
 * Component weights, summing to 100. Expected revenue dominates because the
 * product's entire claim is that it ranks by money at stake rather than by
 * recency; the rest reorder deals of comparable size.
 */
export const PRIORITY_WEIGHTS = {
  expectedRevenue: 40,
  timeSensitivity: 20,
  risk: 15,
  signalStrength: 15,
  effectiveness: 10,
} as const;

export type PriorityComponent = keyof typeof PRIORITY_WEIGHTS;

export const PRIORITY_COMPONENT_LABELS: Record<PriorityComponent, string> = {
  expectedRevenue: "Expected revenue",
  timeSensitivity: "Time sensitivity",
  risk: "Deal risk",
  signalStrength: "Signal strength",
  effectiveness: "Past effectiveness",
};

export interface PriorityInput {
  /** dealValue × winProbability / 100. */
  expectedValue: number;
  /** The largest expected value in the current set, for relative scaling. */
  maxExpectedValue: number;
  urgency: Urgency;
  /** 0-100 opportunity score. Low score on an open deal means risk. */
  score: number;
  /** Highest importance among the signals behind this recommendation, 0-100. */
  signalStrength: number;
  /**
   * This workspace's historical positive-response rate for the recommended
   * action type, 0-1. Null when there is not enough history — see below.
   */
  actionHitRate: number | null;
}

export interface PriorityBreakdownRow {
  component: PriorityComponent;
  label: string;
  /** Points contributed, already weighted. */
  points: number;
  max: number;
  reason: string;
}

export interface PriorityResult {
  score: number; // 0-100
  breakdown: PriorityBreakdownRow[];
  version: number;
}

/** Urgency → 0-1. "Right now" is the full weight; "monitor" earns none. */
const URGENCY_FRACTION: Record<Urgency, number> = {
  now: 1,
  today: 0.75,
  this_week: 0.4,
  monitor: 0,
};

export function computeActionPriority(input: PriorityInput): PriorityResult {
  const breakdown: PriorityBreakdownRow[] = [];

  // ── Expected revenue, relative to the biggest deal in play ──
  // Relative rather than absolute: a $40k deal is the top of the queue in a
  // workspace whose deals are all $50k, and unremarkable in one selling
  // $2m contracts. A fixed dollar scale would be wrong for one of them.
  const revenueFraction =
    input.maxExpectedValue > 0
      ? Math.min(1, input.expectedValue / input.maxExpectedValue)
      : 0;
  const revenuePoints = Math.round(revenueFraction * PRIORITY_WEIGHTS.expectedRevenue);
  breakdown.push({
    component: "expectedRevenue",
    label: PRIORITY_COMPONENT_LABELS.expectedRevenue,
    points: revenuePoints,
    max: PRIORITY_WEIGHTS.expectedRevenue,
    reason:
      input.maxExpectedValue > 0
        ? `${Math.round(revenueFraction * 100)}% of the largest expected value currently open.`
        : "No expected value recorded yet.",
  });

  // ── Time sensitivity ──
  const urgencyPoints = Math.round(
    URGENCY_FRACTION[input.urgency] * PRIORITY_WEIGHTS.timeSensitivity
  );
  breakdown.push({
    component: "timeSensitivity",
    label: PRIORITY_COMPONENT_LABELS.timeSensitivity,
    points: urgencyPoints,
    max: PRIORITY_WEIGHTS.timeSensitivity,
    reason: `Urgency is "${input.urgency.replace(/_/g, " ")}".`,
  });

  // ── Risk ──
  // Inverted score: a weak deal with money on it is where attention changes
  // the outcome. A deal already scoring 90 rarely needs the intervention.
  const riskFraction = Math.max(0, Math.min(1, (100 - input.score) / 100));
  const riskPoints = Math.round(riskFraction * PRIORITY_WEIGHTS.risk);
  breakdown.push({
    component: "risk",
    label: PRIORITY_COMPONENT_LABELS.risk,
    points: riskPoints,
    max: PRIORITY_WEIGHTS.risk,
    reason: `Opportunity score is ${input.score}/100, so ${Math.round(riskFraction * 100)}% of the risk weight applies.`,
  });

  // ── Signal strength ──
  const signalFraction = Math.max(0, Math.min(1, input.signalStrength / 100));
  const signalPoints = Math.round(signalFraction * PRIORITY_WEIGHTS.signalStrength);
  breakdown.push({
    component: "signalStrength",
    label: PRIORITY_COMPONENT_LABELS.signalStrength,
    points: signalPoints,
    max: PRIORITY_WEIGHTS.signalStrength,
    reason:
      input.signalStrength > 0
        ? `Strongest supporting signal rates ${input.signalStrength}/100 for importance.`
        : "No supporting signals recorded.",
  });

  // ── Past effectiveness ──
  // Null means "not enough history", which is scored as neutral — half the
  // weight — rather than zero. Scoring an untried action as worthless would
  // stop it ever being tried, and the queue would never learn anything new.
  const effectivenessFraction = input.actionHitRate ?? 0.5;
  const effectivenessPoints = Math.round(
    effectivenessFraction * PRIORITY_WEIGHTS.effectiveness
  );
  breakdown.push({
    component: "effectiveness",
    label: PRIORITY_COMPONENT_LABELS.effectiveness,
    points: effectivenessPoints,
    max: PRIORITY_WEIGHTS.effectiveness,
    reason:
      input.actionHitRate == null
        ? "Not enough history for this action type yet — scored neutral."
        : `This action drew a customer reaction ${Math.round(input.actionHitRate * 100)}% of the time here.`,
  });

  const score = Math.max(
    0,
    Math.min(100, breakdown.reduce((sum, row) => sum + row.points, 0))
  );

  return { score, breakdown, version: PRIORITY_CONFIG_VERSION };
}

/**
 * How confident Selryn is in a specific piece of advice — which is not the
 * same as how strong the deal is. High confidence requires both real evidence
 * behind the recommendation and some history that the action works here.
 */
export function recommendationConfidence(input: {
  supportingSignalCount: number;
  actionHitRate: number | null;
}): "low" | "medium" | "high" {
  if (input.supportingSignalCount === 0) return "low";
  if (input.supportingSignalCount >= 2 && input.actionHitRate != null) return "high";
  return "medium";
}

/** Sort helper: priority first, then urgency as the tiebreak. */
export function byPriority<T extends { priorityScore: number; urgency: string }>(
  a: T,
  b: T
): number {
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  return (
    (URGENCY_RANK[a.urgency as Urgency] ?? 9) - (URGENCY_RANK[b.urgency as Urgency] ?? 9)
  );
}
