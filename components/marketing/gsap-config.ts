"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/** Registers ScrollTrigger exactly once, client-side only. Import this from
 * any component that builds a ScrollTrigger timeline. */
export function ensureGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

/**
 * `ScrollTrigger`'s `pin` feature reparents the pinned element into a
 * "pin-spacer" wrapper it inserts into the live DOM. On an SPA route change,
 * Next.js/React can remove the outer tree in the same tick a component's
 * cleanup tries to revert() and un-wrap that spacer — the browser then
 * throws `NotFoundError: Failed to execute 'removeChild'` because the node
 * ScrollTrigger expects to still be attached already isn't. That race is
 * harmless (the whole subtree is being discarded either way), so cleanup
 * must never let it become an unhandled error that trips the app's error
 * boundary. Always call gsap.context().revert() through this helper instead
 * of directly.
 */
export function safeRevert(ctx: { revert: () => void }) {
  try {
    ctx.revert();
  } catch (err) {
    console.warn("[gsap] context revert during unmount — safely ignored:", err);
  }
}

export { gsap, ScrollTrigger };
