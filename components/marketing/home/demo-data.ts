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
 *   Cloudmint  $80,000 × 54% = $43,200
 *   Brightcart $62,000 × 48% = $29,760
 *   Ledgerly   $45,000 × 37% = $16,650
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
    dealValue: 80_000,
    probability: 54,
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
    dealValue: 62_000,
    probability: 48,
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
    dealValue: 45_000,
    probability: 37,
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

/** Tab definitions for the hero carousel. */
export const DEMO_STAGES = [
  { id: "monitoring", label: "Signal monitoring", panelLabel: "Signal monitor" },
  { id: "prioritization", label: "Deal prioritization", panelLabel: "Prioritized pipeline" },
  { id: "action", label: "Next best action", panelLabel: "Recommended action · Cloudmint" },
  { id: "command", label: "Revenue command", panelLabel: "Revenue command center" },
] as const;

export type StageId = (typeof DEMO_STAGES)[number]["id"];

/** How long each stage holds before advancing. */
export const STAGE_DURATION_MS = 5600;
