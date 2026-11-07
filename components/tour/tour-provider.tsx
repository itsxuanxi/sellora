"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { prefersReducedMotion } from "@/lib/motion";
import {
  TOUR_STEPS,
  TOTAL_TOUR_STEPS,
  firstStepOnRoute,
  stepMatchesRoute,
  type TourStep,
} from "@/lib/tour/steps";

/**
 * Tour state, in the browser only.
 *
 * The tour never drives the product — it observes it. Progress lives here and
 * in sessionStorage; the application underneath renders and behaves exactly
 * as it would with the tour switched off, which is what lets the same
 * components serve a customer and a visitor.
 */

const STORAGE_KEY = "selryn-tour-v2";

interface TourState {
  // "completed" and "skipped" are kept apart because only one of them has
  // earned a result screen. Collapsing them would congratulate someone who
  // clicked Skip on the first step.
  status: "idle" | "running" | "completed" | "skipped";
  index: number;
}

const INITIAL: TourState = { status: "idle", index: 0 };

type Action =
  | { type: "start" }
  | { type: "advance" }
  | { type: "back" }
  | { type: "goTo"; index: number }
  | { type: "complete" }
  | { type: "skip" }
  | { type: "dismiss" }
  | { type: "hydrate"; state: TourState };

function reducer(state: TourState, action: Action): TourState {
  switch (action.type) {
    case "start":
      return { status: "running", index: 0 };
    case "advance":
      return state.index >= TOTAL_TOUR_STEPS - 1
        ? { status: "completed", index: state.index }
        : { ...state, index: state.index + 1 };
    case "back":
      return { ...state, index: Math.max(0, state.index - 1) };
    case "goTo":
      return { ...state, index: Math.min(Math.max(0, action.index), TOTAL_TOUR_STEPS - 1) };
    case "complete":
      return { ...state, status: "completed" };
    case "skip":
      return { ...state, status: "skipped" };
    case "dismiss":
      return { ...state, status: "skipped" };
    case "hydrate":
      return action.state;
  }
}

export interface TourContextValue {
  step: TourStep | null;
  index: number;
  total: number;
  running: boolean;
  /** The story was finished — show the result screen. */
  completed: boolean;
  /** The visitor asked for less motion; scrolls jump rather than glide. */
  reduced: boolean;
  /** True once sessionStorage has been read — gate UI on this. */
  hydrated: boolean;
  start: () => void;
  advance: () => void;
  back: () => void;
  complete: () => void;
  skip: () => void;
  dismiss: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({
  children,
  autoStart = false,
}: {
  children: React.ReactNode;
  /** Start on first load — a fresh sandbox opens straight into the tour. */
  autoStart?: boolean;
}) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [reduced, setReduced] = useState(false);
  const pathname = usePathname();

  useEffect(() => setReduced(prefersReducedMotion()), []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", state: { ...INITIAL, ...JSON.parse(raw) } });
    } catch {
      // A blocked or corrupt store just means the tour starts fresh.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Non-fatal: the tour still works for this page view.
    }
  }, [state, hydrated]);

  // A visitor who has never seen the tour gets it; one who skipped or
  // finished it is not shown it again in this session.
  useEffect(() => {
    if (hydrated && autoStart && state.status === "idle") dispatch({ type: "start" });
  }, [hydrated, autoStart, state.status]);

  const running = hydrated && state.status === "running";
  const completed = hydrated && state.status === "completed";
  const rawStep = running ? (TOUR_STEPS[state.index] ?? null) : null;

  // If the visitor wanders off the step's route — a back button, a nav click,
  // a bookmarked link — follow them to the nearest step on the page they are
  // actually looking at rather than nagging them back.
  useEffect(() => {
    if (!running || !rawStep) return;
    if (stepMatchesRoute(rawStep, pathname)) return;
    const next = firstStepOnRoute(pathname);
    if (next !== state.index) dispatch({ type: "goTo", index: next });
  }, [running, rawStep, pathname, state.index]);

  // Only show a step once its route actually matches, so nothing points at an
  // element that is not on screen.
  const step = rawStep && stepMatchesRoute(rawStep, pathname) ? rawStep : null;

  const value = useMemo<TourContextValue>(
    () => ({
      step,
      index: state.index,
      total: TOTAL_TOUR_STEPS,
      running,
      completed,
      reduced,
      hydrated,
      start: () => dispatch({ type: "start" }),
      advance: () => dispatch({ type: "advance" }),
      back: () => dispatch({ type: "back" }),
      complete: () => dispatch({ type: "complete" }),
      skip: () => dispatch({ type: "skip" }),
      dismiss: () => dispatch({ type: "dismiss" }),
    }),
    [step, state.index, running, completed, reduced, hydrated]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside a TourProvider");
  return ctx;
}

/** For chrome that renders both inside and outside a sandbox. */
export function useOptionalTour(): TourContextValue | null {
  return useContext(TourContext);
}

/**
 * How long to wait for a step's target before admitting it is not coming.
 *
 * Eight seconds, not four. A heavy deal page streaming in behind a
 * client-side navigation took longer than four on a cold dev server, so the
 * card flashed "this part of the screen did not load" and then corrected
 * itself a second later. Recovering is right; showing the failure first is
 * not, and the cost of waiting longer is only that a genuinely missing anchor
 * is admitted a few seconds later.
 */
export const TARGET_WAIT_MS = 8000;

export type TargetPhase = "searching" | "found" | "missing";

/**
 * Finds a step's target element, and says whether it is still looking.
 *
 * Polled on a timer rather than watched with a MutationObserver.
 *
 * The target arrives asynchronously — a client-side navigation streams the
 * opportunity page in after the step has already changed — and an observer
 * that misses the mutation leaves the step permanently unanchored, which
 * looks like the tour pointing at nothing.
 *
 * A timer rather than requestAnimationFrame because rAF does not run while
 * the document is hidden: a tour that was mid-step when the tab was
 * backgrounded would come back with nothing anchored and never recover.
 *
 * The phase exists because "not found yet" and "not coming" need different
 * screens and the caller cannot tell them apart from a null. Previously a
 * step whose target had not streamed in yet rendered instantly as a floating
 * card with a Next button — indistinguishable from a step whose anchor does
 * not exist at all, and clicking Next on the first step of the story skipped
 * the thing it was about. Now the card waits, and then says plainly that it
 * cannot find the control, with a way to look again.
 */
export function useTourTarget(target: string | undefined) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [phase, setPhase] = useState<TargetPhase>("searching");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!target) {
      setEl(null);
      setPhase("searching");
      return;
    }

    setPhase("searching");
    let current: HTMLElement | null = null;
    const startedAt = Date.now();

    const tick = () => {
      const found = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (found !== current) {
        current = found;
        setEl(found);
      }
      if (found) setPhase("found");
      else if (Date.now() - startedAt > TARGET_WAIT_MS) setPhase("missing");
      // Still inside the window and still nothing: stay "searching". The
      // element may be two renders away.
    };

    tick();
    const timer = window.setInterval(tick, 120);
    return () => window.clearInterval(timer);
    // `attempt` is the retry handle: bumping it re-runs the whole search with
    // a fresh clock.
  }, [target, attempt]);

  return {
    el,
    phase,
    retry: () => setAttempt((n) => n + 1),
  };
}
