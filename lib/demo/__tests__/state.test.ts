import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL, reducer, type DemoState } from "@/lib/demo/state";
import { GUIDED_DEMO_STEPS, TOTAL_STEPS } from "@/lib/demo/steps";
import {
  ADVANCED_EXPECTED,
  DEMO_OPPORTUNITY,
  INITIAL_EXPECTED,
} from "@/lib/demo/fixture";

const started = reducer(INITIAL, { type: "start" });

/** Walks the whole tour the way a visitor would: do the task, then advance. */
function playThrough(): DemoState {
  let s = started;
  for (const step of GUIDED_DEMO_STEPS) {
    s = reducer(s, { type: "complete_task", flag: step.completedWhen! });
    s = reducer(s, { type: "next" });
  }
  return s;
}

test("a step cannot be skipped without doing its task", () => {
  // This is the whole point of the guided demo. If `next` ever advances here,
  // the tour has quietly become a slideshow.
  const stuck = reducer(started, { type: "next" });
  assert.equal(stuck.currentStep, 0);

  // Even hammering it changes nothing.
  let s = started;
  for (let i = 0; i < 20; i++) s = reducer(s, { type: "next" });
  assert.equal(s.currentStep, 0);
});

test("completing the task unblocks exactly one step", () => {
  const done = reducer(started, {
    type: "complete_task",
    flag: GUIDED_DEMO_STEPS[0].completedWhen!,
  });
  const advanced = reducer(done, { type: "next" });
  assert.equal(advanced.currentStep, 1);

  // Step 2's own task is still outstanding, so it holds in turn.
  assert.equal(reducer(advanced, { type: "next" }).currentStep, 1);
});

test("the full nine steps can be played to completion", () => {
  const end = playThrough();
  assert.equal(end.tourStatus, "completed");
  assert.equal(end.demoCompleted, true);
});

test("finishing the tour never runs past the last step", () => {
  const end = playThrough();
  assert.ok(end.currentStep <= TOTAL_STEPS - 1);
});

test("updating the opportunity moves stage, probability and revenue together", () => {
  const updated = reducer(started, {
    type: "complete_task",
    flag: "opportunityUpdated",
  });
  assert.equal(updated.stage, DEMO_OPPORTUNITY.advancedStage);
  assert.equal(updated.winProbability, DEMO_OPPORTUNITY.advancedWinProbability);
  assert.equal(updated.expectedRevenue, ADVANCED_EXPECTED);
  // And the arithmetic still holds after the move.
  assert.equal(
    updated.expectedRevenue,
    Math.round(DEMO_OPPORTUNITY.dealValue * (updated.winProbability / 100))
  );
});

test("money only moves when the visitor moves it", () => {
  assert.equal(INITIAL.expectedRevenue, INITIAL_EXPECTED);
  assert.equal(INITIAL.stage, DEMO_OPPORTUNITY.initialStage);
  // Any other task leaves the deal untouched.
  const analysed = reducer(started, { type: "complete_task", flag: "analysisCompleted" });
  assert.equal(analysed.expectedRevenue, INITIAL_EXPECTED);
  assert.equal(analysed.stage, DEMO_OPPORTUNITY.initialStage);
});

test("back never goes below the first step", () => {
  let s = started;
  for (let i = 0; i < 5; i++) s = reducer(s, { type: "back" });
  assert.equal(s.currentStep, 0);
});

test("back preserves completed work, so returning does not redo it", () => {
  const done = reducer(started, { type: "complete_task", flag: "signalsExpanded" });
  const forward = reducer(done, { type: "next" });
  const backAgain = reducer(forward, { type: "back" });
  assert.equal(backAgain.signalsExpanded, true);
});

test("restart clears every flag and the money", () => {
  const end = playThrough();
  const fresh = reducer(end, { type: "restart" });

  assert.equal(fresh.currentStep, 0);
  assert.equal(fresh.tourStatus, "active");
  assert.equal(fresh.stage, DEMO_OPPORTUNITY.initialStage);
  assert.equal(fresh.expectedRevenue, INITIAL_EXPECTED);
  for (const step of GUIDED_DEMO_STEPS) {
    assert.equal(fresh[step.completedWhen!], false, `${step.completedWhen} survived restart`);
  }
});

test("exiting and skipping stop the tour without destroying progress", () => {
  const done = reducer(started, { type: "complete_task", flag: "signalsExpanded" });
  assert.equal(reducer(done, { type: "exit" }).signalsExpanded, true);
  assert.equal(reducer(done, { type: "skip_tour" }).tourStatus, "exited");
  // Skipping leaves the workspace usable rather than wiping the session.
  assert.equal(reducer(done, { type: "skip_tour" }).signalsExpanded, true);
});

test("go_to is clamped to the real step range", () => {
  assert.equal(reducer(started, { type: "go_to", index: -5 }).currentStep, 0);
  assert.equal(
    reducer(started, { type: "go_to", index: 99 }).currentStep,
    TOTAL_STEPS - 1
  );
});

test("hydrating from a partial stored blob cannot leave a hole", () => {
  // sessionStorage may hold a blob written by an older build.
  const partial = { ...INITIAL, currentStep: 3, signalsExpanded: true };
  const s = reducer(INITIAL, { type: "hydrate", state: partial });
  assert.equal(s.currentStep, 3);
  assert.equal(s.expectedRevenue, INITIAL_EXPECTED);
});
