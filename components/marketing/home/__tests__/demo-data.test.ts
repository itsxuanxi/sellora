import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_DEALS,
  HERO_SCENARIOS,
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
  const revenue = outcome.steps.find(
    (s) => s.action === "outcome" && s.payload.metric === "Expected revenue"
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

test("every hero scenario runs between 5 and 11 seconds", () => {
  for (const scenario of HERO_SCENARIOS) {
    const total = sequenceDuration(scenarioDelays(scenario));
    assert.ok(
      total >= 5000 && total <= 11_000,
      `${scenario.id} runs ${total}ms — too far from the 7–10s target`
    );
  }
});

test("a scenario always outlasts its own steps", () => {
  // If the tab advanced before the last step landed, the visitor would never
  // see the outcome — which is the only part that makes the loop legible.
  for (const scenario of HERO_SCENARIOS) {
    const delays = scenarioDelays(scenario);
    assert.ok(sequenceDuration(delays) > delays.reduce((a, b) => a + b, 0));
  }
  for (const scenario of SCENARIOS) {
    const delays = stepDelays(scenario);
    assert.ok(sequenceDuration(delays, 1600) > delays.reduce((a, b) => a + b, 0));
  }
});

test("hero scenarios cover the full loop across the set", () => {
  const kinds = new Set(HERO_SCENARIOS.flatMap((s) => s.steps.map((x) => x.action)));
  for (const required of ["signal", "analyze", "score", "recommend", "execute", "response", "outcome"]) {
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
