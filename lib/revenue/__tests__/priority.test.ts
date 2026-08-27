import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRIORITY_WEIGHTS,
  byPriority,
  computeActionPriority,
  recommendationConfidence,
  type PriorityInput,
} from "@/lib/revenue/priority";

function input(overrides: Partial<PriorityInput> = {}): PriorityInput {
  return {
    expectedValue: 5_000,
    maxExpectedValue: 10_000,
    urgency: "today",
    score: 50,
    signalStrength: 50,
    actionHitRate: null,
    ...overrides,
  };
}

test("priority stays within 0-100 at both extremes", () => {
  const floor = computeActionPriority(
    input({ expectedValue: 0, maxExpectedValue: 0, urgency: "monitor", score: 100, signalStrength: 0, actionHitRate: 0 })
  );
  assert.equal(floor.score, 0);

  const ceiling = computeActionPriority(
    input({ expectedValue: 10_000, maxExpectedValue: 10_000, urgency: "now", score: 0, signalStrength: 100, actionHitRate: 1 })
  );
  assert.equal(ceiling.score, 100);
});

test("the breakdown accounts for every point of the score", () => {
  const result = computeActionPriority(input());
  const summed = result.breakdown.reduce((total, row) => total + row.points, 0);
  assert.equal(summed, result.score);
});

test("component weights sum to 100, so a full score is reachable", () => {
  const total = Object.values(PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(total, 100);
});

test("a bigger deal outranks a smaller one, all else equal", () => {
  const big = computeActionPriority(input({ expectedValue: 10_000 }));
  const small = computeActionPriority(input({ expectedValue: 1_000 }));
  assert.ok(big.score > small.score);
});

test("expected revenue is relative, so the largest deal always scores full marks", () => {
  // The same absolute value ranks differently depending on the book it sits in.
  const bigBook = computeActionPriority(input({ expectedValue: 40_000, maxExpectedValue: 2_000_000 }));
  const smallBook = computeActionPriority(input({ expectedValue: 40_000, maxExpectedValue: 40_000 }));

  const revenueRow = (r: typeof bigBook) =>
    r.breakdown.find((row) => row.component === "expectedRevenue")!.points;

  assert.equal(revenueRow(smallBook), PRIORITY_WEIGHTS.expectedRevenue);
  assert.ok(revenueRow(bigBook) < revenueRow(smallBook));
});

test("a weaker deal earns more risk weight than a strong one", () => {
  const weak = computeActionPriority(input({ score: 10 }));
  const strong = computeActionPriority(input({ score: 90 }));
  const risk = (r: typeof weak) => r.breakdown.find((row) => row.component === "risk")!.points;
  assert.ok(risk(weak) > risk(strong));
});

test("an untried action scores neutral, not zero", () => {
  // Scoring "never tried" as worthless would stop it ever being tried.
  const untried = computeActionPriority(input({ actionHitRate: null }));
  const failed = computeActionPriority(input({ actionHitRate: 0 }));
  const perfect = computeActionPriority(input({ actionHitRate: 1 }));

  const eff = (r: typeof untried) =>
    r.breakdown.find((row) => row.component === "effectiveness")!.points;

  assert.ok(eff(untried) > eff(failed));
  assert.ok(eff(untried) < eff(perfect));
  assert.equal(eff(untried), Math.round(0.5 * PRIORITY_WEIGHTS.effectiveness));
});

test("an untried action says so rather than quoting a rate", () => {
  const result = computeActionPriority(input({ actionHitRate: null }));
  const row = result.breakdown.find((r) => r.component === "effectiveness")!;
  assert.match(row.reason, /Not enough history/);
  assert.doesNotMatch(row.reason, /\d+%/);
});

test("urgency orders time sensitivity strictly", () => {
  const points = (urgency: PriorityInput["urgency"]) =>
    computeActionPriority(input({ urgency })).breakdown.find(
      (r) => r.component === "timeSensitivity"
    )!.points;

  assert.ok(points("now") > points("today"));
  assert.ok(points("today") > points("this_week"));
  assert.ok(points("this_week") > points("monitor"));
  assert.equal(points("monitor"), 0);
});

test("confidence needs evidence before it can be high", () => {
  assert.equal(
    recommendationConfidence({ supportingSignalCount: 0, actionHitRate: 0.9 }),
    "low"
  );
  assert.equal(
    recommendationConfidence({ supportingSignalCount: 3, actionHitRate: null }),
    "medium"
  );
  assert.equal(
    recommendationConfidence({ supportingSignalCount: 2, actionHitRate: 0.4 }),
    "high"
  );
});

test("byPriority sorts on score, then falls back to urgency", () => {
  const rows = [
    { priorityScore: 50, urgency: "monitor" },
    { priorityScore: 80, urgency: "this_week" },
    { priorityScore: 50, urgency: "now" },
  ];
  const sorted = [...rows].sort(byPriority);
  assert.equal(sorted[0].priorityScore, 80);
  assert.equal(sorted[1].urgency, "now");
  assert.equal(sorted[2].urgency, "monitor");
});
