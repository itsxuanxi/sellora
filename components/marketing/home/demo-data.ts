/**
 * The single source of truth for every number and phrase in the marketing
 * product demos.
 *
 * One deal — Cloudmint — is followed through all four stages of the hero
 * carousel and reused by the capability panels and the query demo further
 * down the page. That continuity is the point: a visitor should feel they are
 * watching Selryn do one piece of work, not flipping through four unrelated
 * screenshots.
 *
 * Because every surface reads from here, a claim can only be wrong in one
 * place — and the claim that matters is the ordering one. The priority
 * capsule ranks by what is overdue, in the rule order the product itself
 * uses (RULE_ORDER in lib/followup/rules.ts): an unanswered proposal, then a
 * missing next step, then plain silence.
 *
 * It used to rank by deal value × win probability, print that formula on
 * screen and conclude "Cloudmint is the better hour". That is the mechanism
 * the product was deliberately moved off, because it chose whom to call from
 * a number nothing had calibrated. A homepage still demonstrating it was
 * advertising a behaviour the application no longer has, which is the worst
 * kind of stale copy: it reads as a specification.
 *
 * For the same reason, no percentage here is presented as a probability of
 * closing.
 *
 * All figures are illustrative sample data for a fictional pipeline.
 */

export const DEMO_DATA_NOTE = "Sample data shown for illustration";

