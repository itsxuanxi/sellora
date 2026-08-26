"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { ensureGsap, gsap, ScrollTrigger } from "@/components/marketing/gsap-config";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Drives the whole cinematic scroll experience:
 *  - Lenis for buttery inertia scrolling
 *  - GSAP's ticker driving Lenis's raf (single rAF loop, no drift)
 *  - Lenis's scroll event pinging ScrollTrigger.update so pinned/scrubbed
 *    timelines stay perfectly in sync with the smoothed scroll position
 *
 * Fully skipped under prefers-reduced-motion: the page just uses native
 * scroll, and every ScrollTrigger-based component below independently checks
 * the same flag before building scrub/pin timelines.
 */
export function SmoothScroll() {
  useEffect(() => {
    ensureGsap();

    if (prefersReducedMotion()) {
      // Native scroll only; ScrollTrigger still works off window scroll.
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);

    function raf(time: number) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
