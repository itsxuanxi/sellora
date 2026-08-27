import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADVANCED_EXPECTED,
  DEMO_OPPORTUNITY,
  DEMO_PIPELINE,
  DEMO_RECOMMENDATION,
  DEMO_SIGNALS,
  DEMO_SUMMARY,
  EXPECTED_UPLIFT,
  INITIAL_EXPECTED,
  RANKED_PIPELINE,
  expectedRevenue,
  formatUsd,
} from "@/lib/demo/fixture";
import {
  GUIDED_DEMO_STEPS,
  TOTAL_STEPS,
  DEMO_ROUTES,
  firstStepOnRoute,
} from "@/lib/demo/steps";

// ── Money ────────────────────────────────────────────────────────────────

test("the demo's two headline figures follow from deal value × win probability", () => {
  assert.equal(INITIAL_EXPECTED, 21_840);
  assert.equal(ADVANCED_EXPECTED, 29_820);
  assert.equal(
    INITIAL_EXPECTED,
    expectedRevenue(DEMO_OPPORTUNITY.dealValue, DEMO_OPPORTUNITY.initialWinProbability)
  );
  assert.equal(
    ADVANCED_EXPECTED,
    expectedRevenue(DEMO_OPPORTUNITY.dealValue, DEMO_OPPORTUNITY.advancedWinProbability)
  );
});

test("the uplift is the difference, not a separately typed number", () => {
  assert.equal(EXPECTED_UPLIFT, 7_980);
  assert.equal(EXPECTED_UPLIFT, ADVANCED_EXPECTED - INITIAL_EXPECTED);
});

test("every pipeline row's expected revenue matches its own inputs", () => {
  for (const r of DEMO_PIPELINE) {
    assert.equal(r.expected, expectedRevenue(r.dealValue, r.winProbability), r.company);
  }
});

test("Cloudmint ranks first on expected revenue despite not being the biggest deal", () => {
  assert.equal(RANKED_PIPELINE[0].id, "cloudmint");
  const biggest = [...DEMO_PIPELINE].sort((a, b) => b.dealValue - a.dealValue)[0];
  assert.notEqual(biggest.id, "cloudmint");
  // The ordering really is by expected revenue.
  const expected = RANKED_PIPELINE.map((r) => r.expected);
  assert.deepEqual(expected, [...expected].sort((a, b) => b - a));
});

test("the completion summary reports the signals that actually exist", () => {
  const signals = DEMO_SUMMARY.find((s) => s.label === "Signals analyzed");
  assert.equal(signals?.value, String(DEMO_SIGNALS.length));
  const revenue = DEMO_SUMMARY.find((s) => s.label === "Expected revenue");
  assert.equal(
    revenue?.value,
    `${formatUsd(INITIAL_EXPECTED)} → ${formatUsd(ADVANCED_EXPECTED)}`
  );
});

test("the recommendation cites signals that exist in the timeline", () => {
  const ids = new Set(DEMO_SIGNALS.map((s) => s.id));
  for (const id of DEMO_RECOMMENDATION.supportingSignalIds) {
    assert.ok(ids.has(id), `recommendation cites unknown signal "${id}"`);
  }
});

// ── The tour ─────────────────────────────────────────────────────────────

test("there are nine steps and each is on a real demo route", () => {
  assert.equal(TOTAL_STEPS, 9);
  const routes = new Set<string>(Object.values(DEMO_ROUTES));
  for (const step of GUIDED_DEMO_STEPS) {
    assert.ok(routes.has(step.route), `${step.id} points at unknown route ${step.route}`);
  }
});

test("every step requires a real interaction, with a flag to prove it", () => {
  // If any step could be advanced by a Continue button, the demo would be a
  // slideshow again. This is the guard against that regressing.
  for (const step of GUIDED_DEMO_STEPS) {
    assert.equal(step.requiredAction, "click", `${step.id} has no required action`);
    assert.ok(step.completedWhen, `${step.id} has no completion flag`);
  }
});

test("step ids and targets are unique", () => {
  const ids = GUIDED_DEMO_STEPS.map((s) => s.id);
  const targets = GUIDED_DEMO_STEPS.map((s) => s.target);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(targets).size, targets.length);
});

test("the routes only ever move forward through the story", () => {
  const order: string[] = [
    DEMO_ROUTES.workspace,
    DEMO_ROUTES.opportunity,
    DEMO_ROUTES.analytics,
  ];
  let seen = -1;
  for (const step of GUIDED_DEMO_STEPS) {
    const i = order.indexOf(step.route);
    assert.ok(i >= seen, `${step.id} sends the visitor backwards to ${step.route}`);
    seen = i;
  }
});

test("a direct visit to a sub-route resolves to a step on that route", () => {
  assert.equal(GUIDED_DEMO_STEPS[firstStepOnRoute(DEMO_ROUTES.workspace)].route, DEMO_ROUTES.workspace);
  assert.equal(GUIDED_DEMO_STEPS[firstStepOnRoute(DEMO_ROUTES.opportunity)].route, DEMO_ROUTES.opportunity);
  assert.equal(GUIDED_DEMO_STEPS[firstStepOnRoute(DEMO_ROUTES.analytics)].route, DEMO_ROUTES.analytics);
  // An unknown route falls back to the beginning rather than throwing.
  assert.equal(firstStepOnRoute("/nope" as string), 0);
});

test("nothing in the demo copy claims a win or a caused outcome", () => {
  const prose = [
    ...GUIDED_DEMO_STEPS.flatMap((s) => [s.title, s.description, s.instruction]),
    ...DEMO_SUMMARY.map((s) => `${s.label} ${s.value}`),
  ]
    .join(" ")
    .toLowerCase();

  for (const banned of ["closed won", "won the deal", "caused", "guaranteed", "increased revenue by"]) {
    assert.ok(!prose.includes(banned), `demo copy claims too much: "${banned}"`);
  }
});
