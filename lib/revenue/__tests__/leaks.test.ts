import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLeaks, revenueAtRisk, type LeakInput } from "@/lib/revenue/leaks";
import { decideNextAction } from "@/lib/revenue/next-action";
import { expectedRevenue, estimateDealValue, formatMoneyCompact } from "@/lib/revenue/money";

const NOW = new Date("2026-08-25T12:00:00.000Z");
function daysAgo(n: number) {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function baseLeakInput(overrides: Partial<LeakInput> = {}): LeakInput {
  return {
    stage: "PROPOSAL",
    score: 60,
    dealValue: 20_000,
    winProbability: 50,
    lastInteractionAt: daysAgo(1),
    lastInteractionKind: "email_sent",
    nextStepDueAt: null,
    closedAt: null,
    lastMeetingAt: null,
    proposalOpenedAt: null,
    lastOutboundAt: daysAgo(1),
    lastTouchAt: daysAgo(1),
    neverReplied: false,
    signals: [],
    ...overrides,
  };
}

test("a healthy, recently-touched deal leaks nothing", () => {
  assert.equal(detectLeaks(baseLeakInput(), NOW).length, 0);
});

test("a won deal never leaks", () => {
  const leaks = detectLeaks(
    baseLeakInput({ stage: "WON", lastInteractionAt: daysAgo(90), closedAt: daysAgo(80) }),
    NOW
  );
  assert.equal(leaks.length, 0);
});

test("proposal opened with no follow-up is detected as critical", () => {
  const leaks = detectLeaks(
    baseLeakInput({
      proposalOpenedAt: daysAgo(4),
      lastOutboundAt: daysAgo(6), // contacted BEFORE the open, not after
      lastTouchAt: daysAgo(6),
      lastInteractionAt: daysAgo(4),
    }),
    NOW
  );
  const leak = leaks.find((l) => l.type === "proposal_viewed_no_followup");
  assert.ok(leak, "expected a proposal follow-up leak");
  assert.equal(leak.severity, "critical");
  assert.ok(leak.ageDays >= 4);
});

test("following up after the proposal open clears the leak", () => {
  const leaks = detectLeaks(
    baseLeakInput({ proposalOpenedAt: daysAgo(4), lastOutboundAt: daysAgo(1) }),
    NOW
  );
  assert.ok(!leaks.some((l) => l.type === "proposal_viewed_no_followup"));
});

test("logging a manual touch clears the proposal leak", () => {
  // Regression: the rule originally consulted only email history, so marking
  // a recommendation complete never cleared the leak that produced it and the
  // deal sat in the recovery queue forever.
  const leaks = detectLeaks(
    baseLeakInput({
      proposalOpenedAt: daysAgo(4),
      lastOutboundAt: daysAgo(6), // no new email...
      lastTouchAt: daysAgo(0), // ...but a touch was logged today
      lastInteractionAt: daysAgo(0),
      lastInteractionKind: "note",
    }),
    NOW
  );
  assert.ok(!leaks.some((l) => l.type === "proposal_viewed_no_followup"));
});

test("a prospect opening an email is not counted as us following up", () => {
  // Their action must not clear our leak — only lastTouchAt can.
  const leaks = detectLeaks(
    baseLeakInput({
      proposalOpenedAt: daysAgo(4),
      lastOutboundAt: daysAgo(6),
      lastTouchAt: daysAgo(6),
      lastInteractionAt: daysAgo(0),
      lastInteractionKind: "email_opened",
    }),
    NOW
  );
  assert.ok(leaks.some((l) => l.type === "proposal_viewed_no_followup"));
});

test("high intent with no reply is detected", () => {
  const leaks = detectLeaks(
    baseLeakInput({
      score: 80,
      neverReplied: true,
      lastOutboundAt: daysAgo(5),
      lastTouchAt: daysAgo(5),
      lastInteractionAt: daysAgo(5),
      signals: [
        { signalType: "pricing_page_viewed", occurredAt: daysAgo(1), title: "Pricing viewed" },
      ],
    }),
    NOW
  );
  assert.ok(leaks.some((l) => l.type === "high_intent_no_response"));
});

test("a meeting with no scheduled next step is detected", () => {
  const leaks = detectLeaks(
    baseLeakInput({ stage: "MEETING", lastMeetingAt: daysAgo(5), nextStepDueAt: null }),
    NOW
  );
  assert.ok(leaks.some((l) => l.type === "meeting_no_next_step"));
});

test("scheduling a next step clears the meeting leak", () => {
  const leaks = detectLeaks(
    baseLeakInput({
      stage: "MEETING",
      lastMeetingAt: daysAgo(5),
      nextStepDueAt: new Date(NOW.getTime() + 86_400_000),
    }),
    NOW
  );
  assert.ok(!leaks.some((l) => l.type === "meeting_no_next_step"));
});

test("an overdue next step is detected", () => {
  const leaks = detectLeaks(baseLeakInput({ nextStepDueAt: daysAgo(3) }), NOW);
  assert.ok(leaks.some((l) => l.type === "needs_follow_up"));
});

test("a silent deal is flagged as going cold", () => {
  const leaks = detectLeaks(
    baseLeakInput({
      lastInteractionAt: daysAgo(14),
      lastOutboundAt: daysAgo(14),
      lastTouchAt: daysAgo(14),
    }),
    NOW
  );
  assert.ok(leaks.some((l) => l.type === "going_cold"));
});

test("a lost deal with a fresh post-close signal resurfaces", () => {
  const leaks = detectLeaks(
    baseLeakInput({
      stage: "LOST",
      closedAt: daysAgo(60),
      signals: [
        { signalType: "pricing_page_viewed", occurredAt: daysAgo(3), title: "Pricing viewed" },
      ],
    }),
    NOW
  );
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].type, "lost_with_new_signal");
});

