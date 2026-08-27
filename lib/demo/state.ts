import {
  ADVANCED_EXPECTED,
  DEMO_OPPORTUNITY,
  INITIAL_EXPECTED,
} from "@/lib/demo/fixture";
import { GUIDED_DEMO_STEPS, TOTAL_STEPS, type DemoFlag } from "@/lib/demo/steps";

/**
 * The demo's state machine, with no React in it.
 *
 * Split out from the provider so the advancement rule can be tested directly.
 * That rule is the difference between a guided demo and a slideshow: `next`
 * refuses to move past a step whose required task has not happened, so no
 * amount of clicking can skip the work. A gate that only existed as a hidden
 * button would be one refactor away from disappearing.
 */

export const STORAGE_KEY = "sellora-guided-demo-v1";

export interface DemoState {
  currentStep: number;
  tourStatus: "not_started" | "active" | "completed" | "exited";
  // ── Task flags, one per required interaction ──
  opportunityOpened: boolean;
  signalsExpanded: boolean;
  analysisCompleted: boolean;
  recommendationGenerated: boolean;
  draftOpened: boolean;
  actionApproved: boolean;
  buyerResponseReceived: boolean;
  opportunityUpdated: boolean;
  demoCompleted: boolean;
  // ── The opportunity as the visitor has changed it ──
  stage: string;
  winProbability: number;
  expectedRevenue: number;
}

export const INITIAL: DemoState = {
  currentStep: 0,
  tourStatus: "not_started",
  opportunityOpened: false,
  signalsExpanded: false,
  analysisCompleted: false,
  recommendationGenerated: false,
  draftOpened: false,
  actionApproved: false,
  buyerResponseReceived: false,
  opportunityUpdated: false,
  demoCompleted: false,
  stage: DEMO_OPPORTUNITY.initialStage,
  winProbability: DEMO_OPPORTUNITY.initialWinProbability,
  expectedRevenue: INITIAL_EXPECTED,
};

export type Action =
  | { type: "start" }
  | { type: "complete_task"; flag: DemoFlag }
  | { type: "next" }
  | { type: "back" }
  | { type: "go_to"; index: number }
  | { type: "skip_tour" }
  | { type: "exit" }
  | { type: "restart" }
  | { type: "hydrate"; state: DemoState };

export function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "start":
      return { ...state, tourStatus: "active", currentStep: 0 };

    case "complete_task": {
      const next: DemoState = { ...state, [action.flag]: true };

      // Updating the opportunity is the one task that moves money. Applying it
      // here — not in the component that owns the button — keeps the numbers
      // identical on every route that reads them.
      if (action.flag === "opportunityUpdated") {
        next.stage = DEMO_OPPORTUNITY.advancedStage;
        next.winProbability = DEMO_OPPORTUNITY.advancedWinProbability;
        next.expectedRevenue = ADVANCED_EXPECTED;
      }
      if (action.flag === "demoCompleted") {
        next.tourStatus = "completed";
      }
      return next;
    }

    case "next": {
      const step = GUIDED_DEMO_STEPS[state.currentStep];
      // The gate. A required task that has not happened blocks advancement,
      // whatever the UI thinks it is doing.
      if (step?.completedWhen && !state[step.completedWhen]) return state;
      if (state.currentStep >= TOTAL_STEPS - 1) {
        return { ...state, tourStatus: "completed" };
      }
      return { ...state, currentStep: state.currentStep + 1 };
    }

    case "back":
      return { ...state, currentStep: Math.max(0, state.currentStep - 1) };

    case "go_to":
      return {
        ...state,
        currentStep: Math.min(Math.max(0, action.index), TOTAL_STEPS - 1),
      };

    // Skipping abandons the coachmarks but leaves the workspace usable, so a
    // visitor who wants to poke around freely still can.
    case "skip_tour":
      return { ...state, tourStatus: "exited" };

    case "exit":
      return { ...state, tourStatus: "exited" };

    case "restart":
      return { ...INITIAL, tourStatus: "active" };

    case "hydrate":
      return action.state;
  }
}

