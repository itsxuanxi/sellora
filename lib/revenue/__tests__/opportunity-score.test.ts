import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOpportunityScore } from "@/lib/revenue/opportunity-score";
import { DIMENSION_MAX, STAGE_WIN_BASELINE } from "@/lib/revenue/config";
import type { OpportunityScoreInput } from "@/lib/revenue/opportunity-score";

const NOW = new Date("2026-08-25T12:00:00.000Z");
function daysAgo(n: number) {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function baseInput(overrides: Partial<OpportunityScoreInput> = {}): OpportunityScoreInput {
  return {
    stage: "QUALIFYING",
    dealValue: 10_000,
    signals: [],
    fit: {},
    engagement: {
      emailsOpened: 0,
      emailsReplied: 0,
      meetingsHeld: 0,
      proposalsSent: 0,
      siteVisits: 0,
      unansweredOutbound: 0,
    },
    lastInteractionAt: null,
    theyRepliedLast: false,
    ...overrides,
  };
}

test("an empty opportunity scores low with low confidence", () => {
  const r = computeOpportunityScore(baseInput(), NOW);
  assert.ok(r.score < 40, `expected cold score, got ${r.score}`);
  assert.equal(r.confidence, "low");
  assert.equal(r.band, "cold");
});

test("score is always clamped to 0-100 even when every dimension maxes out", () => {
  const r = computeOpportunityScore(
    baseInput({
      stage: "NEGOTIATION",
      dealValue: 100_000,
      fit: {
        industryMatch: true,
        companySizeMatch: true,
        regionMatch: true,
        buyerTitleMatch: true,
      },
      signals: [
        { signalType: "proposal_opened", occurredAt: daysAgo(1), confidence: "high" },
        { signalType: "pricing_page_viewed", occurredAt: daysAgo(1), confidence: "high" },
        { signalType: "multi_stakeholder", occurredAt: daysAgo(1), confidence: "high" },
        { signalType: "funding_round", occurredAt: daysAgo(3), confidence: "high" },
      ],
      engagement: {
        emailsOpened: 10,
        emailsReplied: 5,
        meetingsHeld: 3,
        proposalsSent: 2,
        siteVisits: 9,
        unansweredOutbound: 0,
      },
      lastInteractionAt: daysAgo(1),
      theyRepliedLast: true,
      icpDealRange: { min: 5_000, max: 100_000 },
    }),
    NOW
  );
  assert.ok(r.score <= 100 && r.score >= 0);
  assert.equal(r.band, "hot");
});

test("each dimension is capped at its own budget so one factor cannot dominate", () => {
  const r = computeOpportunityScore(
    baseInput({
      engagement: {
        emailsOpened: 50,
        emailsReplied: 50,
        meetingsHeld: 50,
        proposalsSent: 50,
        siteVisits: 50,
        unansweredOutbound: 0,
      },
    }),
    NOW
  );
  assert.ok(
    r.dimensionTotals.engagement <= DIMENSION_MAX.engagement,
    `engagement ${r.dimensionTotals.engagement} exceeded cap ${DIMENSION_MAX.engagement}`
  );
});

test("silence produces a negative relationship-health score", () => {
  const r = computeOpportunityScore(
    baseInput({ lastInteractionAt: daysAgo(25) }),
    NOW
  );
  assert.ok(
    r.dimensionTotals.relationship_health < 0,
    `expected negative health, got ${r.dimensionTotals.relationship_health}`
  );
  assert.ok(r.whyNow.some((w) => w.startsWith("−")), "expected a negative reason in whyNow");
});

test("recent contact scores better than long silence, all else equal", () => {
  const shared = {
    fit: { industryMatch: true },
    engagement: {
      emailsOpened: 2,
      emailsReplied: 1,
      meetingsHeld: 0,
      proposalsSent: 0,
      siteVisits: 0,
      unansweredOutbound: 0,
    },
  };
  const fresh = computeOpportunityScore(
    baseInput({ ...shared, lastInteractionAt: daysAgo(1) }),
    NOW
  );
  const stale = computeOpportunityScore(
    baseInput({ ...shared, lastInteractionAt: daysAgo(30) }),
    NOW
  );
  assert.ok(fresh.score > stale.score, `${fresh.score} should beat ${stale.score}`);
});

test("win probability tracks the stage baseline and is modulated by score", () => {
  const weak = computeOpportunityScore(baseInput({ stage: "PROPOSAL" }), NOW);
  const strong = computeOpportunityScore(
    baseInput({
      stage: "PROPOSAL",
      fit: { industryMatch: true, companySizeMatch: true, regionMatch: true, buyerTitleMatch: true },
      signals: [
        { signalType: "proposal_opened", occurredAt: daysAgo(1), confidence: "high" },
        { signalType: "pricing_page_viewed", occurredAt: daysAgo(1), confidence: "high" },
      ],
      engagement: {
        emailsOpened: 3,
        emailsReplied: 2,
        meetingsHeld: 1,
        proposalsSent: 1,
        siteVisits: 2,
        unansweredOutbound: 0,
      },
      lastInteractionAt: daysAgo(1),
      theyRepliedLast: true,
    }),
    NOW
  );

  assert.ok(strong.winProbability > weak.winProbability);
  assert.ok(strong.winProbability > STAGE_WIN_BASELINE.PROPOSAL);
  assert.ok(weak.winProbability < STAGE_WIN_BASELINE.PROPOSAL);
  assert.ok(strong.winProbability <= 95, "probability must stay below certainty");
});

test("closed stages report their factual probability, not an estimate", () => {
  const won = computeOpportunityScore(baseInput({ stage: "WON" }), NOW);
  const lost = computeOpportunityScore(baseInput({ stage: "LOST" }), NOW);
  assert.equal(won.winProbability, 100);
  assert.equal(lost.winProbability, 0);
});

test("expected value equals deal value times probability", () => {
  const r = computeOpportunityScore(
    baseInput({ stage: "WON", dealValue: 25_000 }),
    NOW
  );
  assert.equal(r.expectedValue, 25_000);
});

test("every factor carries a human-readable reason — no unexplained score", () => {
  const r = computeOpportunityScore(
    baseInput({
      fit: { industryMatch: true },
      lastInteractionAt: daysAgo(10),
      signals: [{ signalType: "pricing_page_viewed", occurredAt: daysAgo(2), confidence: "high" }],
    }),
    NOW
  );
  assert.ok(r.factors.length > 0);
  for (const f of r.factors) {
    assert.ok(f.reason.length > 0, `factor ${f.ruleKey} has no reason`);
    assert.ok(f.label.length > 0, `factor ${f.ruleKey} has no label`);
  }
});

test("a missing ICP is scored neutrally rather than as a zero", () => {
  const unknown = computeOpportunityScore(baseInput({ fit: { icpUnknown: true } }), NOW);
  const noMatch = computeOpportunityScore(baseInput({ fit: {} }), NOW);
  assert.ok(unknown.dimensionTotals.fit > noMatch.dimensionTotals.fit);
});

test("a genuinely hot deal clears the hot band despite a small silence penalty", () => {
  // Regression: a linear intent/100 mapping compressed real deals into the
  // 30s-60s, so a proposal-opened, pricing-viewed, meeting-held deal read as
  // lukewarm. Strong evidence must land in the hot band.
  const r = computeOpportunityScore(
    baseInput({
      stage: "PROPOSAL",
      dealValue: 24_000,
      fit: {
        industryMatch: true,
        companySizeMatch: true,
        regionMatch: true,
        buyerTitleMatch: true,
      },
      signals: [
        { signalType: "proposal_opened", occurredAt: daysAgo(4), confidence: "high" },
        { signalType: "pricing_page_viewed", occurredAt: daysAgo(2), confidence: "high" },
        { signalType: "meeting_attended", occurredAt: daysAgo(11), confidence: "high" },
      ],
      engagement: {
        emailsOpened: 2,
        emailsReplied: 1,
        meetingsHeld: 1,
        proposalsSent: 1,
        siteVisits: 1,
        unansweredOutbound: 0,
      },
      lastInteractionAt: daysAgo(4),
      theyRepliedLast: false,
      icpDealRange: { min: 6_000, max: 40_000 },
    }),
    NOW
  );
  assert.ok(r.score >= 70, `expected a hot score, got ${r.score}`);
  assert.equal(r.band, "hot");
});

test("the signals dimension pays out fully once intent saturates", () => {
  const strong = computeOpportunityScore(
    baseInput({
      signals: [
        { signalType: "proposal_opened", occurredAt: daysAgo(1), confidence: "high" },
        { signalType: "pricing_page_viewed", occurredAt: daysAgo(1), confidence: "high" },
        { signalType: "multi_stakeholder", occurredAt: daysAgo(1), confidence: "high" },
      ],
    }),
    NOW
  );
  assert.equal(strong.dimensionTotals.buying_signals, DIMENSION_MAX.buying_signals);
});

test("scoring is deterministic for the same input and clock", () => {
  const input = baseInput({
    fit: { industryMatch: true },
    lastInteractionAt: daysAgo(5),
    signals: [{ signalType: "proposal_opened", occurredAt: daysAgo(1), confidence: "high" }],
  });
  const a = computeOpportunityScore(input, NOW);
  const b = computeOpportunityScore(input, NOW);
  assert.deepEqual(a, b);
});
