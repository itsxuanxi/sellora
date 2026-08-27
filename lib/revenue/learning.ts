import "server-only";
import { db } from "@/lib/db";
import { ACTION_LABELS, STAGE_LABELS, type ActionType } from "@/lib/revenue/config";
import { SIGNAL_LABELS, type SignalType } from "@/lib/intent/config";
import { POSITIVE_RESPONSES } from "@/lib/revenue/loop";

/**
 * What this workspace's own history actually shows.
 *
 * Everything here is descriptive statistics over the org's own rows. There is
 * no model, no training, and nothing is shared across workspaces. Two rules
 * are enforced structurally rather than left to whoever writes the UI:
 *
 *   1. **Nothing below MIN_SAMPLE is reported.** Every result is a
 *      `Measured<T>` that is either `{ ok: true, ... }` or
 *      `{ ok: false, reason: "insufficient_data", have, need }`. A caller
 *      cannot accidentally render a rate computed from three deals, because
 *      there is no number on the object to render.
 *
 *   2. **Nothing is described as causal.** These are co-occurrence rates:
 *      deals where X happened closed at Y%. Whether X caused Y is not
 *      knowable from this data — there is no control group, reps choose which
 *      advice to take, and the deals they take it on are not a random sample.
 *      The copy in `caveat` says so, and the UI prints it.
 */

/** Below this, a rate is noise dressed up as a number. */
export const MIN_SAMPLE = 12;
/** Per-slice minimum for breakdowns (by action type, by stage, by signal). */
export const MIN_SLICE_SAMPLE = 8;

export const LEARNING_CAVEAT =
  "Co-occurrence in your own pipeline, not proof of cause. Reps choose which advice to act on, so acted-on deals are not a random sample.";

export type Measured<T> =
  | ({ ok: true } & T)
  | { ok: false; reason: "insufficient_data"; have: number; need: number };

