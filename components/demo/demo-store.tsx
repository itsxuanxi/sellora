"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  GUIDED_DEMO_STEPS,
  TOTAL_STEPS,
  firstStepOnRoute,
  type DemoFlag,
  type GuidedDemoStep,
} from "@/lib/demo/steps";
import {
  INITIAL,
  STORAGE_KEY,
  reducer,
  type DemoState,
} from "@/lib/demo/state";

/**
 * All demo state, in the browser only.
 *
 * There is no server action, no API route and no database anywhere in the
 * demo. Progress lives in this reducer and is mirrored to sessionStorage so a
 * refresh resumes where the visitor was. sessionStorage rather than
 * localStorage deliberately: a demo that silently resumes weeks later in a
 * half-finished state is confusing, and per-tab isolation means two open tabs
 * do not fight over one progress counter.
 *
 * The advancement rule is enforced here rather than in the UI. `next()`
 * refuses to move past a step whose `completedWhen` flag is still false, so a
 * required task cannot be skipped by any amount of clicking — there is no
 * Continue button to hide, because the reducer would ignore it.
 */

export interface DemoContextValue {
  state: DemoState;
  /** The step being shown, or null when the tour is not running. */
  step: GuidedDemoStep | null;
  stepNumber: number;
  totalSteps: number;
  /** True once sessionStorage has been read — gate UI on this, not on state. */
  hydrated: boolean;
  isTourActive: boolean;
  /** Whether the current step's required task is done. */
  currentTaskDone: boolean;
  start: () => void;
  completeTask: (flag: DemoFlag) => void;
  next: () => void;
  back: () => void;
  skipTour: () => void;
  exit: () => void;
  restart: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function GuidedDemoProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  // Never render persisted state on the first paint: the server rendered the
  // pristine tour, and painting a restored step before hydration completes is
  // exactly how a hydration mismatch happens.
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // ── Restore ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DemoState>;
        // Merge over INITIAL so a stored blob from an older shape cannot leave
        // a required key undefined.
        dispatch({ type: "hydrate", state: { ...INITIAL, ...parsed } });
      }
    } catch {
      // A malformed or blocked store is not worth breaking the demo over.
    }
    setHydrated(true);
  }, []);

  // ── Persist ──
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing can refuse writes; the demo still works in-memory.
    }
  }, [state, hydrated]);

  const isTourActive = hydrated && state.tourStatus === "active";
  const step = isTourActive ? (GUIDED_DEMO_STEPS[state.currentStep] ?? null) : null;

  // ── Keep the URL and the step in agreement ──
  // A visitor who refreshes on the wrong route, or types one in, is moved to
  // the route the current step actually lives on rather than being shown a
  // coachmark pointing at an element that is not on the page.
  useEffect(() => {
    if (!isTourActive || !step) return;
    if (pathname !== step.route) router.push(step.route);
  }, [isTourActive, step, pathname, router]);

  const completeTask = useCallback((flag: DemoFlag) => {
    dispatch({ type: "complete_task", flag });
  }, []);

  const value = useMemo<DemoContextValue>(() => {
    const currentTaskDone = step?.completedWhen
      ? Boolean(state[step.completedWhen])
      : true;

    return {
      state,
      step,
      stepNumber: state.currentStep + 1,
      totalSteps: TOTAL_STEPS,
      hydrated,
      isTourActive,
      currentTaskDone,
      start: () => dispatch({ type: "start" }),
      completeTask,
      next: () => dispatch({ type: "next" }),
      back: () => dispatch({ type: "back" }),
      skipTour: () => dispatch({ type: "skip_tour" }),
      exit: () => dispatch({ type: "exit" }),
      restart: () => dispatch({ type: "restart" }),
    };
  }, [state, step, hydrated, isTourActive, completeTask]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside GuidedDemoProvider");
  return ctx;
}

/**
 * Marks a task done and, when that was the current step's requirement,
 * advances. Components call this from their real handlers, so the tour moves
 * because the product was used — not because a Next button was pressed.
 */
export function useCompleteStep() {
  const { completeTask, next, step } = useDemo();
  return useCallback(
    (flag: DemoFlag) => {
      completeTask(flag);
      if (step?.completedWhen === flag) {
        // Let the flag land before the gate in `next` reads it.
        setTimeout(() => next(), 0);
      }
    },
    [completeTask, next, step]
  );
}

export { firstStepOnRoute, INITIAL as DEMO_INITIAL_STATE, reducer as demoReducer };
