"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number towards its target so a score change reads as the
 * software recalculating rather than a value being swapped out.
 *
 * rAF rather than a CSS transition because the *digits* have to move, not an
 * element's position — and rAF stops on its own in a background tab, which a
 * setInterval counter would not.
 *
 * Reduced motion snaps to the target. The number is the information; the
 * counting is decoration, so it is the counting that goes.
 */
export function useCountUp(
  target: number,
  { durationMs = 900, reduced = false }: { durationMs?: number; reduced?: boolean } = {}
): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    if (from === target) return;

    const startedAt = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      // easeOutCubic: fast enough to feel responsive, settles rather than stops.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      setValue(next);

      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        // Bank wherever the animation actually got to, so an interrupted
        // count resumes from there instead of snapping back to the start.
        fromRef.current = value;
      }
    };
    // `value` is intentionally excluded: including it would restart the
    // animation on every frame it sets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, reduced]);

  return value;
}