export interface DemoDeal {
  rank: string;
  company: string;
  dealValue: number;
  /** Days since this buyer last replied. Shown as itself, never forecast from. */
  waitingDays: number;
  /** The risk the product would name here, in the product's own words. */
  riskLabel: string;
  /**
   * Position under the product's follow-up rules: an unanswered proposal
   * outranks a missing next step, which outranks plain silence. Lower goes
   * first. Mirrors RULE_ORDER in lib/followup/rules.ts.
   */
  ruleRank: number;
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

export const DEMO_DEALS: DemoDeal[] = [
  {
    rank: "01",
    company: "Cloudmint",
    dealValue: 42_000,
    waitingDays: 4,
    riskLabel: "Proposal unanswered",
    ruleRank: 1,
    priority: "Call today",
    priorityTone: "urgent",
    signals: ["Proposal opened twice", "New stakeholder joined"],
    status: "Last activity: 12 minutes ago",
    readoutLabel: "Intent",
    readoutValue: "High",
    readoutTone: "high",
    lastActivity: "12 minutes ago",
  },
  {
    rank: "02",
    company: "Brightcart",
    dealValue: 65_000,
    waitingDays: 1,
    riskLabel: "No next step",
    ruleRank: 2,
    priority: "Follow up",
    priorityTone: "warn",
    signals: ["Pricing page revisited", "Case studies reviewed"],
    status: "Last activity: 2 hours ago",
    readoutLabel: "Intent",
    readoutValue: "Rising",
    readoutTone: "rising",
    lastActivity: "2 hours ago",
  },
  {
    rank: "03",
    company: "Ledgerly",
    dealValue: 30_000,
    waitingDays: 5,
    riskLabel: "Quiet since the demo",
    ruleRank: 3,
    priority: "Re-engage",
    priorityTone: "watch",
    signals: ["Demo completed", "No reply for 5 days"],
    status: "No reply for 5 days",
    readoutLabel: "Risk",
    readoutValue: "Increasing",
    readoutTone: "risk",
    lastActivity: "5 days ago",
  },
];

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
      { label: "Selryn identifies the missing stakeholder", note: "No finance contact on the thread", delay: 1000 },
      { label: "A targeted follow-up is prepared", note: "Draft written against the actual gap", delay: 950 },
      { label: "Sales rep approves", note: "Nothing sends without a human", delay: 1150 },
      { label: "CRM is updated", note: "Stage, next step and activity written back", delay: 900 },
    ],
    outcome: [
      { label: "Buyer", value: "Replied", tone: "good" },
      { label: "Next meeting", value: "Scheduled", tone: "good" },
    ],
    // Deliberately not a money figure.
    //
    // This said "Estimated expected revenue protected: $43.2K", which is a
    // revenue claim twice over: "protected" says Selryn saved the money, and
    // the number came from deal value times an uncalibrated probability. A
    // reply and a booked meeting are what actually happened, so those are
    // what the scenario reports.
    result: "Outcome: they replied, and a next meeting is on the calendar.",
  },
  {
    id: "prioritize",
    tabLabel: "Prioritize today's pipeline",
    // Not "what the next hour is worth" — that prices an hour of selling
    // from an estimate. The list orders by deal size and says so.
    title: "Every open deal, ordered by size — and who to contact first.",
    account: "All open opportunities",
    steps: [
      { label: "Selryn reads every open opportunity", note: "248 monitored continuously", delay: 700 },
      { label: "Follow-up commitments are checked", note: "Dates you agreed, against what was sent", delay: 900 },
      { label: "Proposals with no reply are found", note: "Sent, opened, and still unanswered", delay: 1000 },
      { label: "Today's list is ordered by what is overdue", note: "Not by which deal is biggest", delay: 1100 },
      { label: "One action is attached to each", note: "Not five options — one", delay: 950 },
    ],
    outcome: [
      { label: "Open deals read", value: "248", tone: "accent" },
      // A count of deals, not a sum of money. The number this used to carry
      // was deal value times an uncalibrated stage baseline, summed — an
      // estimate of an estimate, printed to three figures.
      { label: "Needing a follow-up today", value: "14", tone: "accent" },
    ],
    result: "Ordered by what is overdue — the oldest broken promise first",
  },
  {
    id: "convert",
    tabLabel: "Convert a high-intent buyer",
    title: "Intent rises, and the right next step is obvious.",
    account: "Brightcart",
    steps: [
      { label: "Pricing page revisited", note: "Second visit this week" },
      { label: "Case studies reviewed", note: "Three in one session — not a browse" },
      { label: "Second stakeholder appears", note: "New contact from the same domain" },
      { label: "Intent changes from Medium to High", note: "Score moves on evidence, not a guess" },
      { label: "Selryn recommends technical validation", note: "The usual blocker at this stage" },
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

export type IntegrationKey =
  | "csv"
  | "google_signin"
  | "outbound_email"
  | "hubspot"
  | "slack"
  | "salesforce"
  | "pipedrive"
  | "gmail"
  | "calendar";

/**
 * What a visitor can actually do with a feature today.
 *
 * Three states, not two. The missing middle was doing real damage: a finished
 * HubSpot connector with no OAuth app registered for this deployment had to be
 * called either "available", which offers a connection nobody can make, or
 * "planned", which denies months of shipped work. Neither is what a buyer
 * asked — they asked "can I use this?", and the true answer for that case is
 * "yes, once it is configured".
 *
 *   available    works now, nothing to set up
 *   needs_setup  built and tested; needs credentials or a connection first
 *   planned      not built. Never shown as though it were.
 */
export type CapabilityStatus = "available" | "needs_setup" | "planned";

export const CAPABILITY_STATUS_LABEL: Record<CapabilityStatus, string> = {
  available: "Available",
  needs_setup: "Needs setup",
  planned: "Planned",
};

export const CAPABILITY_STATUS_HELP: Record<CapabilityStatus, string> = {
  available: "Works now, with nothing to configure.",
  needs_setup: "Built and tested. Needs credentials or a connection before you can use it.",
  planned: "Not built yet. Listed so you know what is and is not here.",
};

/**
 * The integration catalog.
 *
 * `built` means the code exists and is tested. It is deliberately NOT the same
 * question as whether a visitor can use it, because for an OAuth integration
 * those come apart: HubSpot is ~1,400 lines of finished connector — OAuth with
 * state verification, encrypted token refresh, a rate-limited client,
 * incremental sync, webhook signature checks and a cron-driven job queue — and
 * a customer still cannot connect it until this deployment has a HubSpot app
 * registered and its credentials set.
 *
 * So the status a visitor sees is resolved per-deployment, server-side, in
 * lib/marketing/capabilities.ts. A finished connector with no credentials
 * reads as planned rather than offering a connection nobody can make, and it
 * flips to available the moment the keys land — with no code change, which is
 * the point. The old hard-coded list had HubSpot marked planned months after
 * the connector shipped.
 */
export const INTEGRATION_CATALOG: {
  key: IntegrationKey;
  name: string;
  built: boolean;
}[] = [
  { key: "csv", name: "CSV import (deals and signals)", built: true },
  { key: "google_signin", name: "Google sign-in", built: true },
  { key: "outbound_email", name: "Outbound email", built: true },
  { key: "hubspot", name: "HubSpot", built: true },
  { key: "slack", name: "Slack", built: true },
  { key: "salesforce", name: "Salesforce", built: false },
  { key: "pipedrive", name: "Pipedrive", built: false },
  { key: "gmail", name: "Gmail", built: false },
  { key: "calendar", name: "Google Calendar", built: false },
];

/**
 * Every line checked against the codebase.
 *
 * Role-based access moved from planned to available: it is no longer a column
 * nobody reads. lib/security/rbac.ts defines five roles and a permission
 * matrix, and requirePermission() guards 16 call sites — approval, execution
 * and every integration connect path, in server actions and API routes alike.
 *
 * SSO is gone from the list rather than left as a roadmap row. No SAML or SSO
 * code exists, and the tier it was there to prop up (Enterprise) no longer
 * exists either — a 2-20 person buyer is not asking for it.
 */
export const TRUST_POINTS: { text: string; status: CapabilityStatus }[] = [
  { text: "Human approval for customer-facing actions", status: "available" },
  { text: "Clear reasoning behind every recommendation", status: "available" },
  { text: "Role-based access across five roles", status: "available" },
  { text: "Auditable action history", status: "available" },
  { text: "Customer data is not used to train shared models", status: "available" },
  { text: "Works alongside your existing CRM", status: "available" },
];

/**
 * What Selryn records on every follow-up — shown where customer outcome
 * metrics would normally go.
 *
 * That slot held three cards reading "—" above the labels "Follow-up speed
 * improvement", "Rep hours saved each week" and "Pipeline coverage", under
 * the heading "Customer outcomes", with a line promising to publish them once
 * measured. The intent was honest and the effect was not: three empty boxes
 * on a pricing-adjacent screen read as a product with no customers, which is
 * the one thing a visitor cannot un-see. And they were the only part of the
 * page a reader could not check.
 *
 * These five are checkable. Each is a column that exists and a step a visitor
 * walks through in the demo, so the section now says what the product does
 * instead of apologising for what has not been measured.
 */
export const RECORDED_STEPS: { step: string; detail: string }[] = [
  {
    step: "The risk, and where it came from",
    detail: "Which rule fired, on which email or deal field, and its date.",
  },
  {
    step: "The recommendation, when it was made",
    detail: "Kept even after it is withdrawn, so advice cannot be rewritten later.",
  },
  {
    step: "Selryn's draft, and the version you sent",
    detail: "Both stored, with a flag for whether a human changed it.",
  },
  {
    step: "Who approved it, and when",
    detail: "Nothing customer-facing has a path that skips this.",
  },
  {
    step: "What the buyer did next",
    detail: "A reply, a meeting, a stage move — or nothing, which also counts.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Hero: four auto-executing scenarios
//
// Each tab is a script, not a screenshot. A step's `action` says what kind of
// work Selryn is doing at that moment and its `payload` carries the data the
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

/** Selryn thinking. Renders as a working line, never a spinner for its own sake. */
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

/** The single recommended action, with the evidence behind it. */
export interface RecommendStep extends DemoStepBase {
  action: "recommend";
  payload: {
    headline: string;
    why: string;
    evidence: string[];
    /** The CRM's own amount on this deal. Not an estimate derived from it. */
    atStake?: number;
    /** The drafted message, shown as editable text before approval. */
    draft?: { subject: string; body: string };
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

/**
 * The record rail — the structured half of a panel.
 *
 * The step list on the left is Selryn *working*; the rail is the record that
 * work is being written into. Without it a panel is a feed of sentences, which
 * is what a process diagram looks like, not what software looks like. Software
 * has a right-hand side where fields resolve one by one and a completeness
 * figure at the bottom.
 *
 * Every row names a real field with a machine key, because that is how the
 * product actually stores it, and a reader can tell the difference between a
 * field and a bullet point at a glance.
 */
export interface RailField {
  /** Machine key, rendered in the product's own monospace field style. */
  key: string;
  value: string;
  /**
   * Steps that must have landed before this row resolves. 0 means the row is
   * part of the record from the first frame — the account, the owner, the
   * amount — so the rail is never an empty box waiting to be filled.
   */
  after: number;
  tone?: "good" | "risk" | "pending";
}

/** The completeness figure under the fields. Fills once `after` steps land. */
export interface RailMeter {
  label: string;
  /** 0–100. */
  value: number;
  note: string;
  after: number;
  tone?: "good" | "risk";
}

export interface ScenarioRail {
  label: string;
  /** Right-hand count in the rail header, e.g. "7 of 8". Derived below. */
  fields: RailField[];
  meter: RailMeter;
}

export interface HeroScenario {
  id: string;
  tabLabel: string;
  panelLabel: string;
  /** The deal this scenario is about, shown in the stage header. */
  subject: {
    company: string;
    dealValue: number;
    stage: string;
    /** Named owner, so the header reads as somebody's record rather than a demo. */
    owner?: string;
    /** Right-hand figure when there is no single deal value to show. */
    amountLabel?: string;
  };
  steps: DemoStep[];
  /** The structured record the steps are writing into. */
  rail: ScenarioRail;
  /** The closing line, shown once every step has landed. */
  closing: string;
}

/** "5 of 8 fields" for the rail header — counted, never typed. */
export function railProgress(
  rail: ScenarioRail,
  revealed: number
): { resolved: number; total: number; label: string } {
  const total = rail.fields.length;
  const resolved = rail.fields.filter((f) => revealed >= f.after).length;
  return { resolved, total, label: `${resolved} of ${total}` };
}

/**
 * Ranked list used by the priority scenario. Derived, never hand-typed.
 *
 * By rule order, which is what the product sorts on — not by deal value and
 * not by any estimate derived from it.
 */
export const RANKED_DEALS = [...DEMO_DEALS].sort((a, b) => a.ruleRank - b.ruleRank);

/**
 * Every scenario holds the panel for the same fixed period.
 *
 * A shared dwell is what makes the tab progress line honest - four bars that
 * each mean six seconds. Scenario steps are tuned to finish inside it with
 * room to read the result, and a test fails the build if any scenario's steps
 * would overrun, which is the failure a fixed dwell would otherwise hide.
 */
export const HERO_STAGE_DURATION_MS = 7200;

/** Minimum quiet time after the last step lands, before the tab advances. */
export const HERO_STAGE_TAIL_MS = 900;

export const HERO_SCENARIOS: HeroScenario[] = [
  {
    id: "detection",
    tabLabel: "Detect signals",
    panelLabel: "Signal monitor · Cloudmint",
    subject: {
      company: "Cloudmint",
      dealValue: 42_000,
      stage: "Pricing",
      owner: "Dana Whitfield",
    },
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
          detail: "Their Head of Growth joined the thread",
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
        delay: 620,
        action: "signal",
        status: "Detecting signals",
        payload: {
          label: "Discovery call completed",
          detail: "45 minutes with the evaluation team",
          at: "8 days ago",
          tone: "good",
        },
      },
      {
        id: "s5",
        delay: 620,
        action: "signal",
        status: "Detecting signals",
        payload: {
          label: "Replied to the proposal thread",
          detail: "Asked how implementation is staffed",
          at: "6 days ago",
          tone: "good",
        },
      },
      {
        id: "s6",
        delay: 660,
        action: "signal",
        status: "Risk detected",
        payload: {
          label: "Four days of silence",
          detail: "No reply since the proposal was opened",
          at: "now",
          tone: "risk",
        },
      },
      {
        id: "s7",
        delay: 640,
        action: "analyze",
        status: "Analyzing opportunity",
        payload: { label: "Weighing six signals against this deal's stage" },
      },
      {
        id: "s8",
        delay: 660,
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
    rail: {
      label: "Deal record",
      // Not one row repeats the header — account, owner, stage and deal value
      // are already stated a centimetre above, and listing them again is how a
      // record rail turns into a caption.
      //
      // The first two are CRM facts, true before Selryn has done anything, so
      // the rail opens as a record with things in it. A rail whose every row
      // starts blank reads as a loading skeleton rather than a file being
      // worked on, which is the opposite of the impression it exists to give.
      fields: [
        { key: "close_date", value: "Mar 28", after: 0 },
        { key: "contract_term", value: "12 months", after: 0 },
        { key: "proposal_opens", value: "2 in 24h", after: 1, tone: "good" },
        { key: "champion", value: "Priya Raman · Growth", after: 2, tone: "good" },
        { key: "buying_committee", value: "3 contacts", after: 2, tone: "good" },
        { key: "signals_read", value: "6 of 6", after: 6, tone: "good" },
        { key: "last_reply", value: "4 days ago", after: 6, tone: "risk" },
      ],
      meter: {
        label: "Intent score",
        value: 87,
        note: "Up from 64 — six signals, weighted by stage",
        after: 8,
        tone: "good",
      },
    },
    closing: "6 signals on this deal, read together rather than one by one",
  },
  {
    id: "priority",
    tabLabel: "Name the blocker",
    panelLabel: "Prioritized pipeline",
    subject: {
      company: "All open opportunities",
      dealValue: 0,
      stage: "Ranking",
      owner: "Revenue team",
      // The three ranked deals add to $137,000 of open value. Stated rather
      // than left blank so the header carries a figure like the others.
      amountLabel: "$137,000 open",
    },
    steps: [
      {
        id: "p1",
        delay: 550,
        action: "analyze",
        status: "Reading 248 open deals",
        payload: { label: "Reading the latest signal on every open deal" },
      },
      {
        id: "p2",
        delay: 700,
        action: "rank",
        status: "Biggest deals first",
        payload: {
          // Deal-size order, which is where most pipeline reviews stop.
          order: ["Brightcart", "Cloudmint", "Ledgerly"],
          caption: "Sorted by deal value",
        },
      },
      {
        id: "p3",
        delay: 850,
        action: "analyze",
        status: "Checking what is overdue",
        payload: { label: "Agreed follow-up dates, unanswered proposals, silence after a demo" },
      },
      {
        id: "p4",
        delay: 900,
        action: "rank",
        status: "Re-ordered by what is overdue",
        payload: {
          order: ["Cloudmint", "Brightcart", "Ledgerly"],
          highlight: "Cloudmint",
          caption: "Sorted by what is overdue",
        },
      },
      {
        id: "p5",
        delay: 750,
        action: "outcome",
        status: "Cloudmint goes first",
        payload: {
          label: "Its proposal is unanswered, and they opened it again today",
        },
      },
    ],
    rail: {
      label: "Ranking run",
      fields: [
        { key: "opportunities", value: "248 open", after: 0 },
        { key: "needing_follow_up", value: "14", after: 0 },
        { key: "method", value: "overdue first", after: 3 },
        { key: "top_account", value: "Cloudmint", after: 4, tone: "good" },
        { key: "top_reason", value: "proposal unanswered", after: 5, tone: "risk" },
        { key: "largest_deal", value: "Brightcart", after: 4 },
      ],
      meter: {
        // A count of deals against a count of deals. The figure this replaced
        // was a sum of deal values times uncalibrated stage baselines,
        // expressed as a share of open pipeline — two estimates deep, and
        // printed as though it were a measurement.
        label: "Share of the pipeline",
        value: 6,
        note: "14 of 248 open deals need a follow-up today",
        after: 4,
        tone: "good",
      },
    },
    closing: "Brightcart is the bigger deal. Cloudmint is the one you owe an answer.",
  },
  {
    id: "action",
    tabLabel: "Recommend action",
    panelLabel: "Recommended action · Cloudmint",
    subject: {
      company: "Cloudmint",
      dealValue: 42_000,
      stage: "Pricing",
      owner: "Dana Whitfield",
    },
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
        status: "Drafting the follow-up",
        payload: {
          headline: "Send the scope and start date to their Head of Growth",
          why: "The new stakeholder has not been addressed, and an unanswered start date is what stalls deals at this stage.",
          evidence: [
            "Head of Growth joined 9 minutes ago",
            "Proposal opened twice, no reply",
            "4 days of silence after the demo",
          ],
          // The deal value, which the CRM holds. It used to be $28,560 — that
          // same figure times a stage baseline — captioned "of expected
          // revenue at stake", which put an estimate of an estimate under the
          // one real number on the panel.
          atStake: 42_000,
          draft: {
            subject: "Scope and a start date",
            body: "Hi Priya \u2014 you\u2019ve had the proposal open a couple of times and I still haven\u2019t come back to you with a start date. I can put the scope and timing in front of you this week. Tuesday or Wednesday?",
          },
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
          note: "Nothing sends without a person",
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
    rail: {
      label: "Why this action",
      fields: [
        { key: "days_in_stage", value: "31", after: 0 },
        { key: "stakeholder_gap", value: "Head of Growth", after: 3, tone: "risk" },
        { key: "engagement", value: "Proposal opened 2x", after: 2, tone: "good" },
        { key: "silence", value: "4 days, no outbound", after: 1, tone: "risk" },
        { key: "stage_pattern", value: "Scope stalls here", after: 3 },
        { key: "at_stake", value: "$28,560", after: 3, tone: "good" },
        { key: "approval", value: "human required", after: 4, tone: "pending" },
      ],
      meter: {
        label: "Confidence",
        value: 82,
        note: "Weighed across six signals on this deal",
        after: 3,
        tone: "good",
      },
    },
    closing: "One action, with the evidence behind it — never a list of five",
  },
  {
    id: "outcome",
    tabLabel: "Measure outcome",
    panelLabel: "Outcome · Cloudmint",
    subject: {
      company: "Cloudmint",
      dealValue: 42_000,
      stage: "Pricing",
      owner: "Dana Whitfield",
    },
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
          quote: "Can you walk us through the scope tomorrow?",
          who: "Head of Growth",
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
          stageFrom: "Pricing",
          stageTo: "Proposal",
        },
      },
      {
        id: "o5",
        delay: 750,
        action: "score",
        status: "Risk cleared",
        payload: {
          metric: "Days unanswered",
          from: 4,
          to: 0,
          verdict: "They replied",
          tone: "good",
        },
      },
      {
        id: "o6",
        delay: 700,
        action: "outcome",
        status: "Recorded, not counted as revenue",
        payload: {
          label: "Advanced one stage. Not won, and nothing booked.",
        },
      },
    ],
    rail: {
      label: "What was recorded",
      fields: [
        { key: "approved_by", value: "Dana W. · 09:12", after: 0, tone: "good" },
        { key: "follow_up", value: "sent 09:14", after: 1, tone: "good" },
        { key: "reply", value: "41 min later", after: 2, tone: "good" },
        { key: "meeting", value: "tomorrow 14:00", after: 3, tone: "good" },
        { key: "stage", value: "Proposal", after: 4, tone: "good" },
        { key: "recommendation", value: "accepted, edited", after: 5, tone: "good" },
        { key: "revenue_booked", value: "none — still open", after: 6 },
      ],
      meter: {
        // A real Outcomes figure: of the recommendations this workspace was
        // shown, the share somebody then acted on. It replaced a win
        // probability, which measured nothing and moved three points because
        // a stage field changed.
        label: "Recommendations acted on",
        value: 71,
        note: "Of those shown in this workspace — accepted, edited or dismissed",
        after: 5,
        tone: "good",
      },
    },
    closing: "Risk → Recommendation → Your approval → Their reply → Recorded",
  },
];

/**
 * The status line above each panel.
 *
 * Counted from the scenario's own steps rather than typed, so a panel cannot
 * claim to be reading six signals while showing four. The label names the
 * mechanism; the count on the right is the check on it.
 */
export function scenarioStatus(scenario: HeroScenario): {
  label: string;
  count: string;
} {
  const signals = scenario.steps.filter((s) => s.action === "signal").length;
  const ranked = scenario.steps.find((s) => s.action === "rank");

  switch (scenario.id) {
    case "detection":
      return {
        label: "Signal detection · one open deal",
        count: `${signals} of ${signals} signals`,
      };
    case "priority":
      return {
        label: "Ordered by what is overdue",
        count:
          ranked && ranked.action === "rank"
            ? `${ranked.payload.order.length} of ${DEMO_DEALS.length} deals`
            : `${DEMO_DEALS.length} deals`,
      };
    case "action":
      return {
        label: "Recommended action · evidence attached",
        count: "1 of 1 action",
      };
    default:
      return {
        label: "Outcome · what was recorded",
        count: `${scenario.steps.length} of ${scenario.steps.length} events`,
      };
  }
}

/** Per-scenario step delays, for the sequence clock. */
export function scenarioDelays(scenario: HeroScenario): number[] {
  return scenario.steps.map((s) => s.delay);
}
