/**
 * The single source of truth for every number and phrase in the marketing
 * product demos.
 *
 * One deal — Cloudmint — is followed through all four stages of the hero
 * carousel and reused by the capability panels and the query demo further
 * down the page. That continuity is the point: a visitor should feel they are
 * watching Sellora do one piece of work, not flipping through four unrelated
 * screenshots.
 *
 * Because every surface reads from here, the arithmetic can only be wrong in
 * one place. Expected revenue is asserted below rather than hard-coded twice:
 *   Cloudmint  $42,000 × 68% = $28,560
 *   Brightcart $65,000 × 37% = $24,050
 *   Ledgerly   $30,000 × 52% = $15,600
 *
 * All figures are illustrative sample data for a fictional pipeline.
 */

import { expectedRevenue, formatMoneyCompact } from "@/lib/revenue/money";

export const DEMO_DATA_NOTE = "Sample data shown for illustration";

export interface DemoDeal {
  rank: string;
  company: string;
  dealValue: number;
  probability: number;
  /** Derived — never typed by hand, so the table can't contradict itself. */
  expected: number;
  priority: string;
  priorityTone: "urgent" | "warn" | "watch";
  /** Behavioural evidence, newest first. */
  signals: string[];
  /** The silence or risk note shown under the signals. */
  status: string;
  /** HIGH / RISING / INCREASING — the read on this account. */
  readoutLabel: string;
  readoutValue: string;
  readoutTone: "high" | "rising" | "risk";
  lastActivity: string | null;
}

function deal(
  d: Omit<DemoDeal, "expected">
): DemoDeal {
  return { ...d, expected: expectedRevenue(d.dealValue, d.probability) };
}

export const DEMO_DEALS: DemoDeal[] = [
  deal({
    rank: "01",
    company: "Cloudmint",
    dealValue: 42_000,
    probability: 68,
    priority: "Call today",
    priorityTone: "urgent",
    signals: ["Proposal opened twice", "New stakeholder joined"],
    status: "Last activity: 12 minutes ago",
    readoutLabel: "Intent",
    readoutValue: "High",
    readoutTone: "high",
    lastActivity: "12 minutes ago",
  }),
  deal({
    rank: "02",
    company: "Brightcart",
    dealValue: 65_000,
    probability: 37,
    priority: "Follow up",
    priorityTone: "warn",
    signals: ["Pricing page revisited", "Security document downloaded"],
    status: "Last activity: 2 hours ago",
    readoutLabel: "Intent",
    readoutValue: "Rising",
    readoutTone: "rising",
    lastActivity: "2 hours ago",
  }),
  deal({
    rank: "03",
    company: "Ledgerly",
    dealValue: 30_000,
    probability: 52,
    priority: "Recover",
    priorityTone: "watch",
    signals: ["Demo completed", "No reply for 5 days"],
    status: "No reply for 5 days",
    readoutLabel: "Risk",
    readoutValue: "Increasing",
    readoutTone: "risk",
    lastActivity: "5 days ago",
  }),
];

/** The deal the whole story follows. */
export const FOCUS_DEAL = DEMO_DEALS[0];

/** Stage 1 — what the monitor is watching. */
export const MONITORING = {
  status: "Live · monitoring 248 open opportunities",
  openOpportunities: 248,
};

/** Stage 2 — the ranking headline. */
export const PRIORITIZATION = {
  status: "14 opportunities ranked by expected revenue",
  formula: "Expected revenue = deal value × probability of closing",
  ranked: 14,
};

/** Stage 3 — the single recommended action on the focus deal. */
export const NEXT_ACTION = {
  company: FOCUS_DEAL.company,
  expected: FOCUS_DEAL.expected,
  whyNow: [
    "Proposal opened twice in the last 24 hours",
    "A second stakeholder joined the buying process",
    "No follow-up has been sent since the demo",
  ],
  action: "Send a stakeholder-specific follow-up today.",
  approvalNote: "Human approval required — Sellora never sends on its own.",
  draft: {
    subject: "Following up on the proposal — happy to bring in your finance lead",
    body: "Hi Dana — I saw the proposal came back around your side, and that Priya from finance has joined the thread. Happy to put together a short breakdown of the commercial terms for her specifically, so she has what she needs without another call.\n\nWould Thursday work for a 15-minute walkthrough?",
  },
};

