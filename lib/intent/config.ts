/**
 * All Buying-Intent scoring weights live here — nowhere else. If you're
 * tuning the model, this is the only file you should need to touch.
 *
 * Bump SCORING_CONFIG_VERSION whenever weights change; every
 * IntentScoreSnapshot stores the version it was computed under, so past
 * scores stay auditable even after the config moves on.
 */

// v2 — added the behavioural/engagement signal family (pricing-page visits,
// proposal opens, multi-stakeholder activity) alongside the original
// firmographic hiring signals. Old snapshots keep version 1 and stay readable.
export const SCORING_CONFIG_VERSION = 2;

export type SignalType =
  // ── Behavioural: things the buyer did (strongest, freshest intent) ──
  | "pricing_page_viewed" // looked at pricing
  | "demo_page_viewed" // looked at the demo/product page
  | "repeat_site_visit" // came back to the site again
  | "proposal_opened" // opened the proposal you sent
  | "email_replied" // replied to outreach
  | "meeting_attended" // showed up to a call
  | "multi_stakeholder" // a second person from the account engaged
  | "competitor_research" // comparison/alternatives activity
  | "trial_usage_up" // product usage accelerating
  | "reactivated_account" // dormant account became active again
  // ── Firmographic: things that happened to the company ──
  | "job_surge" // 5+ new postings in a short window
  | "stale_role" // same role open 30+ days
  | "repeated_role_posting" // same role type posted repeatedly
  | "hiring_velocity_up" // postings pace has accelerated
  | "funding_round" // raised money recently
  | "new_region" // expanding into a new market
  | "new_hiring_leader" // new head of TA / People / relevant exec
  | "hard_to_fill_role" // a role in a hard-to-hire specialty
  | "headcount_growth" // employee count growing quickly
  | "leadership_change" // new exec in the buying centre
  | "product_launch"; // shipped something that changes their needs

/** Behavioural signals are what the *buyer* did; firmographic signals are
 * what happened *to* the company. The UI groups the timeline by this. */
export const BEHAVIOURAL_SIGNALS: SignalType[] = [
  "pricing_page_viewed",
  "demo_page_viewed",
  "repeat_site_visit",
  "proposal_opened",
  "email_replied",
  "meeting_attended",
  "multi_stakeholder",
  "competitor_research",
  "trial_usage_up",
  "reactivated_account",
];

export const FIRMOGRAPHIC_SIGNALS: SignalType[] = [
  "job_surge",
  "stale_role",
  "repeated_role_posting",
  "hiring_velocity_up",
  "funding_round",
  "new_region",
  "new_hiring_leader",
  "hard_to_fill_role",
  "headcount_growth",
  "leadership_change",
  "product_launch",
];

export const SIGNAL_TYPES: SignalType[] = [
  ...BEHAVIOURAL_SIGNALS,
  ...FIRMOGRAPHIC_SIGNALS,
];

export function signalFamily(t: SignalType | string): "behavioural" | "firmographic" {
  return (BEHAVIOURAL_SIGNALS as string[]).includes(t) ? "behavioural" : "firmographic";
}

export const SIGNAL_LABELS: Record<SignalType, string> = {
  pricing_page_viewed: "Pricing page viewed",
  demo_page_viewed: "Demo page viewed",
  repeat_site_visit: "Returned to the site",
  proposal_opened: "Proposal opened",
  email_replied: "Replied to outreach",
  meeting_attended: "Attended a meeting",
  multi_stakeholder: "Second stakeholder engaged",
  competitor_research: "Comparing alternatives",
  trial_usage_up: "Trial usage increasing",
  reactivated_account: "Dormant account active again",
  job_surge: "Sudden hiring surge",
  stale_role: "Role open a long time",
  repeated_role_posting: "Same role posted repeatedly",
  hiring_velocity_up: "Hiring pace increasing",
  funding_round: "Recently funded",
  new_region: "Expanding into a new region",
  new_hiring_leader: "New hiring/business leader",
  hard_to_fill_role: "Hard-to-fill specialty role open",
  headcount_growth: "Headcount growing quickly",
  leadership_change: "Leadership change in the buying centre",
  product_launch: "Launched a new product",
};

/** Base points awarded when a signal of this type is present and fresh.
 * Behavioural signals outweigh firmographic ones: someone opening your
 * proposal is a far better predictor than their headcount trend. */
export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  // behavioural
  proposal_opened: 25,
  pricing_page_viewed: 22,
  multi_stakeholder: 22,
  email_replied: 20,
  meeting_attended: 20,
  demo_page_viewed: 18,
  trial_usage_up: 18,
  reactivated_account: 16,
  repeat_site_visit: 14,
  competitor_research: 12,
  // firmographic
  job_surge: 20,
  funding_round: 20,
  hard_to_fill_role: 20,
  stale_role: 15,
  repeated_role_posting: 15,
  hiring_velocity_up: 15,
  new_hiring_leader: 15,
  leadership_change: 15,
  product_launch: 12,
  headcount_growth: 10,
  new_region: 10,
};

/**
 * Recency decay: a signal's weight is multiplied by the factor for the
 * oldest bucket it falls into (by days since `occurredAt`). Signals past
 * `expiresAt` are excluded entirely before this ever applies.
 */
export const RECENCY_DECAY: { maxAgeDays: number; multiplier: number }[] = [
  { maxAgeDays: 30, multiplier: 1 },
  { maxAgeDays: 60, multiplier: 0.7 },
  { maxAgeDays: 90, multiplier: 0.4 },
  { maxAgeDays: Infinity, multiplier: 0.15 },
];

/** How long each signal type stays valid before it's excluded from scoring.
 * Behavioural signals go stale fast — a pricing-page visit from six weeks ago
 * says almost nothing about intent today. */
export const SIGNAL_TTL_DAYS: Record<SignalType, number> = {
  // behavioural — short-lived
  pricing_page_viewed: 21,
  demo_page_viewed: 21,
  repeat_site_visit: 14,
  proposal_opened: 30,
  email_replied: 30,
  meeting_attended: 45,
  multi_stakeholder: 45,
  competitor_research: 21,
  trial_usage_up: 21,
  reactivated_account: 30,
  // firmographic — longer-lived
  job_surge: 45,
  stale_role: 60,
  repeated_role_posting: 60,
  hiring_velocity_up: 45,
  funding_round: 180,
  new_hiring_leader: 120,
  headcount_growth: 90,
  hard_to_fill_role: 60,
  new_region: 120,
  leadership_change: 120,
  product_launch: 90,
};

/** Confidence starts here and is downgraded by the rules below. */
export const BASE_CONFIDENCE = "high" as const;

export const CONFIDENCE_RULES = {
  /** Any single-source, unverified signal caps confidence at this level. */
  singleLowConfidenceSignalCap: "medium" as const,
  /** Conflicting signals (e.g. headcount growth + mass layoff-style signal) cap here. */
  conflictCap: "low" as const,
  /** Minimum number of *distinct* signal types needed to reach "high". */
  minDistinctSignalsForHigh: 2,
};

export const SCORE_BANDS = {
  hot: 70, // >= this → "hot", surfaced first
  warm: 40, // >= this → "warm"
  // below warm → "cold", still shown but deprioritized
};

/** Minimum Intent Score a campaign can require before a company surfaces. */
export const DEFAULT_MIN_INTENT_SCORE = 50;

export const DEFAULT_DAILY_RECOMMENDATIONS = 10;
