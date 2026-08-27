"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Layer two of the home page's demos: the clock *inside* a scenario.
 *
 * useAutoRotate decides which scenario is on screen. This decides how far
 * through that scenario we are, revealing steps one at a time so a visitor
 * watches Sellora work rather than reading a finished screenshot.
 *
 * It deliberately does not own any pause logic. `paused` and `reduced` are
 * passed in from useAutoRotate, which already tracks hover, tab visibility,
 * viewport and the reduced-motion preference. Two hooks each running their
 * own IntersectionObserver would eventually disagree — and the failure mode
 * is the ugly one: an outer carousel frozen off-screen while the inner steps
 * keep firing into a panel nobody can see.
 *
 * Under prefers-reduced-motion the sequence does not animate at all. It jumps
 * straight to the finished state, which is the honest equivalent: the same
 * information, none of the motion. Manual tab switching still works.
 */

export interface DemoSequence {
  /** How many steps have landed, 0…stepCount. */
  revealed: number;
  /** The step currently being performed, or -1 once everything has landed. */
  active: number;
  /** True when every step is on screen. */
  complete: boolean;
}

export interface DemoSequenceOptions {
  stepCount: number;
  /**
   * Milliseconds to wait before revealing each step, index-aligned. A step's
   * delay is the pause *before* it appears, so delays[0] is the beat between
   * the scenario opening and its first line.
   */
  delays: number[];
  /** From useAutoRotate — hover, hidden tab, off-screen. */
  paused: boolean;
  /** From useAutoRotate — prefers-reduced-motion. */
  reduced: boolean;
  /**
   * Changes whenever the scenario changes. The sequence resets to zero and
   * replays from the first step, which is what makes a returning tab feel
   * like the software starting work again rather than resuming a recording.
   */
  resetKey: string | number;
}

/** Never let a banked remainder go so small that a step flashes past. */
const MIN_STEP_MS = 160;

export function useDemoSequence({
  stepCount,
  delays,
  paused,
  reduced,
  resetKey,
}: DemoSequenceOptions): DemoSequence {
  const [revealed, setRevealed] = useState(0);

  const remainingRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset when the scenario changes ──
  // Separate from the ticking effect below so that a pause (which re-runs
  // that effect) never rewinds progress the visitor has already seen.
  useEffect(() => {
    setRevealed(0);
    remainingRef.current = null;
  }, [resetKey]);

  // ── The one timer ──
  useEffect(() => {
    // Reduced motion: show the finished state, run no clock at all.
    if (reduced) {
      setRevealed(stepCount);
      return;
    }
    if (paused || revealed >= stepCount) return;

    const wait = remainingRef.current ?? delays[revealed] ?? 700;
    startedAtRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      // Null the ref before advancing so the cleanup below can tell
      // "step landed" from "paused mid-step" and only banks the latter.
      timerRef.current = null;
      remainingRef.current = null;
      setRevealed((n) => Math.min(n + 1, stepCount));
    }, wait);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const spent = Date.now() - startedAtRef.current;
        remainingRef.current = Math.max(MIN_STEP_MS, wait - spent);
      }
    };
  }, [revealed, paused, reduced, stepCount, delays]);

  // Belt and braces: no timer may outlive the component.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return {
    revealed,
    active: revealed >= stepCount ? -1 : revealed,
    complete: revealed >= stepCount,
  };
}

/**
 * Total runtime of a step list, for sizing the scenario's own dwell time.
 *
 * Exported so a scenario's tab duration can be derived from its steps rather
 * than guessed: a five-step scenario and a nine-step one should not be given
 * the same seven seconds, or the longer one gets cut off mid-sentence.
 */
export function sequenceDuration(delays: number[], tailMs = 1400): number {
  return delays.reduce((total, d) => total + d, 0) + tailMs;
}
