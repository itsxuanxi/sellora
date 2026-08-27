/**
 * The Guided Demo's entire world: one fictional account, one opportunity, one
 * three-minute story.
 *
 * Everything the demo shows is defined here and nowhere else, which is what
 * lets the same figures follow the visitor from the workspace list, through
 * the opportunity detail, into the analytics roll-up without any chance of
 * drifting apart.
 *
 * Deliberately free of any server import, Prisma model or network call. The
 * demo cannot touch production data because it has no way to reach it — that
 * is a structural guarantee, not a promise kept by careful coding.
 *
 * Every company and person below is invented.
 */

export const DEMO_NOTE = "Illustrative demo data";
export const DEMO_SEND_NOTE = "No real message will be sent.";

/** Money is whole dollars throughout, matching the product's own convention. */
export function expectedRevenue(dealValue: number, winProbability: number): number {
  return Math.round(dealValue * (winProbability / 100));
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

// ── The account ────────────────────────────────────────────────────────────

export const DEMO_ACCOUNT = {
  id: "cloudmint",
  company: "Cloudmint",
  industry: "B2B Fintech",
  employees: 180,
  region: "North America",
  icpFit: "High",
} as const;

export const DEMO_CONTACT = {
  name: "Maya Chen",
  role: "VP Finance",
  decisionRole: "Economic buyer",
  initials: "MC",
} as const;

// ── The opportunity ────────────────────────────────────────────────────────

export const DEMO_OPPORTUNITY = {
  id: "cloudmint",
  name: "Cloudmint — Growth Plan",
  dealValue: 42_000,
  owner: "Alex Morgan",
  initialStage: "Evaluation",
  initialWinProbability: 52,
  advancedStage: "Security Review",
  advancedWinProbability: 71,
} as const;

/** Derived, never typed twice — the two figures the whole demo turns on. */
export const INITIAL_EXPECTED = expectedRevenue(
  DEMO_OPPORTUNITY.dealValue,
  DEMO_OPPORTUNITY.initialWinProbability
); // $21,840

export const ADVANCED_EXPECTED = expectedRevenue(
  DEMO_OPPORTUNITY.dealValue,
  DEMO_OPPORTUNITY.advancedWinProbability
); // $29,820

export const EXPECTED_UPLIFT = ADVANCED_EXPECTED - INITIAL_EXPECTED; // $7,980

// ── The pipeline the workspace lists ───────────────────────────────────────

export interface DemoPipelineRow {
  id: string;
  company: string;
  dealValue: number;
  winProbability: number;
  expected: number;
  stage: string;
  lastActivity: string;
  urgency: "high" | "medium" | "low";
  note: string;
}

function row(
  r: Omit<DemoPipelineRow, "expected">
): DemoPipelineRow {
  return { ...r, expected: expectedRevenue(r.dealValue, r.winProbability) };
}

/**
 * Cloudmint leads. Note Brightcart is the larger deal and still ranks below —
 * the ranking is by expected revenue, and the list would be dishonest about
 * how Sellora works if the biggest number simply won.
 */
export const DEMO_PIPELINE: DemoPipelineRow[] = [
  row({
    id: "cloudmint",
    company: "Cloudmint",
    dealValue: 42_000,
    winProbability: 52,
    stage: "Evaluation",
    lastActivity: "4 days ago",
    urgency: "high",
    note: "Proposal opened twice, then silence",
  }),
  row({
    id: "northstar",
    company: "Northstar",
    dealValue: 68_000,
    winProbability: 28,
    stage: "Qualifying",
    lastActivity: "2 days ago",
    urgency: "medium",
    note: "Early conversations, no proposal yet",
  }),
  row({
    id: "vantaworks",
    company: "VantaWorks",
    dealValue: 24_000,
    winProbability: 64,
    stage: "Negotiation",
    lastActivity: "yesterday",
    urgency: "medium",
    note: "Terms under review with legal",
  }),
  row({
    id: "brightcart",
    company: "Brightcart",
    dealValue: 55_000,
    winProbability: 22,
    stage: "Qualifying",
    lastActivity: "9 days ago",
    urgency: "low",
    note: "Champion went quiet after discovery",
  }),
  row({
    id: "ledgerly",
    company: "Ledgerly",
    dealValue: 30_000,
    winProbability: 35,
    stage: "Evaluation",
    lastActivity: "6 days ago",
    urgency: "low",
    note: "Waiting on their budget cycle",
  }),
];

/** Ranked the way the product ranks: by expected revenue. */
export const RANKED_PIPELINE = [...DEMO_PIPELINE].sort(
  (a, b) => b.expected - a.expected
);

// ── The evidence trail ─────────────────────────────────────────────────────

export interface DemoSignal {
  id: string;
  label: string;
  detail: string;
  at: string;
  tone: "good" | "risk";
  kind: "engagement" | "stakeholder" | "intent" | "silence" | "meeting";
}

/** Six signals — the number the completion summary reports. */
export const DEMO_SIGNALS: DemoSignal[] = [
  {
    id: "sig-demo",
    label: "Product demo completed",
    detail: "45-minute walkthrough with the evaluation team",
    at: "8 days ago",
    tone: "good",
    kind: "meeting",
  },
  {
    id: "sig-proposal-sent",
    label: "Proposal sent",
    detail: "Growth Plan, 12-month term",
    at: "7 days ago",
    tone: "good",
    kind: "engagement",
  },
  {
    id: "sig-proposal-opened",
    label: "Proposal opened twice",
    detail: "Second open lasted 6 minutes on the pricing section",
    at: "6 days ago",
    tone: "good",
    kind: "engagement",
  },
  {
    id: "sig-stakeholder",
    label: "Maya Chen joined the evaluation",
    detail: "VP Finance — economic buyer for this purchase",
    at: "5 days ago",
    tone: "good",
    kind: "stakeholder",
  },
  {
    id: "sig-security",
    label: "Security page viewed",
    detail: "Viewed the day after joining the evaluation",
    at: "4 days ago",
    tone: "good",
    kind: "intent",
  },
  {
    id: "sig-silence",
    label: "Four days without a reply",
    detail: "No outbound sent since the proposal",
    at: "now",
    tone: "risk",
    kind: "silence",
  },
];

// ── Analysis output ────────────────────────────────────────────────────────

/** The working lines shown while the analysis runs. */
export const ANALYSIS_BEATS = [
  "Reading 6 signals",
  "Calculating intent",
  "Checking deal risk",
  "Recalculating expected revenue",
] as const;

export const DEMO_SCORES = {
  intent: 87,
  risk: 68,
  status: "Needs attention",
  revenueAtRisk: INITIAL_EXPECTED,
} as const;

// ── The recommendation ─────────────────────────────────────────────────────

export const DEMO_RECOMMENDATION = {
  headline: `Send a security follow-up to ${DEMO_CONTACT.name}`,
  reason:
    "Maya viewed the security page after joining the evaluation, but the deal has been silent for four days.",
  supportingSignalIds: [
    "sig-security",
    "sig-stakeholder",
    "sig-proposal-opened",
    "sig-silence",
  ],
  supporting: [
    "Security page viewed",
    "Economic buyer joined",
    "Proposal opened twice",
    "4 days without reply",
  ],
  confidence: "High",
} as const;

export const DEMO_DRAFT = {
  to: `${DEMO_CONTACT.name} · ${DEMO_CONTACT.role}`,
  subject: "Cloudmint security review",
  body: `Hi Maya, I noticed security may be the next step in your evaluation. I've attached the relevant documentation and can bring our security lead into a short review this week. Would Tuesday or Wednesday work better?`,
} as const;

// ── The buyer's response ───────────────────────────────────────────────────

export const DEMO_RESPONSE = {
  quote:
    "Thanks — Wednesday works. Please include our security lead and procurement manager.",
  from: DEMO_CONTACT.name,
  at: "18 hours later",
} as const;

/** Revealed one at a time after the reply lands. */
export const DEMO_RESPONSE_EFFECTS = [
  { id: "reply", label: "Reply received", detail: "18 hours after sending" },
  { id: "meeting", label: "Meeting booked", detail: "Wednesday, 30 minutes" },
  {
    id: "stakeholder",
    label: "New stakeholder added",
    detail: "Procurement manager joined the thread",
  },
  {
    id: "review",
    label: "Security review scheduled",
    detail: "Security lead invited to the call",
  },
] as const;

// ── The loop, for the analytics page ───────────────────────────────────────

export const DEMO_LOOP = [
  {
    stage: "Signal",
    body: "Proposal opened + security page viewed",
  },
  {
    stage: "Decision",
    body: "High intent with four days of silence",
  },
  {
    stage: "Action",
    body: "Security follow-up approved and sent",
  },
  {
    stage: "Response",
    body: "Buyer replied and booked a review",
  },
  {
    stage: "Outcome",
    body: `Opportunity advanced; expected revenue increased by ${formatUsd(EXPECTED_UPLIFT)}`,
  },
] as const;

/** The completion summary. Advancement only — never a claim of a win. */
export const DEMO_SUMMARY = [
  { label: "Signals analyzed", value: String(DEMO_SIGNALS.length) },
  { label: "Actions approved", value: "1" },
  { label: "Buyer responses", value: "1" },
  { label: "Meetings booked", value: "1" },
  { label: "Opportunity", value: "Advanced" },
  {
    label: "Expected revenue",
    value: `${formatUsd(INITIAL_EXPECTED)} → ${formatUsd(ADVANCED_EXPECTED)}`,
  },
] as const;
