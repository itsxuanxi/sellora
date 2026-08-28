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
import { usePathname } from "next/navigation";
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
  status: "idle" | "running" | "finished";
  index: number;
}

const INITIAL: TourState = { status: "idle", index: 0 };

type Action =
  | { type: "start" }
  | { type: "advance" }
  | { type: "back" }
  | { type: "goTo"; index: number }
  | { type: "finish" }
  | { type: "hydrate"; state: TourState };

function reducer(state: TourState, action: Action): TourState {
  switch (action.type) {
    case "start":
      return { status: "running", index: 0 };
    case "advance":
      return state.index >= TOTAL_TOUR_STEPS - 1
        ? { status: "finished", index: state.index }
        : { ...state, index: state.index + 1 };
    case "back":
      return { ...state, index: Math.max(0, state.index - 1) };
    case "goTo":
      return { ...state, index: Math.min(Math.max(0, action.index), TOTAL_TOUR_STEPS - 1) };
    case "finish":
      return { ...state, status: "finished" };
    case "hydrate":
      return action.state;
  }
}

export interface TourContextValue {
  step: TourStep | null;
  index: number;
  total: number;
  running: boolean;
  /** True once sessionStorage has been read — gate UI on this. */
  hydrated: boolean;
  start: () => void;
  advance: () => void;
  back: () => void;
  finish: () => void;
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
  const pathname = usePathname();

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
      hydrated,
      start: () => dispatch({ type: "start" }),
      advance: () => dispatch({ type: "advance" }),
      back: () => dispatch({ type: "back" }),
      finish: () => dispatch({ type: "finish" }),
    }),
    [step, state.index, running, hydrated]
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

/** Finds a step's target element, or null while the page is still settling. */
export function useTourTarget(target: string | undefined, deps: unknown[] = []) {
  const [el, setEl] = useState<HTMLElement | null>(null);

  const find = useCallback(() => {
    if (!target) return setEl(null);
    setEl(document.querySelector<HTMLElement>(`[data-tour="${target}"]`));
  }, [target]);

  useEffect(() => {
    find();
    // Server components stream in, so the element may not exist on the first
    // pass. Watch until it does rather than guessing at a delay.
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find, ...deps]);

  return el;
}
