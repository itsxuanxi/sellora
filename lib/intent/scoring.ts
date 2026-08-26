import {
  CONFIDENCE_RULES,
  RECENCY_DECAY,
  SCORE_BANDS,
  SCORING_CONFIG_VERSION,
  SIGNAL_LABELS,
  SIGNAL_WEIGHTS,
  type SignalType,
} from "@/lib/intent/config";

/**
 * The explainable rule-based Buying Intent scorer. Pure and deterministic —
 * no AI, no DB access — so it's trivially unit-testable and its output is
 * always reproducible from its input. `computeIntentScore` is the only
 * function that decides the number; everything else (AI) only explains it
 * in prose afterward.
 */

export type Confidence = "low" | "medium" | "high";

export interface ScorableSignal {
  id?: string;
  signalType: SignalType | string;
  occurredAt: Date;
  confidence: Confidence;
  expired?: boolean;
}

export interface ScoreComponentResult {
  signalId: string | null;
  ruleKey: string;
  label: string;
  points: number;
  reason: string;
}

export interface IntentScoreResult {
  score: number;
  confidence: Confidence;
  whyNow: string[];
  components: ScoreComponentResult[];
  version: number;
}

function ageInDays(occurredAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - occurredAt.getTime()) / (1000 * 60 * 60 * 24));
}

function recencyMultiplier(days: number): number {
  for (const bucket of RECENCY_DECAY) {
    if (days <= bucket.maxAgeDays) return bucket.multiplier;
  }
  return RECENCY_DECAY[RECENCY_DECAY.length - 1].multiplier;
}

function isKnownSignalType(t: string): t is SignalType {
  return t in SIGNAL_WEIGHTS;
}

/**
 * @param signals        Non-expired signals are still safe to pass in — this
 *                        function re-checks `expired` itself, but the caller
 *                        (lib/intent/signals.ts) should already exclude them
 *                        via IntentScoreSnapshot's query.
 * @param conflictCount   Number of detected contradictory signal pairs for
 *                        this account (0 if none / not computed). MVP does
 *                        not ship an automatic conflict detector — see
 *                        lib/intent/signals.ts for where this would plug in.
 * @param now             Injectable for deterministic tests.
 */
export function computeIntentScore(
  signals: ScorableSignal[],
  conflictCount = 0,
  now: Date = new Date()
): IntentScoreResult {
  const active = signals.filter((s) => !s.expired && isKnownSignalType(s.signalType));

  const components: ScoreComponentResult[] = [];
  let total = 0;

  for (const s of active) {
    const type = s.signalType as SignalType;
    const base = SIGNAL_WEIGHTS[type];
    const days = ageInDays(s.occurredAt, now);
    const mult = recencyMultiplier(days);
    const points = Math.round(base * mult);
    total += points;

    const ageNote =
      days <= 7
        ? "this week"
        : days <= 30
          ? `${Math.round(days)}d ago`
          : `${Math.round(days)}d ago — decayed`;

    components.push({
      signalId: s.id ?? null,
      ruleKey: type,
      label: SIGNAL_LABELS[type],
      points,
      reason: `${SIGNAL_LABELS[type]} (${ageNote}): ${base >= 0 ? "+" : ""}${base} base × ${mult.toFixed(2)} recency = ${points >= 0 ? "+" : ""}${points}`,
    });
  }

  if (active.length === 0) {
    components.push({
      signalId: null,
      ruleKey: "no_signals",
      label: "No signals",
      points: 0,
      reason: "No qualifying buying signals found for this company yet.",
    });
  }

  const score = Math.max(0, Math.min(100, total));

  // ── confidence ──
  const distinctTypes = new Set(active.map((s) => s.signalType)).size;
  const anyLowConfidenceSignal = active.some((s) => s.confidence === "low");

  let confidence: Confidence = "high";
  if (conflictCount > 0) {
    confidence = CONFIDENCE_RULES.conflictCap;
    components.push({
      signalId: null,
      ruleKey: "conflict_penalty",
      label: "Conflicting signals",
      points: 0,
      reason: `${conflictCount} conflicting signal pair(s) detected — confidence capped at "${CONFIDENCE_RULES.conflictCap}".`,
    });
  } else if (distinctTypes < CONFIDENCE_RULES.minDistinctSignalsForHigh || anyLowConfidenceSignal) {
    confidence = CONFIDENCE_RULES.singleLowConfidenceSignalCap;
  } else {
    confidence = "high";
  }
  if (active.length === 0) confidence = "low";

  // ── why now (top 3 by absolute points) ──
  const whyNow = [...components]
    .filter((c) => c.ruleKey !== "no_signals" && c.ruleKey !== "conflict_penalty")
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((c) => c.reason.split(":")[0] + (c.reason.includes(":") ? ":" + c.reason.split(":").slice(1).join(":") : ""));

  return {
    score,
    confidence,
    whyNow: whyNow.length > 0 ? whyNow : ["Insufficient evidence — no qualifying signals yet."],
    components,
    version: SCORING_CONFIG_VERSION,
  };
}

export function scoreBand(score: number): "hot" | "warm" | "cold" {
  if (score >= SCORE_BANDS.hot) return "hot";
  if (score >= SCORE_BANDS.warm) return "warm";
  return "cold";
}
