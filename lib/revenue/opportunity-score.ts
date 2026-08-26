import {
  DIMENSION_LABELS,
  DIMENSION_MAX,
  DIMENSION_MIN,
  ENGAGEMENT_WEIGHTS,
  FIT_WEIGHTS,
  RELATIONSHIP_BONUS,
  REVENUE_CONFIG_VERSION,
  SIGNAL_SATURATION_SCORE,
  SILENCE_PENALTIES,
  STAGE_WIN_BASELINE,
  isOpenStage,
  scoreBand,
  type OpportunityStage,
  type ScoreDimension,
} from "@/lib/revenue/config";
import { computeIntentScore, type Confidence, type ScorableSignal } from "@/lib/intent/scoring";
import { clampProbability, expectedRevenue } from "@/lib/revenue/money";

/**
 * The Opportunity Score (§5): one explainable 0–100 number built from five
 * named dimensions, each of which reports its own points and the reason
 * those points were awarded.
 *
 * Like lib/intent/scoring.ts this is pure and deterministic — no AI, no DB,
 * no clock except the injectable `now`. That matters for two reasons: it is
 * unit-testable, and every number the UI shows can be traced to a rule a
 * human can read. Nothing here is a black box, because §5 forbids showing
 * an unexplained score.
 *
 * The AI layer never produces the number. It only narrates it afterwards.
 */

export interface ScoreFactorResult {
  dimension: ScoreDimension;
  ruleKey: string;
  label: string;
  points: number;
  reason: string;
}

export interface OpportunityScoreInput {
  stage: OpportunityStage | string;
  dealValue: number;

  /** Non-expired buying signals for the account. */
  signals: ScorableSignal[];

  /** ICP attributes that the account matches. */
  fit: {
    industryMatch?: boolean;
    companySizeMatch?: boolean;
    regionMatch?: boolean;
    buyerTitleMatch?: boolean;
    /** True when the workspace has no ICP yet — fit is then unknown, not zero. */
    icpUnknown?: boolean;
  };

  /** Observed interactions on this opportunity. */
  engagement: {
    emailsOpened: number;
    emailsReplied: number;
    meetingsHeld: number;
    proposalsSent: number;
    siteVisits: number;
    /** Outbound messages sent since the prospect last responded. */
    unansweredOutbound: number;
  };

  lastInteractionAt: Date | null;
  /** True when the most recent interaction came *from* the prospect. */
  theyRepliedLast: boolean;

  /** The workspace's ICP deal range, for the economics dimension. */
  icpDealRange?: { min: number | null; max: number | null };
}

