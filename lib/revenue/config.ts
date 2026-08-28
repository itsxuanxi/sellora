/**
 * Every tunable number in the Revenue Intelligence layer lives here — the
 * scoring weights, the stage win-rate baselines, and the leak thresholds.
 * If you are calibrating Selryn against a real pipeline, this is the only
 * file you should need to touch.
 *
 * Bump REVENUE_CONFIG_VERSION whenever these change: every
 * OpportunityScoreSnapshot stores the version it was computed under, so old
 * scores stay interpretable after the model moves on.
 */

export const REVENUE_CONFIG_VERSION = 1;

// ── Opportunity stages ────────────────────────────────────────────────────

export const OPPORTUNITY_STAGES = [
  "NEW",
  "QUALIFYING",
  "MEETING",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPEN_STAGES: OpportunityStage[] = [
  "NEW",
  "QUALIFYING",
  "MEETING",
  "PROPOSAL",
  "NEGOTIATION",
];

export function isOpenStage(stage: string): boolean {
  return (OPEN_STAGES as string[]).includes(stage);
}

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  NEW: "New",
  QUALIFYING: "Qualifying",
  MEETING: "Meeting",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

/**
 * Baseline win rate for a deal sitting at each stage, before Selryn's score
 * adjusts it. These are deliberately conservative industry-shaped defaults,
 * NOT learned from this workspace's history — `winProbability` is an
 * estimate and the UI labels it as one.
 */
export const STAGE_WIN_BASELINE: Record<OpportunityStage, number> = {
  NEW: 5,
  QUALIFYING: 15,
  MEETING: 30,
  PROPOSAL: 50,
  NEGOTIATION: 70,
  WON: 100,
  LOST: 0,
};

/** One line explaining what the stage's win baseline means, shown on the
 * detail page so the likelihood figure is never an unexplained number. */
export const STAGE_HELP: Record<OpportunityStage, string> = {
  NEW: "New opportunities close about 5% of the time before qualification. The score adjusts this up or down.",
  QUALIFYING: "Qualified-but-unmet deals convert around 15%. Getting to a live conversation is what moves this.",
  MEETING: "Deals that reach a meeting convert around 30%. A concrete next step is the biggest lever from here.",
  PROPOSAL: "Deals with a proposal out convert around 50%. Response speed after a proposal open matters most.",
  NEGOTIATION: "Deals in negotiation convert around 70%. Delay is now the main risk, not fit.",
  WON: "Closed won.",
  LOST: "Closed lost. Selryn keeps watching for new buying signals from this account.",
};

/** How long a deal should sit in a stage before silence is suspicious. */
export const STAGE_EXPECTED_CADENCE_DAYS: Record<OpportunityStage, number> = {
  NEW: 3,
  QUALIFYING: 5,
  MEETING: 5,
  PROPOSAL: 4,
  NEGOTIATION: 3,
  WON: Infinity,
  LOST: Infinity,
};

// ── Opportunity Score: the five dimensions of §5 ──────────────────────────

export type ScoreDimension =
  | "fit"
  | "engagement"
  | "buying_signals"
  | "relationship_health"
  | "deal_economics";

export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  fit: "Customer fit",
  engagement: "Engagement",
  buying_signals: "Buying signals",
  relationship_health: "Relationship health",
  deal_economics: "Deal economics",
};

/**
 * Maximum points each dimension can contribute. They sum to 100, so a
 * score is always directly readable as "out of 100" with no hidden
 * normalisation. relationship_health is the only dimension that can go
 * negative — silence actively destroys a deal, it does not merely fail to
 * help it.
 */
export const DIMENSION_MAX: Record<ScoreDimension, number> = {
  fit: 20,
  engagement: 25,
  buying_signals: 30,
  relationship_health: 15,
  deal_economics: 10,
};

export const DIMENSION_MIN: Record<ScoreDimension, number> = {
  fit: 0,
  engagement: 0,
  buying_signals: 0,
  // Silence hurts, but the leak layer already carries urgency separately.
  // A deeper floor here produced the contradictory pairing of a low score
  // next to a critical "act now" — the deal is *good* and *at risk*, and
  // those are two different statements the UI makes in two different places.
  relationship_health: -12,
  deal_economics: 0,
};

/** Customer-fit points per ICP attribute that matches. */
export const FIT_WEIGHTS = {
  industryMatch: 6,
  companySizeMatch: 5,
  regionMatch: 4,
  buyerTitleMatch: 5,
};

/** Engagement points per observed interaction type (before caps). */
export const ENGAGEMENT_WEIGHTS = {
  emailOpened: 3,
  emailReplied: 9,
  meetingHeld: 10,
  proposalSent: 8,
  siteVisit: 4,
};

/** Relationship-health penalties by days since the last interaction. */
export const SILENCE_PENALTIES: { minDays: number; points: number; label: string }[] = [
  { minDays: 21, points: -12, label: "No contact in 3+ weeks" },
  { minDays: 14, points: -9, label: "No contact in 2+ weeks" },
  { minDays: 7, points: -5, label: "No contact in a week" },
  { minDays: 4, points: -2, label: "Quiet for several days" },
];

/**
 * The intent score at which the buying-signals dimension pays out in full.
 *
 * Set below 100 deliberately: the underlying intent scale saturates well
 * short of its ceiling in practice — three strong, fresh signals land around
 * 65-70 — so a linear intent/100 mapping systematically under-credited
 * genuinely hot accounts and compressed every real deal into the 30s.
 */
