import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TOUR_STEPS,
  TOTAL_TOUR_STEPS,
  firstStepOnRoute,
  stepMatchesRoute,
} from "@/lib/tour/steps";

/**
 * The tour points at the real application by attribute name, so nothing here
 * can check that the targets exist — only that the step data cannot strand a
 * visitor. The stranding cases are the ones worth guarding.
 */

test("every step declares a target and an instruction", () => {
  for (const step of TOUR_STEPS) {
    assert.ok(step.target.length > 0, `${step.id} has no target`);
    assert.ok(step.instruction.length > 0, `${step.id} has no instruction`);
  }
});

test("step ids are unique", () => {
  const ids = TOUR_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("route matching handles both exact and prefix routes", () => {
  const dashboard = TOUR_STEPS.find((s) => s.route === "/dashboard")!;
  assert.equal(stepMatchesRoute(dashboard, "/dashboard"), true);
  assert.equal(stepMatchesRoute(dashboard, "/dashboards"), false);
  assert.equal(stepMatchesRoute(dashboard, "/opportunities/abc"), false);

  const opportunity = TOUR_STEPS.find((s) => s.route === "/opportunities/")!;
  // The id is generated, so this step has to match any opportunity.
  assert.equal(stepMatchesRoute(opportunity, "/opportunities/cuid123"), true);
  assert.equal(stepMatchesRoute(opportunity, "/dashboard"), false);
});

test("a visitor who wanders lands on a step for the page they are on", () => {
  for (const route of ["/dashboard", "/opportunities/anything"]) {
    const i = firstStepOnRoute(route);
    assert.ok(
      stepMatchesRoute(TOUR_STEPS[i], route),
      `no step resolves for ${route}`
    );
  }
});

test("the story runs dashboard first, then stays on the opportunity", () => {
  // The order is the argument: find the deal, then work it. A step that
  // sent the visitor back to the dashboard mid-story would break the thread.
  const routes = TOUR_STEPS.map((s) => s.route);
  assert.equal(routes[0], "/dashboard");
  assert.ok(routes.slice(1).every((r) => r === "/opportunities/"));
});

test("the four phases appear in order", () => {
  const seen: string[] = [];
  for (const step of TOUR_STEPS) {
    if (seen[seen.length - 1] !== step.phase) seen.push(step.phase);
  }
  assert.deepEqual(seen, ["Detect", "Decide", "Act", "Learn"]);
});

test("the tour states no figure the scoring engine computes", () => {
  // Scores, probabilities and expected revenue are engine output and drift
  // when a weight changes. Only the deal value — an input — may be quoted.
  const prose = TOUR_STEPS.map((s) => `${s.title} ${s.body} ${s.instruction}`).join(" ");
  const amounts = prose.match(/\$[\d,]+/g) ?? [];
  // Quoting nothing is fine and is the safest version. What must never appear
  // is a figure the engine derived; the deal value is an input, so it may.
  for (const amount of new Set(amounts)) {
    assert.equal(amount, "$42,000", `${amount} is not an input the CRM holds`);
  }
  assert.equal(/\d+\s?%/.test(prose), false, "a percentage is quoted in tour copy");
});

test("an unknown route falls back to the first step rather than crashing", () => {
  assert.equal(firstStepOnRoute("/settings"), 0);
});

test("a click step is always reachable from the step before it", () => {
  // A click step demands an interaction on its own route. If the previous step
  // sat on a different route with no way to get here, the tour would deadlock.
  TOUR_STEPS.forEach((step, i) => {
    if (step.advance !== "click" || i === 0) return;
    const previous = TOUR_STEPS[i - 1];
    const sameRoute = previous.route === step.route;
    const previousNavigates = previous.advance === "click";
    assert.ok(
      sameRoute || previousNavigates,
      `${step.id} needs a click but the step before it cannot reach its route`
    );
  });
});

test("the tour ends on a step the visitor can close", () => {
  assert.equal(TOUR_STEPS[TOTAL_TOUR_STEPS - 1].advance, "read");
});
