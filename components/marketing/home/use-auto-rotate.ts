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

export interface AutoRotate {
  active: number;
  /** Jump to an index and restart its clock. */
  goTo: (index: number) => void;
  /** Arrow/Home/End handling for an ARIA tablist. */
  onKeyDown: (e: React.KeyboardEvent) => void;
  /** Spread onto the element that should pause on hover. */
  hoverProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  /** Attach to the section so it pauses when scrolled out of view. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Register each tab button so keyboard navigation can move focus. */
  registerTab: (i: number) => (el: HTMLButtonElement | null) => void;
  /** True when the clock is held for any reason. Drives the progress line. */
  paused: boolean;
  reduced: boolean;
  /** Remaining ms on the current stage — the progress line's duration. */
  remaining: number;
}

export function useAutoRotate(count: number, durationMs: number): AutoRotate {
  const [active, setActive] = useState(0);

  // Separate reasons, combined at the end. Never collapse these into one.
  const [hoverPaused, setHoverPaused] = useState(false);
  const [pagePaused, setPagePaused] = useState(false);
  const [offScreen, setOffScreen] = useState(true);
  const [reduced, setReduced] = useState(false);

  const remainingRef = useRef(durationMs);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const paused = hoverPaused || pagePaused || offScreen;

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goTo = useCallback(
    (index: number) => {
      clearTimer();
      remainingRef.current = durationMs;
      setActive(((index % count) + count) % count);
    },
    [clearTimer, count, durationMs]
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
      remainingRef.current = durationMs;
      setActive((a) => (a + 1) % count);
    }, remainingRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const spent = Date.now() - startedAtRef.current;
        remainingRef.current = Math.max(240, remainingRef.current - spent);
      }
    };
  }, [active, paused, reduced, count, durationMs]);

  // ── Pause when scrolled out of view ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOffScreen(!entry.isIntersecting),
      // A third visible is enough to be "watching" it.
      { threshold: 0.33 }
    );
    io.observe(el);
    return () => io.disconnect();
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
    },
    containerRef,
    registerTab,
    paused,
    reduced,
    remaining: remainingRef.current,
  };
}
