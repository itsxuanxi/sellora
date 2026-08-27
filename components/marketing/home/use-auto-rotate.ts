"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Shared behaviour for the home page's two auto-rotating product demos.
 *
 * Only the *behaviour* is shared — each section renders its own layout. That
 * split is deliberate: forcing both demos through one presentational
 * component would have flattened them into the same card, which is exactly
 * the sameness this redesign is trying to remove.
 *
 * What it guarantees:
 *  - Exactly one timer, ever. It is cleared on unmount and re-armed only from
 *    the single effect below, so pauses cannot stack up duplicate timers.
 *  - Pause/resume is seamless. Unspent time is banked on interruption rather
 *    than discarded, so returning to a half-elapsed stage does not restart it.
 *  - Four independent pause reasons are tracked separately (hover, page
 *    visibility, viewport, reduced motion). An earlier version shared one
 *    boolean and the reasons fought — moving the mouse away resumed playback
 *    in a background tab.
 *  - Autoplay is off entirely under prefers-reduced-motion; manual switching
 *    still works.
 */

/** How long autoplay stands down after the visitor picks a tab. */
export const MANUAL_HOLD_MS = 10_000;

/** How long to wait for the IntersectionObserver before assuming visible. */
const FALLBACK_VISIBLE_MS = 1200;

export interface AutoRotate {
  active: number;
  /** Jump to an index and restart its clock. */
  goTo: (index: number) => void;
  /** Arrow/Home/End handling for an ARIA tablist. */
  onKeyDown: (e: React.KeyboardEvent) => void;
  /**
   * Spread onto the element that should pause on hover, and on keyboard
   * focus. Focus is qualified by :focus-visible so a mouse click - which
   * already triggers the manual hold - does not additionally freeze the
   * carousel, while a keyboard user tabbing in never has content move under
   * them mid-read.
   */
  hoverProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: (e: React.FocusEvent) => void;
    onBlur: (e: React.FocusEvent) => void;
  };
  /** Attach to the section so it pauses when scrolled out of view. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Register each tab button so keyboard navigation can move focus. */
  registerTab: (i: number) => (el: HTMLButtonElement | null) => void;
  /** True when the carousel clock is held for any reason, including a manual
   *  pick. Drives the tab progress line. */
  paused: boolean;
  /**
   * True when the *content* of the active stage should hold — hover, hidden
   * tab, off-screen. Deliberately excludes the manual hold: picking a tab is
   * a request to watch that scenario, so freezing its steps for ten seconds
   * is the opposite of what the visitor asked for. Only the carousel stands
   * down; the steps play straight through from the first one.
   */
  contentPaused: boolean;
  reduced: boolean;
  /** Remaining ms on the current stage — the progress line's duration. */
  remaining: number;
}

/**
 * `durationMs` may be a single number or one per index. Per-index matters
 * once stages run scripted steps: a five-step scenario and a nine-step one
 * given the same seven seconds means the longer one is cut off mid-sentence.
 */
