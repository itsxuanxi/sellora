import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_DEALS,
  HERO_SCENARIOS,
  HERO_STAGE_DURATION_MS,
  HERO_STAGE_TAIL_MS,
  RANKED_DEALS,
  SCENARIOS,
  scenarioDelays,
  stepDelays,
} from "@/components/marketing/home/demo-data";
import { sequenceDuration } from "@/components/marketing/home/use-demo-sequence";

// The demo is marketing copy that makes arithmetic claims on screen. These
// guard the claims, not the styling.

test("expected revenue is deal value × probability for every deal", () => {
  for (const d of DEMO_DEALS) {
    assert.equal(
      d.expected,
      Math.round(d.dealValue * (d.probability / 100)),
      `${d.company} expected revenue disagrees with its own inputs`
    );
  }
});

test("the deals match the figures the hero narrates", () => {
  const byName = Object.fromEntries(DEMO_DEALS.map((d) => [d.company, d]));
  assert.equal(byName.Cloudmint.expected, 28_560);
  assert.equal(byName.Brightcart.expected, 24_050);
  assert.equal(byName.Ledgerly.expected, 15_600);
});

test("the ranking really is by expected revenue, not deal size", () => {
  // The scenario's whole point: Brightcart is the bigger deal and still loses.
  const expected = RANKED_DEALS.map((d) => d.expected);
  assert.deepEqual(expected, [...expected].sort((a, b) => b - a));
  assert.equal(RANKED_DEALS[0].company, "Cloudmint");

  const biggestDeal = [...DEMO_DEALS].sort((a, b) => b.dealValue - a.dealValue)[0];
  assert.equal(biggestDeal.company, "Brightcart");
  assert.notEqual(RANKED_DEALS[0].company, biggestDeal.company);
});

test("the outcome scenario's numbers follow from the deal it is about", () => {
  const outcome = HERO_SCENARIOS.find((s) => s.id === "outcome")!;
  const dealValue = outcome.subject.dealValue;

  const winProb = outcome.steps.find((s) => s.action === "score");
  assert.ok(winProb && winProb.action === "score");
  // Matched on shape, not on the label: the panel's wording is copy and may
  // change ("Expected" to "Protected"), but the arithmetic must not.
  const revenue = outcome.steps.find(
    (s) => s.action === "outcome" && s.payload.prefix === "$" && s.payload.from != null
  );
  assert.ok(revenue && revenue.action === "outcome");

  // Both ends of the expected-revenue move must equal value × probability.
  assert.equal(revenue.payload.from, Math.round(dealValue * (winProb.payload.from / 100)));
  assert.equal(revenue.payload.to, Math.round(dealValue * (winProb.payload.to / 100)));
});

test("every hero step has a readable beat", () => {
  for (const scenario of HERO_SCENARIOS) {
    for (const step of scenario.steps) {
      assert.ok(
        step.delay >= 500 && step.delay <= 1200,
        `${scenario.id}/${step.id} delay ${step.delay}ms is outside the 500–1200ms band`
      );
    }
  }
});

test("every hero scenario finishes inside the shared dwell", () => {
  // All four tabs hold for the same period, so the progress line means the
  // same thing on each. That only stays honest if no scenario's steps overrun
  // it: otherwise a tab advances mid-sentence and the reader never sees the
  // result. This is the assertion a fixed dwell would otherwise let slip.
  for (const scenario of HERO_SCENARIOS) {
    const stepTime = scenarioDelays(scenario).reduce((a, b) => a + b, 0);
    assert.ok(
      stepTime + HERO_STAGE_TAIL_MS <= HERO_STAGE_DURATION_MS,
      `${scenario.id} needs ${stepTime}ms of steps, leaving under ${HERO_STAGE_TAIL_MS}ms to read the result inside the ${HERO_STAGE_DURATION_MS}ms dwell`
    );
  }
});

