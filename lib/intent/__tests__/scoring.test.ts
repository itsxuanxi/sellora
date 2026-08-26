import { test } from "node:test";
import assert from "node:assert/strict";
import { computeIntentScore } from "@/lib/intent/scoring";
import { SIGNAL_WEIGHTS } from "@/lib/intent/config";

const NOW = new Date("2026-08-23T00:00:00.000Z");
function daysAgo(n: number) {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

test("no signals ⇒ score 0, low confidence, insufficient evidence", () => {
  const result = computeIntentScore([], 0, NOW);
  assert.equal(result.score, 0);
  assert.equal(result.confidence, "low");
  assert.match(result.whyNow[0], /Insufficient evidence/);
});

test("a single fresh signal scores its full base weight and caps confidence at medium", () => {
  const result = computeIntentScore(
    [{ signalType: "funding_round", occurredAt: daysAgo(2), confidence: "high" }],
    0,
    NOW
  );
  assert.equal(result.score, SIGNAL_WEIGHTS.funding_round);
  assert.equal(result.confidence, "medium"); // only 1 distinct signal type
});

test("two distinct fresh high-confidence signals reach high confidence and sum weights", () => {
  const result = computeIntentScore(
    [
      { signalType: "funding_round", occurredAt: daysAgo(1), confidence: "high" },
      { signalType: "job_surge", occurredAt: daysAgo(1), confidence: "high" },
    ],
    0,
    NOW
  );
  assert.equal(result.score, SIGNAL_WEIGHTS.funding_round + SIGNAL_WEIGHTS.job_surge);
  assert.equal(result.confidence, "high");
});

test("a low-confidence signal present caps overall confidence even with 2+ types", () => {
  const result = computeIntentScore(
    [
      { signalType: "funding_round", occurredAt: daysAgo(1), confidence: "high" },
      { signalType: "job_surge", occurredAt: daysAgo(1), confidence: "low" },
    ],
    0,
    NOW
  );
  assert.equal(result.confidence, "medium");
});

test("signals older than 90 days decay to the smallest multiplier", () => {
  const result = computeIntentScore(
    [{ signalType: "headcount_growth", occurredAt: daysAgo(120), confidence: "high" }],
    0,
    NOW
  );
  assert.equal(result.score, Math.round(SIGNAL_WEIGHTS.headcount_growth * 0.15));
});

test("expired signals are excluded entirely from scoring", () => {
  const result = computeIntentScore(
    [{ signalType: "job_surge", occurredAt: daysAgo(1), confidence: "high", expired: true }],
    0,
    NOW
  );
  assert.equal(result.score, 0);
  assert.match(result.whyNow[0], /Insufficient evidence/);
});

test("a conflict count caps confidence at low regardless of signal strength", () => {
  const result = computeIntentScore(
    [
      { signalType: "funding_round", occurredAt: daysAgo(1), confidence: "high" },
      { signalType: "job_surge", occurredAt: daysAgo(1), confidence: "high" },
    ],
    2,
    NOW
  );
  assert.equal(result.confidence, "low");
});

test("score is clamped to 100 even when many high-weight signals fire", () => {
  const result = computeIntentScore(
    [
      { signalType: "funding_round", occurredAt: daysAgo(1), confidence: "high" },
      { signalType: "job_surge", occurredAt: daysAgo(1), confidence: "high" },
      { signalType: "hard_to_fill_role", occurredAt: daysAgo(1), confidence: "high" },
      { signalType: "new_hiring_leader", occurredAt: daysAgo(1), confidence: "high" },
      { signalType: "stale_role", occurredAt: daysAgo(1), confidence: "high" },
      { signalType: "repeated_role_posting", occurredAt: daysAgo(1), confidence: "high" },
      { signalType: "hiring_velocity_up", occurredAt: daysAgo(1), confidence: "high" },
    ],
    0,
    NOW
  );
  assert.equal(result.score, 100);
});

test("an unknown signal type is ignored rather than crashing the scorer", () => {
  const result = computeIntentScore(
    [{ signalType: "totally_made_up", occurredAt: daysAgo(1), confidence: "high" }],
    0,
    NOW
  );
  assert.equal(result.score, 0);
});