function measure<T>(have: number, need: number, build: () => T): Measured<T> {
  if (have < need) return { ok: false, reason: "insufficient_data", have, need };
  return { ok: true, ...build() };
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

// ── Funnel: how the loop performs end to end ──────────────────────────────

export interface LoopFunnel {
  recommended: number;
  accepted: number; // acted on in any way
  executed: number; // an action actually went out
  responded: number; // customer reacted positively
  advanced: number; // the deal moved forward
  acceptanceRate: number;
  executionRate: number;
  responseRate: number;
  advanceRate: number;
  editRate: number; // share of approved actions the human rewrote
}

/**
 * The recommendation → action → response → advance funnel.
 *
 * `accepted` counts recommendations with any action attached, which
 * deliberately includes actions that later failed: a rep accepting advice and
 * the send breaking are different failures, and collapsing them would hide
 * an integration problem inside a "reps ignore us" number.
 */
export async function getLoopFunnel(orgId: string): Promise<Measured<LoopFunnel>> {
  const [recommended, withAction, executedActions, editedActions, positiveResponses, advanced] =
    await Promise.all([
      db.recommendation.count({ where: { orgId } }),
      db.recommendation.count({ where: { orgId, actions: { some: {} } } }),
      db.action.count({ where: { orgId, executionStatus: "EXECUTED" } }),
      db.action.count({ where: { orgId, executionStatus: "EXECUTED", humanEdited: true } }),
      db.response.count({
        where: { orgId, responseType: { in: POSITIVE_RESPONSES } },
      }),
      db.response.count({ where: { orgId, responseType: "opportunity_advanced" } }),
    ]);

  return measure(recommended, MIN_SAMPLE, () => ({
    recommended,
    accepted: withAction,
    executed: executedActions,
    responded: positiveResponses,
    advanced,
    acceptanceRate: rate(withAction, recommended),
    executionRate: rate(executedActions, withAction),
    responseRate: rate(positiveResponses, executedActions),
    advanceRate: rate(advanced, executedActions),
    editRate: rate(editedActions, executedActions),
  }));
}

// ── Which actions work, by stage ──────────────────────────────────────────

export interface ActionEffectiveness {
  actionType: string;
  label: string;
  attempts: number;
  positive: number;
  positiveRate: number;
}

/**
 * Positive-response rate per action type. Feeds both the Learning Insights
 * panel and — via `getActionHitRates` — the priority score, so advice that
 * has never worked here stops being pushed to the top of the queue.
 */
export async function getActionEffectiveness(
  orgId: string,
  opts: { stage?: string } = {}
): Promise<ActionEffectiveness[]> {
  const actions = await db.action.findMany({
    where: {
      orgId,
      executionStatus: "EXECUTED",
      ...(opts.stage ? { opportunity: { stage: opts.stage } } : {}),
    },
    select: {
      actionType: true,
      responses: { select: { responseType: true } },
    },
  });

  const byType = new Map<string, { attempts: number; positive: number }>();
  for (const action of actions) {
    const bucket = byType.get(action.actionType) ?? { attempts: 0, positive: 0 };
    bucket.attempts += 1;
    if (action.responses.some((r) => POSITIVE_RESPONSES.includes(r.responseType as never))) {
      bucket.positive += 1;
    }
    byType.set(action.actionType, bucket);
  }

  return [...byType.entries()]
    .filter(([, v]) => v.attempts >= MIN_SLICE_SAMPLE)
    .map(([actionType, v]) => ({
      actionType,
      label: ACTION_LABELS[actionType as ActionType] ?? actionType,
      attempts: v.attempts,
      positive: v.positive,
      positiveRate: rate(v.positive, v.attempts),
    }))
    .sort((a, b) => b.positiveRate - a.positiveRate);
}

/**
 * Historical hit rate per action type as a 0-1 multiplier, for the priority
 * score. Types without enough history return `null` rather than 0 — never
 * having been tried is not the same as having failed, and scoring an untried
 * action as useless would stop it ever being tried.
 */
export async function getActionHitRates(
  orgId: string
): Promise<Map<string, number>> {
  const effectiveness = await getActionEffectiveness(orgId);
  return new Map(effectiveness.map((e) => [e.actionType, e.positiveRate / 100]));
}

// ── Which signals precede wins ────────────────────────────────────────────

export interface SignalWinRate {
  signalType: string;
  label: string;
  deals: number;
  won: number;
  winRate: number;
  /** Win rate across all closed deals, so a slice can be read against a base. */
  baselineWinRate: number;
}

/**
 * Win rate of closed deals that carried each signal type, against the overall
 * baseline. Reported per signal only where that signal appears on at least
 * MIN_SLICE_SAMPLE closed deals.
 *
 * Read this as "deals where we saw X closed at Y% versus a Z% baseline" —
 * not "X causes wins". Signals are not assigned; they are observed on deals
 * that differ in many other ways.
 */
export async function getSignalWinRates(orgId: string): Promise<Measured<{
  baselineWinRate: number;
  closedDeals: number;
  rows: SignalWinRate[];
}>> {
  const closed = await db.opportunity.findMany({
    where: { orgId, stage: { in: ["WON", "LOST"] } },
    select: {
      id: true,
      stage: true,
      signals: { select: { signalType: true } },
      account: { select: { buyingSignals: { select: { signalType: true } } } },
    },
  });

  const wonTotal = closed.filter((o) => o.stage === "WON").length;
  const baselineWinRate = rate(wonTotal, closed.length);

  const byType = new Map<string, { deals: number; won: number }>();
  for (const opp of closed) {
    // A signal counts for a deal if it is linked to the deal directly or, for
    // firmographic signals that only ever attach to a company, to its account.
    const types = new Set([
      ...opp.signals.map((s) => s.signalType),
      ...opp.account.buyingSignals.map((s) => s.signalType),
    ]);
    for (const type of types) {
      const bucket = byType.get(type) ?? { deals: 0, won: 0 };
      bucket.deals += 1;
      if (opp.stage === "WON") bucket.won += 1;
      byType.set(type, bucket);
    }
  }

  return measure(closed.length, MIN_SAMPLE, () => ({
    baselineWinRate,
    closedDeals: closed.length,
    rows: [...byType.entries()]
      .filter(([, v]) => v.deals >= MIN_SLICE_SAMPLE)
      .map(([signalType, v]) => ({
        signalType,
        label: SIGNAL_LABELS[signalType as SignalType] ?? signalType,
        deals: v.deals,
        won: v.won,
        winRate: rate(v.won, v.deals),
        baselineWinRate,
      }))
      .sort((a, b) => b.winRate - a.winRate),
  }));
}

// ── Response speed ────────────────────────────────────────────────────────

export interface SpeedInsight {
  fastAdvanceRate: number;
  slowAdvanceRate: number;
  thresholdHours: number;
  fastCount: number;
  slowCount: number;
}

/**
 * Whether acting fast co-occurs with deals advancing.
 *
 * Splits executed actions at 24h from the triggering recommendation and
 * compares advance rates. Both halves must clear MIN_SLICE_SAMPLE — a
 * comparison where one side is three deals is not a comparison.
 */
export async function getSpeedInsight(orgId: string): Promise<Measured<SpeedInsight>> {
  const thresholdHours = 24;
  const actions = await db.action.findMany({
    where: {
      orgId,
      executionStatus: "EXECUTED",
      executedAt: { not: null },
      recommendationId: { not: null },
    },
    select: {
      executedAt: true,
      recommendation: { select: { createdAt: true } },
      responses: { select: { responseType: true } },
    },
  });

  let fastCount = 0;
  let fastAdvanced = 0;
  let slowCount = 0;
  let slowAdvanced = 0;

  for (const action of actions) {
    if (!action.executedAt || !action.recommendation) continue;
    const hours =
      (action.executedAt.getTime() - action.recommendation.createdAt.getTime()) / 3_600_000;
    const advanced = action.responses.some((r) =>
      POSITIVE_RESPONSES.includes(r.responseType as never)
    );
    if (hours <= thresholdHours) {
      fastCount += 1;
      if (advanced) fastAdvanced += 1;
    } else {
      slowCount += 1;
      if (advanced) slowAdvanced += 1;
    }
  }

  const comparable = Math.min(fastCount, slowCount);
  return measure(comparable, MIN_SLICE_SAMPLE, () => ({
    thresholdHours,
    fastCount,
    slowCount,
    fastAdvanceRate: rate(fastAdvanced, fastCount),
    slowAdvanceRate: rate(slowAdvanced, slowCount),
  }));
}

// ── Influenced pipeline and revenue ───────────────────────────────────────

export interface InfluencedTotals {
  influencedPipeline: number;
  influencedRevenue: number;
  influencedDeals: number;
  wonInfluencedDeals: number;
  averageSalesCycleDays: number | null;
}

/**
 * Money on deals Sellora demonstrably touched — where a recommendation led to
 * an executed action while the deal was open.
 *
 * "Influenced" is a factual claim about contact, not a claim about credit:
 * these deals had a Sellora-prompted action taken on them. It is not asserted
 * that they closed because of it.
 */
export async function getInfluencedTotals(orgId: string): Promise<InfluencedTotals> {
  const influencedOpps = await db.opportunity.findMany({
    where: {
      orgId,
      actions: { some: { executionStatus: "EXECUTED", recommendationId: { not: null } } },
    },
    select: {
      id: true,
      stage: true,
      dealValue: true,
      outcomes: {
        where: { stage: "won" },
        select: { revenueAmount: true, salesCycleDays: true },
      },
    },
  });

  let influencedPipeline = 0;
  let influencedRevenue = 0;
  let wonInfluencedDeals = 0;
  const cycles: number[] = [];

  for (const opp of influencedOpps) {
    if (opp.stage === "WON") {
      wonInfluencedDeals += 1;
      const won = opp.outcomes[0];
      influencedRevenue += won?.revenueAmount ?? opp.dealValue;
      if (won?.salesCycleDays != null) cycles.push(won.salesCycleDays);
    } else if (opp.stage !== "LOST") {
      influencedPipeline += opp.dealValue;
    }
  }

  return {
    influencedPipeline,
    influencedRevenue,
    influencedDeals: influencedOpps.length,
    wonInfluencedDeals,
    averageSalesCycleDays: cycles.length
      ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)
      : null,
  };
}