export interface OpportunityScoreResult {
  score: number;
  band: "hot" | "warm" | "cold";
  confidence: Confidence;
  winProbability: number;
  expectedValue: number;
  /** 1–4 concrete reasons, most significant first — signed, so the UI can
   * render "+ Pricing page visited 4×" and "− No follow-up in 3 days". */
  whyNow: string[];
  factors: ScoreFactorResult[];
  /** Per-dimension subtotals, for the score-breakdown bar. */
  dimensionTotals: Record<ScoreDimension, number>;
  version: number;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function clampDimension(dim: ScoreDimension, raw: number): number {
  return Math.max(DIMENSION_MIN[dim], Math.min(DIMENSION_MAX[dim], raw));
}

export function computeOpportunityScore(
  input: OpportunityScoreInput,
  now: Date = new Date()
): OpportunityScoreResult {
  const factors: ScoreFactorResult[] = [];
  const add = (
    dimension: ScoreDimension,
    ruleKey: string,
    points: number,
    reason: string,
    label?: string
  ) => {
    factors.push({
      dimension,
      ruleKey,
      label: label ?? DIMENSION_LABELS[dimension],
      points,
      reason,
    });
  };

  // ── 1. Customer fit ─────────────────────────────────────────────────────
  if (input.fit.icpUnknown) {
    add(
      "fit",
      "icp_missing",
      Math.round(DIMENSION_MAX.fit * 0.4),
      "No ICP defined yet — fit scored neutrally. Define your ICP for a sharper score.",
      "ICP not set"
    );
  } else {
    if (input.fit.industryMatch)
      add("fit", "industry_match", FIT_WEIGHTS.industryMatch, "Industry matches your ICP", "Industry match");
    if (input.fit.companySizeMatch)
      add("fit", "size_match", FIT_WEIGHTS.companySizeMatch, "Company size is in your target range", "Size match");
    if (input.fit.regionMatch)
      add("fit", "region_match", FIT_WEIGHTS.regionMatch, "Located in a region you sell to", "Region match");
    if (input.fit.buyerTitleMatch)
      add("fit", "title_match", FIT_WEIGHTS.buyerTitleMatch, "Contact holds a target buyer title", "Decision maker engaged");

    if (!factors.some((f) => f.dimension === "fit")) {
      add("fit", "no_fit_match", 0, "No ICP attributes matched — this account may be off-target.", "No ICP match");
    }
  }

  // ── 2. Engagement ───────────────────────────────────────────────────────
  const e = input.engagement;
  if (e.emailsReplied > 0)
    add(
      "engagement",
      "email_replied",
      ENGAGEMENT_WEIGHTS.emailReplied * Math.min(2, e.emailsReplied),
      `Replied to your outreach ${e.emailsReplied}×`,
      "Replies"
    );
  if (e.meetingsHeld > 0)
    add(
      "engagement",
      "meeting_held",
      ENGAGEMENT_WEIGHTS.meetingHeld * Math.min(2, e.meetingsHeld),
      `${e.meetingsHeld} meeting${e.meetingsHeld === 1 ? "" : "s"} held`,
      "Meetings"
    );
  if (e.proposalsSent > 0)
    add("engagement", "proposal_sent", ENGAGEMENT_WEIGHTS.proposalSent, "Proposal has been sent", "Proposal");
  if (e.siteVisits > 0)
    add(
      "engagement",
      "site_visit",
      ENGAGEMENT_WEIGHTS.siteVisit * Math.min(3, e.siteVisits),
      `Visited your site ${e.siteVisits}×`,
      "Site visits"
    );
  if (e.emailsOpened > 0)
    add(
      "engagement",
      "email_opened",
      ENGAGEMENT_WEIGHTS.emailOpened * Math.min(3, e.emailsOpened),
      `Opened ${e.emailsOpened} of your emails`,
      "Opens"
    );
  if (!factors.some((f) => f.dimension === "engagement"))
    add("engagement", "no_engagement", 0, "No recorded engagement yet.", "No engagement");

  // ── 3. Buying signals ───────────────────────────────────────────────────
  // Delegates to the existing intent scorer, then rescales its 0–100 output
  // into this dimension's budget. One scoring model, two consumers.
  const intent = computeIntentScore(input.signals, 0, now);
  const signalPoints = Math.round(
    Math.min(1, intent.score / SIGNAL_SATURATION_SCORE) * DIMENSION_MAX.buying_signals
  );
  if (intent.score > 0) {
    const top = intent.components
      .filter((c) => c.ruleKey !== "no_signals" && c.ruleKey !== "conflict_penalty")
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((c) => c.label);
    add(
      "buying_signals",
      "intent_score",
      signalPoints,
      // Lead with what actually happened. The numeric intent score stays
      // available in the breakdown, but a rep reading "why now" wants the
      // evidence, not the model's internal scale.
      top.length ? top.join(", ") : `Intent score ${intent.score}/100`,
      "Buying signals"
    );
  } else {
    add("buying_signals", "no_signals", 0, "No active buying signals detected.", "No signals");
  }

  // ── 4. Relationship health ──────────────────────────────────────────────
  if (input.lastInteractionAt) {
    const quietDays = daysBetween(input.lastInteractionAt, now);
    const penalty = SILENCE_PENALTIES.find((p) => quietDays >= p.minDays);
    if (penalty) {
      add(
        "relationship_health",
        "silence",
        penalty.points,
        `${penalty.label} (${Math.floor(quietDays)} days since last contact)`,
        "Gone quiet"
      );
    } else {
      add(
        "relationship_health",
        "recent_contact",
        RELATIONSHIP_BONUS.contactedThisWeek,
        `Contacted ${Math.floor(quietDays)} day${Math.floor(quietDays) === 1 ? "" : "s"} ago`,
        "Recent contact"
      );
    }
    if (input.theyRepliedLast)
      add(
        "relationship_health",
        "they_replied_last",
        RELATIONSHIP_BONUS.theyRepliedLast,
        "They responded last — the relationship is live",
        "Two-way conversation"
      );
  } else {
    add("relationship_health", "never_contacted", 0, "No interaction recorded yet.", "Never contacted");
  }

  if (e.unansweredOutbound > 0) {
    const points = Math.max(
      RELATIONSHIP_BONUS.maxUnansweredPenalty,
      RELATIONSHIP_BONUS.unansweredOutboundPenalty * e.unansweredOutbound
    );
    add(
      "relationship_health",
      "unanswered_outbound",
      points,
      `${e.unansweredOutbound} message${e.unansweredOutbound === 1 ? "" : "s"} sent without a response`,
      "Unanswered messages"
    );
  }

  // ── 5. Deal economics ───────────────────────────────────────────────────
  const range = input.icpDealRange;
  if (range?.min != null && range?.max != null && range.max > range.min) {
    const pos = (input.dealValue - range.min) / (range.max - range.min);
    const points = Math.round(Math.max(0, Math.min(1, pos)) * DIMENSION_MAX.deal_economics);
    add(
      "deal_economics",
      "deal_size",
      points,
      pos >= 0.66
        ? "Deal size is at the top of your typical range"
        : pos >= 0.33
          ? "Deal size is mid-range for your business"
          : "Smaller than your typical deal",
      "Deal size"
    );
  } else {
    add(
      "deal_economics",
      "deal_size_unknown",
      Math.round(DIMENSION_MAX.deal_economics * 0.5),
      "No ICP deal range set — economics scored neutrally.",
      "Deal size"
    );
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const dimensionTotals = {} as Record<ScoreDimension, number>;
  for (const dim of Object.keys(DIMENSION_MAX) as ScoreDimension[]) {
    const raw = factors
      .filter((f) => f.dimension === dim)
      .reduce((sum, f) => sum + f.points, 0);
    dimensionTotals[dim] = clampDimension(dim, raw);
  }

  const score = Math.max(
    0,
    Math.min(100, Object.values(dimensionTotals).reduce((a, b) => a + b, 0))
  );

  // ── Win probability ─────────────────────────────────────────────────────
  // The stage sets the baseline; the score modulates it within ±40%. A closed
  // stage is not an estimate at all — it is a fact.
  const stage = input.stage as OpportunityStage;
  const baseline = STAGE_WIN_BASELINE[stage] ?? 5;
  const winProbability = isOpenStage(stage)
    ? clampProbability(Math.max(1, Math.min(95, baseline * (0.6 + (score / 100) * 0.8))))
    : baseline;

  // ── Confidence ──────────────────────────────────────────────────────────
  // Inherits the signal scorer's confidence, downgraded when we are scoring
  // largely in the dark.
  let confidence: Confidence = intent.confidence;
  const thinEvidence =
    input.signals.length === 0 &&
    e.emailsReplied === 0 &&
    e.meetingsHeld === 0;
  if (thinEvidence) confidence = "low";
  else if (input.fit.icpUnknown && confidence === "high") confidence = "medium";

  // ── Why now ─────────────────────────────────────────────────────────────
  // Sorted by absolute impact so the biggest negative can outrank a small
  // positive — the reason a deal is slipping is often the headline.
  const whyNow = [...factors]
    .filter((f) => f.points !== 0)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 4)
    .map((f) => `${f.points > 0 ? "+" : "−"} ${f.reason}`);

  return {
    score,
    band: scoreBand(score),
    confidence,
    winProbability,
    expectedValue: expectedRevenue(input.dealValue, winProbability),
    whyNow: whyNow.length ? whyNow : ["Not enough evidence to score this opportunity yet."],
    factors,
    dimensionTotals,
    version: REVENUE_CONFIG_VERSION,
  };
}

/** Human label for a score, e.g. "87 — High purchase intent". */
export function scoreHeadline(score: number): string {
  if (score >= 85) return "High purchase intent";
  if (score >= 70) return "Strong interest";
  if (score >= 55) return "Warming up";
  if (score >= 40) return "Early interest";
  return "Low engagement";
}