test("the shared dwell is long enough to read but short enough to cycle", () => {
  assert.ok(HERO_STAGE_DURATION_MS >= 5000 && HERO_STAGE_DURATION_MS <= 10_000);
});

test("a scrollytelling scenario always outlasts its own steps", () => {
  // Screen 2 still derives its dwell per scenario: those run 5 to 7 steps of
  // very different lengths.
  for (const scenario of SCENARIOS) {
    const delays = stepDelays(scenario);
    assert.ok(sequenceDuration(delays, 1600) > delays.reduce((a, b) => a + b, 0));
  }
});

test("signal detection shows four distinct signals, not one", () => {
  // A monitor with a single row reads as an illustration. The panel's job is
  // to look like a product with real evidence in it.
  const detection = HERO_SCENARIOS.find((s) => s.id === "detection")!;
  const signals = detection.steps.filter((s) => s.action === "signal");
  assert.ok(signals.length >= 4, `only ${signals.length} signals on the detection panel`);

  const labels = new Set(signals.map((s) => (s.action === "signal" ? s.payload.label : "")));
  assert.equal(labels.size, signals.length, "duplicate signal labels");
});

test("the priority panel ranks at least three real opportunities", () => {
  const priority = HERO_SCENARIOS.find((s) => s.id === "priority")!;
  const ranks = priority.steps.filter((s) => s.action === "rank");
  assert.ok(ranks.length > 0, "no ranked table on the priority panel");

  const known = new Set(DEMO_DEALS.map((d) => d.company));
  for (const step of ranks) {
    if (step.action !== "rank") continue;
    assert.ok(step.payload.order.length >= 3, "fewer than three ranked rows");
    for (const company of step.payload.order) {
      assert.ok(known.has(company), `ranked row "${company}" is not a real demo deal`);
    }
  }
});

test("the ranking really does reorder away from deal size", () => {
  // The panel's whole argument. If both orders matched, it would be showing
  // a sort that changes nothing.
  const priority = HERO_SCENARIOS.find((s) => s.id === "priority")!;
  const ranks = priority.steps.filter((s) => s.action === "rank");
  const first = ranks[0];
  const last = ranks[ranks.length - 1];
  assert.ok(first.action === "rank" && last.action === "rank");
  assert.notDeepEqual(first.payload.order, last.payload.order);

  // And the final order is genuinely by expected revenue.
  const expected = last.payload.order.map(
    (c) => DEMO_DEALS.find((d) => d.company === c)!.expected
  );
  assert.deepEqual(expected, [...expected].sort((a, b) => b - a));
});

test("the next-best-action panel keeps a human in the loop", () => {
  const action = HERO_SCENARIOS.find((s) => s.id === "action")!;
  const approvals = action.steps.filter((s) => s.action === "approve");
  assert.ok(approvals.length >= 2, "no awaiting-then-approved beat");

  const states = approvals.map((s) => (s.action === "approve" ? s.payload.state : ""));
  assert.deepEqual(states, ["awaiting", "approved"]);
});

test("hero scenarios cover the full loop across the set", () => {
  const kinds = new Set(HERO_SCENARIOS.flatMap((s) => s.steps.map((x) => x.action)));
  for (const required of ["signal", "analyze", "score", "rank", "recommend", "approve", "execute", "response", "outcome"]) {
    assert.ok(kinds.has(required as never), `no step anywhere demonstrates "${required}"`);
  }
});

test("nothing claims a recommendation caused a win", () => {
  const prose = [
    ...HERO_SCENARIOS.flatMap((s) => [s.closing, ...s.steps.map((x) => JSON.stringify(x.payload))]),
    ...SCENARIOS.map((s) => s.result),
  ].join(" ").toLowerCase();

  for (const banned of ["caused", "guaranteed", "proven to", "increases revenue by"]) {
    assert.ok(!prose.includes(banned), `demo copy makes a causal claim: "${banned}"`);
  }
});