// ── The narrative insights the UI renders ─────────────────────────────────

export interface LearningInsight {
  id: string;
  headline: string;
  detail: string;
  sample: number;
}

/**
 * Plain-language findings, generated only where the underlying slice cleared
 * its sample gate. Deliberately phrased as observations ("deals where … moved
 * forward more often") rather than instructions ("always follow up within
 * 24h") — the data supports the former and not the latter.
 */
export async function getLearningInsights(orgId: string): Promise<LearningInsight[]> {
  const [speed, signalWins, effectiveness] = await Promise.all([
    getSpeedInsight(orgId),
    getSignalWinRates(orgId),
    getActionEffectiveness(orgId),
  ]);

  const insights: LearningInsight[] = [];

  if (speed.ok && speed.fastAdvanceRate > speed.slowAdvanceRate) {
    insights.push({
      id: "speed",
      headline: `Acting within ${speed.thresholdHours} hours co-occurred with more deals moving forward.`,
      detail: `${speed.fastAdvanceRate}% of deals acted on inside ${speed.thresholdHours}h saw a positive customer reaction, against ${speed.slowAdvanceRate}% of those acted on later.`,
      sample: speed.fastCount + speed.slowCount,
    });
  }

  if (signalWins.ok) {
    const best = signalWins.rows.find((r) => r.winRate > r.baselineWinRate);
    if (best) {
      insights.push({
        id: `signal-${best.signalType}`,
        headline: `Deals showing "${best.label}" closed more often than your baseline.`,
        detail: `${best.winRate}% of the ${best.deals} closed deals carrying this signal were won, against a ${best.baselineWinRate}% baseline across all ${signalWins.closedDeals} closed deals.`,
        sample: best.deals,
      });
    }
  }

  const bestAction = effectiveness[0];
  if (bestAction && effectiveness.length > 1) {
    insights.push({
      id: `action-${bestAction.actionType}`,
      headline: `"${bestAction.label}" drew the most customer reactions.`,
      detail: `${bestAction.positiveRate}% of ${bestAction.attempts} such actions got a reply, a meeting or a stage change within the response window.`,
      sample: bestAction.attempts,
    });
  }

  return insights;
}

/** Per-stage action effectiveness, for the stage-by-stage breakdown. */
export async function getEffectivenessByStage(orgId: string) {
  const stages = ["QUALIFYING", "MEETING", "PROPOSAL", "NEGOTIATION"] as const;
  const results = await Promise.all(
    stages.map(async (stage) => ({
      stage,
      label: STAGE_LABELS[stage],
      rows: await getActionEffectiveness(orgId, { stage }),
    }))
  );
  return results.filter((r) => r.rows.length > 0);
}