export function useAutoRotate(
  count: number,
  durationMs: number | number[]
): AutoRotate {
  const [active, setActive] = useState(0);

  // A stable getter, so passing a fresh array literal every render does not
  // re-arm the timer on each parent re-render.
  const durationsRef = useRef(durationMs);
  durationsRef.current = durationMs;
  const durationAt = useCallback((i: number) => {
    const d = durationsRef.current;
    return Array.isArray(d) ? (d[i] ?? d[0] ?? 7000) : d;
  }, []);

  // Separate reasons, combined at the end. Never collapse these into one.
  const [hoverPaused, setHoverPaused] = useState(false);
  const [pagePaused, setPagePaused] = useState(false);
  const [offScreen, setOffScreen] = useState(true);
  const [reduced, setReduced] = useState(false);
  // Held after a manual pick, so the carousel does not yank the visitor off
  // the tab they just chose. Released on its own — a permanent stop would
  // leave the page frozen for anyone who clicked once out of curiosity.
  const [focusPaused, setFocusPaused] = useState(false);
  const [manualHold, setManualHold] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remainingRef = useRef(
    Array.isArray(durationMs) ? (durationMs[0] ?? 7000) : durationMs
  );
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const contentPaused = hoverPaused || focusPaused || pagePaused || offScreen;
  const paused = contentPaused || manualHold;

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Autoplay's own advance: no hold, next stage's clock. */
  const advance = useCallback(
    (index: number) => {
      clearTimer();
      const i = ((index % count) + count) % count;
      remainingRef.current = durationAt(i);
      setActive(i);
    },
    [clearTimer, count, durationAt]
  );

  /** A deliberate pick by the visitor. Restarts the stage and holds autoplay. */
  const goTo = useCallback(
    (index: number) => {
      advance(index);
      setManualHold(true);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        setManualHold(false);
      }, MANUAL_HOLD_MS);
    },
    [advance]
  );

  // ── The one timer ──
  useEffect(() => {
    if (reduced || paused) return;

    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      // Null the ref BEFORE advancing. The cleanup below banks unspent time on
      // interruption; without this it cannot distinguish "stage finished" from
      // "paused mid-stage" and would bank ~0ms, making the next stage flash by.
      timerRef.current = null;
      setActive((a) => {
        const next = (a + 1) % count;
        remainingRef.current = durationAt(next);
        return next;
      });
    }, remainingRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const spent = Date.now() - startedAtRef.current;
        remainingRef.current = Math.max(240, remainingRef.current - spent);
      }
    };
  }, [active, paused, reduced, count, durationAt]);

  // ── Pause when scrolled out of view ──
  //
  // `offScreen` starts true so nothing animates before we know where the
  // section is. That makes the observer load-bearing: if it never reports,
  // the demo stays frozen for good. So the wait is bounded — if no callback
  // has arrived by FALLBACK_VISIBLE_MS we assume visible and start playing.
  //
  // The trade is deliberate. Getting this wrong costs an off-screen demo
  // animating (bounded anyway by the tab-visibility pause below); leaving it
  // unbounded costs a permanently dead hero on any browser without a working
  // IntersectionObserver, which is far worse and silent.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setOffScreen(false);
      return;
    }

    let reported = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        reported = true;
        setOffScreen(!entry.isIntersecting);
      },
      // A third visible is enough to be "watching" it.
      { threshold: 0.33 }
    );
    io.observe(el);

    const fallback = setTimeout(() => {
      if (!reported) setOffScreen(false);
    }, FALLBACK_VISIBLE_MS);

    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  // ── Pause when the tab is hidden or the window loses focus ──
  useEffect(() => {
    const syncVisibility = () => setPagePaused(document.hidden);
    const onBlur = () => setPagePaused(true);
    const onFocus = () => setPagePaused(document.hidden);

    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    syncVisibility();

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Belt and braces: no timer may outlive the component.
  useEffect(() => clearTimer, [clearTimer]);
  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    []
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next: number | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = active + 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = active - 1;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = count - 1;
      if (next === null) return;
      e.preventDefault();
      const idx = ((next % count) + count) % count;
      goTo(idx);
      tabRefs.current[idx]?.focus();
    },
    [active, count, goTo]
  );

  const registerTab = useCallback(
    (i: number) => (el: HTMLButtonElement | null) => {
      tabRefs.current[i] = el;
    },
    []
  );

  return {
    active,
    goTo,
    onKeyDown,
    // No focus-based pause: clicking a tab focuses it, so pausing on focus
    // would freeze the carousel the first time anyone interacted with it.
    hoverProps: {
      onMouseEnter: () => setHoverPaused(true),
      onMouseLeave: () => setHoverPaused(false),
      onFocus: (e: React.FocusEvent) => {
        // :focus-visible is the browser's own judgement about whether focus
        // arrived from the keyboard. Matching on it avoids the failure the
        // previous version was avoiding - a click freezing the carousel -
        // without giving up the keyboard pause.
        if ((e.target as HTMLElement).matches?.(":focus-visible")) {
          setFocusPaused(true);
        }
      },
      onBlur: (e: React.FocusEvent) => {
        // Ignore focus moving between tabs inside the same strip.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocusPaused(false);
        }
      },
    },
    containerRef,
    registerTab,
    paused,
    contentPaused,
    reduced,
    remaining: remainingRef.current,
  };
}