test("a lost deal with only pre-close signals stays closed", () => {
  const leaks = detectLeaks(
    baseLeakInput({
      stage: "LOST",
      closedAt: daysAgo(5),
      signals: [
        { signalType: "pricing_page_viewed", occurredAt: daysAgo(20), title: "Pricing viewed" },
      ],
    }),
    NOW
  );
  assert.equal(leaks.length, 0);
});

test("leaks are ordered by severity, critical first", () => {
  const leaks = detectLeaks(
    baseLeakInput({
      proposalOpenedAt: daysAgo(5),
      lastOutboundAt: daysAgo(9),
      lastTouchAt: daysAgo(9),
      lastInteractionAt: daysAgo(9),
      nextStepDueAt: daysAgo(2),
    }),
    NOW
  );
  assert.ok(leaks.length >= 2);
  assert.equal(leaks[0].severity, "critical");
});

test("revenue at risk is discounted by probability and never exceeds deal value", () => {
  assert.equal(revenueAtRisk(20_000, 50, "critical"), 10_000);
  assert.equal(revenueAtRisk(20_000, 50, "warning"), 6_000);
  assert.equal(revenueAtRisk(20_000, 50, "watch"), 3_000);
  assert.ok(revenueAtRisk(20_000, 100, "critical") <= 20_000);
});

test("a lost deal showing new intent is priced as recoverable, not as zero", () => {
  // A lost deal correctly has 0% win probability, but rendering the revival
  // opportunity as "$0 at risk" would tell the reader nothing.
  assert.equal(revenueAtRisk(14_000, 0, "watch"), 0);
  assert.ok(
    revenueAtRisk(14_000, 0, "watch", "lost_with_new_signal") > 0,
    "revival opportunities must carry a non-zero recoverable figure"
  );
});

test("the reopen fallback only applies to lost deals, not to live ones", () => {
  // A live deal that genuinely computes to 0% must stay at 0.
  assert.equal(revenueAtRisk(14_000, 0, "critical", "going_cold"), 0);
});

// ── Next best action ──────────────────────────────────────────────────────