export const SIGNAL_SATURATION_SCORE = 70;

/**
 * Probability that a closed-lost deal showing fresh intent can be reopened.
 * Used instead of the (correctly) zero win probability on a lost deal, so a
 * revival opportunity is priced as recoverable rather than shown as "$0".
 */
export const REOPEN_PROBABILITY = 15;

/** Positive relationship health for a responsive, recently-touched deal. */
export const RELATIONSHIP_BONUS = {
  contactedThisWeek: 6,
  theyRepliedLast: 9, // the ball is in your court and they are warm
  unansweredOutboundPenalty: -4, // per unanswered outbound, capped
  maxUnansweredPenalty: -12,
};

export const SCORE_BANDS = {
  hot: 70,
  warm: 40,
};

export function scoreBand(score: number): "hot" | "warm" | "cold" {
  if (score >= SCORE_BANDS.hot) return "hot";
  if (score >= SCORE_BANDS.warm) return "warm";
  return "cold";
}

// ── Leak detection (§4, §8) ───────────────────────────────────────────────

export type LeakType =
  | "needs_follow_up"
  | "going_cold"
  | "high_intent_no_response"
  | "proposal_viewed_no_followup"
  | "meeting_no_next_step"
  | "lost_with_new_signal";

export type LeakSeverity = "critical" | "warning" | "watch";

export interface LeakRule {
  type: LeakType;
  /** Section heading on the Recover page (§8 categories). */
  category: string;
  severity: LeakSeverity;
  /** Short description of what the rule looks for, shown in the UI. */
  detects: string;
  /** The action this leak implies — feeds the Next Best Action engine. */
  recommends: ActionType;
}

/** Ordered by how much money the rule typically protects — the first rule
 * that fires for an opportunity is the one shown, so order matters. */
export const LEAK_RULES: LeakRule[] = [
  {
    type: "proposal_viewed_no_followup",
    category: "Proposal viewed",
    severity: "critical",
    detects: "They opened the proposal and nobody followed up",
    recommends: "follow_up",
  },
  {
    type: "high_intent_no_response",
    category: "High intent, no response",
    severity: "critical",
    detects: "Strong buying signals but no reply to your outreach",
    recommends: "call",
  },
  {
    type: "meeting_no_next_step",
    category: "Meeting completed, no next step",
    severity: "warning",
    detects: "A meeting happened and nothing was scheduled after it",
    recommends: "book_meeting",
  },
  {
    type: "needs_follow_up",
    category: "Needs follow-up",
    severity: "warning",
    detects: "The next step is past due",
    recommends: "follow_up",
  },
  {
    type: "going_cold",
    category: "Going cold",
    severity: "warning",
    detects: "An engaged deal has gone quiet",
    recommends: "reengage",
  },
  {
    type: "lost_with_new_signal",
    category: "Previously lost — new buying signal",
    severity: "watch",
    detects: "A closed-lost account is showing fresh intent",
    recommends: "reengage",
  },
];

export const LEAK_RULE_BY_TYPE: Record<LeakType, LeakRule> = Object.fromEntries(
  LEAK_RULES.map((r) => [r.type, r])
) as Record<LeakType, LeakRule>;

/** Thresholds the leak rules test against. */
export const LEAK_THRESHOLDS = {
  /** Proposal opened and untouched for this many days → critical. */
  proposalFollowUpDays: 2,
  /** An engaged deal quiet for this many days is "going cold". */
  goingColdDays: 7,
  /** After a meeting, a next step should exist within this many days. */
  meetingNextStepDays: 3,
  /** Minimum opportunity score for "high intent, no response" to apply. */
  highIntentScore: 65,
  /** How recent a signal must be to revive a lost deal. */
  lostRevivalSignalDays: 30,
};

// ── Next Best Action (§7) ─────────────────────────────────────────────────

export type ActionType =
  | "follow_up"
  | "call"
  | "book_meeting"
  | "send_case_study"
  | "send_pricing"
  | "send_proposal"
  | "qualify"
  | "escalate_founder"
  | "reengage"
  | "wait"
  | "close_lost";

export const ACTION_LABELS: Record<ActionType, string> = {
  follow_up: "Send a follow-up",
  call: "Call the prospect",
  book_meeting: "Book the next meeting",
  send_case_study: "Send a case study",
  send_pricing: "Send pricing",
  send_proposal: "Send the proposal",
  qualify: "Ask a qualification question",
  escalate_founder: "Bring the founder in",
  reengage: "Re-engage a cold prospect",
  wait: "Wait — no action needed",
  close_lost: "Close as lost",
};

export type Urgency = "now" | "today" | "this_week" | "monitor";

export const URGENCY_LABELS: Record<Urgency, string> = {
  now: "Right now",
  today: "Today",
  this_week: "This week",
  monitor: "Monitor",
};

export const URGENCY_RANK: Record<Urgency, number> = {
  now: 0,
  today: 1,
  this_week: 2,
  monitor: 3,
};

/** How many opportunities "Today's Revenue Opportunities" surfaces (§6).
 * Deliberately small: the product's premise is that attention is scarce. */
export const DAILY_PRIORITY_COUNT = 5;

/** A deal must clear this expected value to be worth interrupting a rep for. */
export const MIN_EXPECTED_VALUE_TO_SURFACE = 0;
