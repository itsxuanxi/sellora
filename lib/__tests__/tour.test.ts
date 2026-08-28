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
  const i = firstStepOnRoute("/analytics");
  assert.ok(stepMatchesRoute(TOUR_STEPS[i], "/analytics"));

  const j = firstStepOnRoute("/opportunities/anything");
  assert.ok(stepMatchesRoute(TOUR_STEPS[j], "/opportunities/anything"));
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