test("a leak always drives the recommendation", () => {
  const leaks = detectLeaks(
    baseLeakInput({
      proposalOpenedAt: daysAgo(4),
      lastOutboundAt: daysAgo(8),
      lastTouchAt: daysAgo(8),
    }),
    NOW
  );
  const action = decideNextAction({
    stage: "PROPOSAL",
    score: 70,
    dealValue: 10_000,
    winProbability: 50,
    contactName: "Dana",
    accountName: "Acme",
    leaks,
    quietDays: 4,
    hasProposal: true,
    hasMeeting: false,
    theyRepliedLast: false,
  });
  assert.equal(action.leakType, "proposal_viewed_no_followup");
  assert.ok(["now", "today"].includes(action.urgency));
  assert.match(action.headline, /Dana/);
});

test("a large stalled proposal escalates to the founder", () => {
  const leaks = detectLeaks(
    baseLeakInput({
      dealValue: 60_000,
      proposalOpenedAt: daysAgo(6),
      lastOutboundAt: daysAgo(10),
      lastTouchAt: daysAgo(10),
    }),
    NOW
  );
  const action = decideNextAction({
    stage: "PROPOSAL",
    score: 75,
    dealValue: 60_000,
    winProbability: 60,
    contactName: "Dana",
    accountName: "Acme",
    leaks,
    quietDays: 6,
    hasProposal: true,
    hasMeeting: true,
    theyRepliedLast: false,
  });
  assert.equal(action.actionType, "escalate_founder");
});

test("a freshly contacted cold deal is told to wait, not chased", () => {
  const action = decideNextAction({
    stage: "NEW",
    score: 30,
    dealValue: 5_000,
    winProbability: 5,
    contactName: "Dana",
    accountName: "Acme",
    leaks: [],
    quietDays: 0,
    hasProposal: false,
    hasMeeting: false,
    theyRepliedLast: false,
  });
  assert.equal(action.actionType, "wait");
});

test("exactly one action is returned, with alternatives kept separate", () => {
  const action = decideNextAction({
    stage: "MEETING",
    score: 65,
    dealValue: 15_000,
    winProbability: 30,
    contactName: "Dana",
    accountName: "Acme",
    leaks: [],
    quietDays: 5,
    hasProposal: false,
    hasMeeting: true,
    theyRepliedLast: false,
  });
  assert.equal(typeof action.actionType, "string");
  assert.ok(!action.alternatives.some((a) => a.actionType === action.actionType));
  assert.ok(action.rationale.length > 20, "rationale must explain, not just assert");
});

// ── Money ─────────────────────────────────────────────────────────────────

test("expected revenue is deal value times probability", () => {
  assert.equal(expectedRevenue(25_000, 80), 20_000);
  assert.equal(expectedRevenue(18_000, 65), 11_700);
  assert.equal(expectedRevenue(12_000, 70), 8_400);
});

test("probability outside 0-100 is clamped rather than trusted", () => {
  assert.equal(expectedRevenue(10_000, 150), 10_000);
  assert.equal(expectedRevenue(10_000, -20), 0);
});

test("compact money formatting stays short and readable", () => {
  assert.equal(formatMoneyCompact(84_200), "$84.2K");
  assert.equal(formatMoneyCompact(842_000), "$842K");
  assert.equal(formatMoneyCompact(1_860_000), "$1.86M");
  assert.equal(formatMoneyCompact(500), "$500");
});

test("deal value estimation reports the basis it used", () => {
  const withIcp = estimateDealValue({ icpMin: 10_000, icpMax: 30_000, companySize: "51-200" });
  assert.equal(withIcp.basis, "icp_midpoint");
  assert.ok(withIcp.dealValue >= 10_000 && withIcp.dealValue <= 40_000);

  const withoutIcp = estimateDealValue({ icpMin: null, icpMax: null, companySize: "1000+" });
  assert.equal(withoutIcp.basis, "account_size_heuristic");
  assert.ok(withoutIcp.dealValue > 0);
});

test("bigger companies skew to larger estimated deals", () => {
  const small = estimateDealValue({ icpMin: 10_000, icpMax: 30_000, companySize: "1-10" });
  const large = estimateDealValue({ icpMin: 10_000, icpMax: 30_000, companySize: "1000+" });
  assert.ok(large.dealValue > small.dealValue);
});