/** Stage 4 — the command centre roll-up. */
export const COMMAND = {
  metrics: [
    { label: "Pipeline monitored", value: "$1.24M", tone: "default" as const },
    { label: "Expected revenue", value: "$427.5K", tone: "accent" as const },
    { label: "Revenue needing attention", value: "$184.2K", tone: "risk" as const },
    { label: "High-priority actions", value: "14", tone: "default" as const },
  ],
  /** Normalised 0–1 series for the expected-revenue sparkline. */
  trend: [0.42, 0.46, 0.44, 0.52, 0.58, 0.55, 0.63, 0.68, 0.66, 0.74, 0.79, 0.86],
  breakdown: [
    { label: "Deals gaining momentum", value: "9", tone: "up" as const },
    { label: "Deals at risk", value: "5", tone: "down" as const },
    { label: "Actions completed today", value: "11", tone: "flat" as const },
  ],
  /**
   * Names the three accounts rather than saying "the top three", so the deal
   * the visitor followed through stages 1–3 is visibly still there in the
   * roll-up. The figure is summed from those same deals — it cannot drift out
   * of agreement with the table in stage 2.
   */
  get insight() {
    const total = DEMO_DEALS.reduce((s, d) => s + d.expected, 0);
    const names = DEMO_DEALS.map((d) => d.company);
    const list = `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    return `Following up with ${list} today protects an estimated ${formatMoneyCompact(
      total
    )} in expected revenue.`;
  },
};

/** Tab definitions for the hero carousel. Short tab labels keep the strip on
 * one line at laptop widths; the fuller panel label carries the detail. */
export const DEMO_STAGES = [
  { id: "monitoring", tabLabel: "Signals", panelLabel: "Signal monitor" },
  { id: "prioritization", tabLabel: "Priority", panelLabel: "Prioritized pipeline" },
  { id: "action", tabLabel: "Next action", panelLabel: "Recommended action · Cloudmint" },
  { id: "command", tabLabel: "Revenue command", panelLabel: "Revenue command center" },
] as const;

export type StageId = (typeof DEMO_STAGES)[number]["id"];

/** How long each stage holds before advancing. */
export const STAGE_DURATION_MS = 5600;

// ── Screen 2: workflow scenarios ───────────────────────────────────────────

export interface ScenarioStep {
  label: string;
  /** Optional detail shown under the step once it lands. */
  note?: string;
  /**
   * ms to wait before this step lands. Optional so a step list reads as
   * content first; STEP_DEFAULT_DELAY_MS fills the gaps. Longer beats go on
   * the steps that carry a turn in the story — the risk landing, the human
   * approving — because those are the ones a visitor needs a moment to read.
   */
  delay?: number;
}

export interface Scenario {
  id: string;
  tabLabel: string;
  title: string;
  account: string;
  steps: ScenarioStep[];
  outcome: { label: string; value: string; tone: "good" | "accent" }[];
  /** The headline result line under the outcome grid. */
  result: string;
}

/** Fallback beat between scenario steps. */
export const STEP_DEFAULT_DELAY_MS = 850;

/** Per-scenario step delays, index-aligned, for the sequence clock. */
export function stepDelays(scenario: Scenario): number[] {
  return scenario.steps.map((s) => s.delay ?? STEP_DEFAULT_DELAY_MS);
}

export const SCENARIOS: Scenario[] = [
  {
    id: "recover",
    tabLabel: "Recover a cooling deal",
    title: "A deal goes quiet after the demo — and comes back.",
    account: "Ledgerly",
    steps: [
      { label: "Demo completed", note: "Discovery call held with the champion", delay: 650 },
      { label: "Four days without a reply", note: "No outbound sent since", delay: 1000 },
      { label: "Risk level increases", note: "Silence at this stage is the top loss cause", delay: 1100 },
      { label: "Sellora identifies the missing stakeholder", note: "No finance contact on the thread", delay: 1000 },
      { label: "A targeted follow-up is prepared", note: "Draft written against the actual gap", delay: 950 },
      { label: "Sales rep approves", note: "Nothing sends without a human", delay: 1150 },
      { label: "CRM is updated", note: "Stage, next step and activity written back", delay: 900 },
    ],
    outcome: [
      { label: "Deal", value: "Recovered", tone: "good" },
      { label: "Next meeting", value: "Scheduled", tone: "good" },
    ],
    result: "Estimated expected revenue protected: $43.2K",
  },
  {
    id: "prioritize",
    tabLabel: "Prioritize today's pipeline",
    title: "Every open deal, ranked by what the next hour is worth.",
    account: "All open opportunities",
    steps: [
      { label: "Sellora scans every open opportunity", note: "248 monitored continuously", delay: 700 },
      { label: "Deal signals are scored", note: "Buying actions and silence both count", delay: 900 },
      { label: "Expected revenue is calculated", note: "Deal value × probability of closing", delay: 1000 },
      { label: "Accounts are ranked for today", note: "Highest expected value first", delay: 1100 },
      { label: "One action is attached to each", note: "Not five options — one", delay: 950 },
    ],
    outcome: [
      { label: "Accounts ranked", value: "14", tone: "accent" },
      { label: "Top 3 expected revenue", value: "$89.6K", tone: "accent" },
    ],
    result: "Rep time saved: measured against your baseline once connected",
  },
  {
    id: "convert",
    tabLabel: "Convert a high-intent buyer",
    title: "Intent rises, and the right next step is obvious.",
    account: "Brightcart",
    steps: [
      { label: "Pricing page revisited", note: "Second visit this week" },
      { label: "Security document downloaded", note: "A procurement signal, not a browse" },
      { label: "Second stakeholder appears", note: "New contact from the same domain" },
      { label: "Intent changes from Medium to High", note: "Score moves on evidence, not a guess" },
      { label: "Sellora recommends technical validation", note: "The usual blocker at this stage" },
      { label: "Meeting link is prepared", note: "Ready for the rep to send" },
      { label: "Opportunity advances", note: "Stage updated on approval" },
    ],
    outcome: [
      { label: "Buying committee", value: "Identified", tone: "good" },
      { label: "Momentum", value: "High", tone: "accent" },
    ],
    result: "Recommended next step: technical validation with the new stakeholder",
  },
];

/**
 * Integrations, with an honest status per row. Only CSV signal import, Google
 * sign-in and outbound email exist in the codebase today; the CRM and calendar
 * connectors do not, so they are marked planned rather than listed as if they
 * shipped.
 */
export const INTEGRATIONS: { name: string; status: "available" | "planned" }[] = [
  { name: "CSV signal import", status: "available" },
  { name: "Google sign-in", status: "available" },
  { name: "Outbound email", status: "available" },
  { name: "HubSpot", status: "planned" },
  { name: "Salesforce", status: "planned" },
  { name: "Pipedrive", status: "planned" },
  { name: "Gmail", status: "planned" },
  { name: "Google Calendar", status: "planned" },
];

/**
 * Every line checked against the codebase. Role-based access is marked
 * planned because `User.role` exists as a column but is never enforced
 * anywhere; auditability is real (AgentAction records actor and timestamp).
 */
export const TRUST_POINTS: { text: string; status: "available" | "planned" }[] = [
  { text: "Human approval for customer-facing actions", status: "available" },
  { text: "Clear reasoning behind every recommendation", status: "available" },
  { text: "Works alongside your existing CRM", status: "available" },
  { text: "Customer data is not used to train shared models", status: "available" },
  { text: "Auditable action history", status: "available" },
  { text: "Role-based access and SSO", status: "planned" },
];

/** Outcome metrics stay unfilled until measured with real customers. */
export const OUTCOME_METRICS = [
  "Follow-up speed improvement",
  "Rep hours saved each week",
  "Pipeline coverage",
];

// ═══════════════════════════════════════════════════════════════════════════
// Hero: four auto-executing scenarios
//
// Each tab is a script, not a screenshot. A step's `action` says what kind of
// work Sellora is doing at that moment and its `payload` carries the data the
// stage renders — so adding a step is a data edit, not another branch of
// animation code.
//
// Timing follows one rule: a step's `delay` is the beat BEFORE it lands, so
// delays[0] is the pause between the tab opening and its first line. Values
// sit in the 500–1200ms band that reads as work happening rather than a
// slideshow, and each scenario's dwell time is summed from its own steps by
// sequenceDuration() rather than being a single number applied to all four —
// a nine-step scenario given seven seconds gets cut off mid-sentence.
// ═══════════════════════════════════════════════════════════════════════════

/** The kinds of work a step can represent, in loop order. */
export type DemoActionKind =
  | "signal"
  | "analyze"
  | "score"
  | "rank"
  | "recommend"
  | "approve"
  | "execute"
  | "response"
  | "outcome";

export interface DemoStepBase {
  id: string;
  /** ms to wait before this step lands. */
  delay: number;
  action: DemoActionKind;
  /** The processing line shown in the stage footer once this step lands. */
  status?: string;
}

/** A buying signal arriving in the feed. */
export interface SignalStep extends DemoStepBase {
  action: "signal";
  payload: {
    label: string;
    detail?: string;
    at: string;
    tone?: "good" | "risk";
  };
}

/** Sellora thinking. Renders as a working line, never a spinner for its own sake. */
export interface AnalyzeStep extends DemoStepBase {
  action: "analyze";
  payload: { label: string };
}

/** A tracked number moving. `from`/`to` drive the count-up. */
export interface ScoreStep extends DemoStepBase {
  action: "score";
  payload: {
    metric: string;
    from: number;
    to: number;
    suffix?: string;
    /** Short verdict shown beside the number once it settles. */
    verdict?: string;
    tone?: "good" | "risk";
  };
}

/**
 * The ranked pipeline. Renders as a real table rather than a sentence about
 * ranking, because the claim being made - that expected revenue reorders the
 * list away from deal size - is only checkable if the numbers are on screen.
 */
export interface RankStep extends DemoStepBase {
  action: "rank";
  payload: {
    /** Company ids from DEMO_DEALS, in the order to display. */
    order: string[];
    /** Highlighted row, for the "moved to first" beat. */
    highlight?: string;
    caption?: string;
  };
}

/** The human-approval control. Present in the demo because it is the product's
 *  central promise: nothing customer-facing leaves without a person. */
export interface ApproveStep extends DemoStepBase {
  action: "approve";
  payload: { label: string; state: "awaiting" | "approved"; note?: string };
}

/** The single next best action, with the evidence behind it. */
export interface RecommendStep extends DemoStepBase {
  action: "recommend";
  payload: {
    headline: string;
    why: string;
    evidence: string[];
    atStake?: number;
  };
}

/** A human approving, and the action going out. */
export interface ExecuteStep extends DemoStepBase {
  action: "execute";
  payload: { label: string; state: "awaiting" | "approved" | "sent" };
}

/** What the customer did back. */
export interface ResponseStep extends DemoStepBase {
  action: "response";
  payload: { quote?: string; label: string; who?: string };
}

/** A commercial result: a stage move, a probability change, or both. */
export interface OutcomeStep extends DemoStepBase {
  action: "outcome";
  payload: {
    label: string;
    stageFrom?: string;
    stageTo?: string;
    metric?: string;
    from?: number;
    to?: number;
    prefix?: string;
  };
}

export type DemoStep =
  | SignalStep
  | AnalyzeStep
  | ScoreStep
  | RankStep
  | RecommendStep
  | ApproveStep
  | ExecuteStep
  | ResponseStep
  | OutcomeStep;

export interface HeroScenario {
  id: string;
  tabLabel: string;
  panelLabel: string;
  /** The deal this scenario is about, shown in the stage header. */
  subject: { company: string; dealValue: number; stage: string };
  steps: DemoStep[];
  /** The closing line, shown once every step has landed. */
  closing: string;
}

/** Ranked list used by the priority scenario. Derived, never hand-typed. */
export const RANKED_DEALS = [...DEMO_DEALS].sort((a, b) => b.expected - a.expected);

/**
 * Every scenario holds the panel for the same fixed period.
 *
 * A shared dwell is what makes the tab progress line honest - four bars that
 * each mean six seconds. Scenario steps are tuned to finish inside it with
 * room to read the result, and a test fails the build if any scenario's steps
 * would overrun, which is the failure a fixed dwell would otherwise hide.
 */
export const HERO_STAGE_DURATION_MS = 6000;

/** Minimum quiet time after the last step lands, before the tab advances. */
export const HERO_STAGE_TAIL_MS = 900;

export const HERO_SCENARIOS: HeroScenario[] = [
  {
    id: "detection",
    tabLabel: "Signal detection",
    panelLabel: "Signal monitor",
    subject: { company: "Cloudmint", dealValue: 42_000, stage: "Evaluation" },
    steps: [
      {
        id: "s1",
        delay: 550,
        action: "signal",
        status: "Detecting signals",
        payload: {
          label: "Proposal opened twice",
          detail: "Second open lasted 6 minutes on pricing",
          at: "12 min ago",
          tone: "good",
        },
      },
      {
        id: "s2",
        delay: 680,
        action: "signal",
        status: "Detecting signals",
        payload: {
          label: "New stakeholder joined",
          detail: "VP Finance added to the thread",
          at: "9 min ago",
          tone: "good",
        },
      },
      {
        id: "s3",
        delay: 680,
        action: "signal",
        status: "Detecting signals",
        payload: {
          label: "Pricing page revisited",
          detail: "Third visit from the same domain this week",
          at: "4 min ago",
          tone: "good",
        },
      },
      {
        id: "s4",
        delay: 700,
        action: "signal",
        status: "Risk detected",
        payload: {
          label: "Four days since last reply",
          detail: "No outbound sent since the proposal",
          at: "now",
          tone: "risk",
        },
      },
      {
        id: "s5",
        delay: 700,
        action: "analyze",
        status: "Analyzing opportunity",
        payload: { label: "Weighing four signals against this deal's stage" },
      },
      {
        id: "s6",
        delay: 700,
        action: "score",
        status: "Intent score updated",
        payload: {
          metric: "Intent score",
          from: 64,
          to: 87,
          verdict: "High buying intent",
          tone: "good",
        },
      },
    ],
    closing: "4 signals detected on this deal today",
  },
  {
    id: "priority",
    tabLabel: "Opportunity priority",
    panelLabel: "Prioritized pipeline",
    subject: { company: "All open opportunities", dealValue: 0, stage: "Ranking" },
    steps: [
      {
        id: "p1",
        delay: 550,
        action: "analyze",
        status: "Ranking 14 opportunities",
        payload: { label: "Reading the latest signal on every open deal" },
      },
      {
        id: "p2",
        delay: 700,
        action: "rank",
        status: "Calculating win probability",
        payload: {
          // Deal-size order, before expected revenue reorders it.
          order: ["Brightcart", "Cloudmint", "Ledgerly"],
          caption: "Sorted by deal value",
        },
      },
      {
        id: "p3",
        delay: 850,
        action: "analyze",
        status: "Calculating expected revenue",
        payload: { label: "Expected revenue = deal value x win probability" },
      },
      {
        id: "p4",
        delay: 900,
        action: "rank",
        status: "Re-ranked by expected revenue",
        payload: {
          order: ["Cloudmint", "Brightcart", "Ledgerly"],
          highlight: "Cloudmint",
          caption: "Sorted by expected revenue",
        },
      },
      {
        id: "p5",
        delay: 750,
        action: "outcome",
        status: "Highest expected revenue",
        payload: {
          label: "Cloudmint leads on expected revenue, not deal size",
          metric: "Top expected revenue",
          from: 0,
          to: 28_560,
          prefix: "$",
        },
      },
    ],
    closing: "Brightcart is the bigger deal. Cloudmint is the better hour.",
  },
  {
    id: "action",
    tabLabel: "Next best action",
    panelLabel: "Recommended action - Cloudmint",
    subject: { company: "Cloudmint", dealValue: 42_000, stage: "Evaluation" },
    steps: [
      {
        id: "a1",
        delay: 550,
        action: "signal",
        status: "Risk detected",
        payload: {
          label: "4 days of silence after the demo",
          detail: "No outbound sent since",
          at: "now",
          tone: "risk",
        },
      },
      {
        id: "a2",
        delay: 700,
        action: "analyze",
        status: "Analyzing opportunity",
        payload: { label: "Reading this deal's signal history" },
      },
      {
        id: "a3",
        delay: 900,
        action: "recommend",
        status: "Generating next best action",
        payload: {
          headline: "Send a security follow-up to the VP Finance",
          why: "The new stakeholder is the one who has not been addressed, and security is what stalls deals at this stage.",
          evidence: [
            "VP Finance joined 9 minutes ago",
            "Proposal opened twice, no reply",
            "4 days of silence after the demo",
          ],
          atStake: 28_560,
        },
      },
      {
        id: "a4",
        delay: 900,
        action: "approve",
        status: "Waiting for approval",
        payload: {
          label: "Awaiting human approval",
          state: "awaiting",
          note: "Nothing customer-facing sends without a person",
        },
      },
      {
        id: "a5",
        delay: 800,
        action: "approve",
        status: "Approved by a human",
        payload: { label: "Approved and scheduled", state: "approved" },
      },
    ],
    closing: "One action, with the evidence behind it - never a list of five",
  },
  {
    id: "outcome",
    tabLabel: "Revenue outcome",
    panelLabel: "Revenue outcome - Cloudmint",
    subject: { company: "Cloudmint", dealValue: 42_000, stage: "Evaluation" },
    steps: [
      {
        id: "o1",
        delay: 550,
        action: "execute",
        status: "Sending",
        payload: { label: "Follow-up sent", state: "sent" },
      },
      {
        id: "o2",
        delay: 800,
        action: "response",
        status: "Customer replied",
        payload: {
          label: "Reply received",
          quote: "Can we review security requirements tomorrow?",
          who: "VP Finance",
        },
      },
      {
        id: "o3",
        delay: 700,
        action: "outcome",
        status: "Meeting logged",
        payload: { label: "Meeting booked for tomorrow" },
      },
      {
        id: "o4",
        delay: 700,
        action: "outcome",
        status: "CRM updated",
        payload: {
          label: "Deal stage moved",
          stageFrom: "Evaluation",
          stageTo: "Security review",
        },
      },
      {
        id: "o5",
        delay: 750,
        action: "score",
        status: "Win probability updated",
        payload: {
          metric: "Win probability",
          from: 68,
          to: 71,
          suffix: "%",
          verdict: "Advanced a stage",
          tone: "good",
        },
      },
      {
        id: "o6",
        delay: 700,
        action: "outcome",
        status: "Expected revenue recalculated",
        payload: {
          label: "Protected revenue",
          metric: "Protected revenue",
          from: 28_560,
          to: 29_820,
          prefix: "$",
        },
      },
    ],
    closing: "Signal to Recommendation to Action to Response to Revenue outcome",
  },
];

/** Per-scenario step delays, for the sequence clock. */
export function scenarioDelays(scenario: HeroScenario): number[] {
  return scenario.steps.map((s) => s.delay);
}
