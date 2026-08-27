"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { useDemo } from "@/components/demo/demo-store";
import type { DemoPlacement } from "@/lib/demo/steps";

/**
 * The spotlight: a mask with a real hole in it.
 *
 * Built from four solid panels around the target rather than one translucent
 * sheet, because the hole has to be genuinely empty. A single overlay with a
 * box-shadow cut-out looks identical but still sits over the target and
 * swallows the click — and the whole point of this demo is that the visitor
 * clicks the actual product control. Four panels block everything else and
 * leave the target reachable.
 *
 * The ring and the coachmark are pointer-events-none / auto respectively, so
 * the highlight never intercepts and the card is always usable.
 */

const PADDING = 8;
const CARD_WIDTH = 348;
const GAP = 14;
/** Below this the coachmark becomes a bottom sheet instead of a floating card. */
const MOBILE_MAX = 768;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function DemoSpotlight() {
  const { step, stepNumber, totalSteps, isTourActive, back, skipTour, exit, currentTaskDone } =
    useDemo();

  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [reduced, setReduced] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // The card's real height. Positioning it from a guessed height leaves it
  // abutting or overlapping the target, which is exactly what the placement
  // logic exists to avoid.
  const [cardHeight, setCardHeight] = useState(300);

  useEffect(() => {
    setMounted(true);
    setReduced(prefersReducedMotion());
    const sync = () => setIsMobile(window.innerWidth < MOBILE_MAX);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // ── Track the target ──
  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(
      `[data-demo-target="${step.target}"]`
    );
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect((prev) =>
      prev &&
      Math.abs(prev.top - r.top) < 0.5 &&
      Math.abs(prev.left - r.left) < 0.5 &&
      Math.abs(prev.width - r.width) < 0.5 &&
      Math.abs(prev.height - r.height) < 0.5
        ? // Unchanged: return the same object so the poll does not re-render.
          prev
        : { top: r.top, left: r.left, width: r.width, height: r.height }
    );
  }, [step]);

  // Re-measure on anything that can move the target. A ResizeObserver on the
  // element alone is not enough — the page reflows as demo state changes
  // reveal new content above it.
  useEffect(() => {
    if (!isTourActive || !step) return;

    let raf = 0;
    // rAF coalesces the storm of scroll/resize callbacks into one measure per
    // frame. It is *not* used for the first measurement: rAF is suspended in a
    // background tab, and a spotlight whose hole never gets measured falls
    // back to a full-screen mask that covers the very control the visitor is
    // being told to click. Measure synchronously first, then coalesce.
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    measure();
    // The target is often not mounted yet on a fresh route, so re-measure a
    // couple of times as the page settles. These call measure directly for
    // the same reason as above — routed through rAF they would never run in a
    // background tab, and the mask would stay closed over the target.
    const retry = setTimeout(measure, 120);
    const settle = setTimeout(measure, 420);

    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);

    // A slow reconciliation, independent of rAF. The mask sitting even
    // slightly off the target is not cosmetic — it puts an opaque panel over
    // the control the visitor has been told to click, and the tour dead-ends
    // with no way forward. Every path above ultimately routes through
    // requestAnimationFrame, which browsers throttle or suspend; two cheap
    // rect reads a second guarantee the hole finds its way back.
    const reconcile = setInterval(measure, 500);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(retry);
      clearTimeout(settle);
      clearInterval(reconcile);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [isTourActive, step, measure]);

  // ── Bring the target into view before the card appears ──
  //
  // Polled rather than run once, because a step's target frequently does not
  // exist yet when the step begins: "Update opportunity" only appears after
  // the four buyer-response effects have finished landing, several seconds in.
  // A single attempt finds nothing, gives up, and strands the visitor with the
  // control they need sitting below the fold.
  useEffect(() => {
    if (!isTourActive || !step) return;

    let settled = false;
    const attempt = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-demo-target="${step.target}"]`
      );
      if (!el) return;

      const r = el.getBoundingClientRect();
      if (r.top >= 80 && r.bottom <= window.innerHeight - 80) {
        settled = true;
        return;
      }
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });

      // Smooth scrolling can silently do nothing — a throttled tab, a browser
      // that ignores the behaviour. Verify and force, because an unreachable
      // target is a dead end and an unanimated jump is merely less pretty.
      setTimeout(() => {
        const after = el.getBoundingClientRect();
        if (after.top < 80 || after.bottom > window.innerHeight - 80) {
          el.scrollIntoView({ behavior: "auto", block: "center" });
        }
        settled = true;
      }, 600);
    };

    attempt();
    const poll = setInterval(() => {
      if (settled) {
        clearInterval(poll);
        return;
      }
      attempt();
    }, 400);
    // Stop chasing after a few seconds; by then the step is not going to mount.
    const stop = setTimeout(() => clearInterval(poll), 8000);

    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [isTourActive, step, reduced]);

  // ── Measure the card ──
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const sync = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) setCardHeight((prev) => (Math.abs(prev - h) < 1 ? prev : h));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step, isMobile]);

  // ── Escape exits, and focus stays inside the card ──
  useEffect(() => {
    if (!isTourActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isTourActive, exit]);

  if (!mounted || !isTourActive || !step) return null;

  const hole = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

  const card = (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="demo-coachmark-title"
      className={cn(
        "pointer-events-auto z-[70] rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5 shadow-[0_24px_70px_rgba(20,20,30,0.28)]",
        isMobile ? "fixed inset-x-3 bottom-3" : "fixed w-[348px]"
      )}
      style={
        isMobile || !hole
          ? undefined
          : cardPosition(hole, step.placement, cardHeight)
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-brand-deep)]">
          {step.eyebrow}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.1em] tabular-nums text-[var(--mkt-muted)]">
          Step {stepNumber} of {totalSteps}
        </span>
      </div>

      <div className="mt-2.5 flex gap-1" aria-hidden>
        {Array.from({ length: totalSteps }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-[3px] flex-1 rounded-full transition-colors duration-300",
              i < stepNumber ? "bg-[var(--mkt-brand)]" : "bg-[var(--mkt-line)]"
            )}
          />
        ))}
      </div>

      <h2
        id="demo-coachmark-title"
        className="mt-3.5 text-[15px] font-medium leading-snug tracking-tight text-[var(--mkt-ink)]"
      >
        {step.title}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--mkt-muted)]">
        {step.description}
      </p>

      {/* The instruction sits on its own tinted ground so the one thing to do
          next is never mistaken for more explanatory prose. */}
      <p className="mt-3 rounded-lg bg-[var(--mkt-brand-wash)] px-3 py-2 text-[13px] font-medium leading-snug text-[var(--mkt-brand-deep)]">
        {step.instruction}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={back}
          disabled={stepNumber === 1}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-[var(--mkt-muted)] transition-colors hover:text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] disabled:opacity-40"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Back
        </button>
        <button
          type="button"
          onClick={skipTour}
          className="rounded-full px-2 py-1 text-[12px] text-[var(--mkt-muted)] underline decoration-[var(--mkt-line)] underline-offset-4 transition-colors hover:text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)]"
        >
          Skip tour
        </button>
      </div>

      {/* No Continue button on task steps — the highlighted control is the
          only way forward, which is the difference between using the product
          and paging through screenshots. */}
      {step.requiredAction === "click" && !currentTaskDone && (
        <p className="mt-3 border-t border-[var(--mkt-line)] pt-2.5 text-[11px] text-[var(--mkt-muted)]">
          Complete the highlighted step to continue.
        </p>
      )}
    </div>
  );

  return createPortal(
    // `mkt` is essential, not cosmetic: every --mkt-* colour is scoped to that
    // class in globals.css, and this subtree is portalled to document.body —
    // outside the demo layout that carries it. Without the class the variables
    // resolve to nothing and the coachmark renders with a transparent
    // background over a dimmed page, which is illegible.
    <div className="mkt pointer-events-none fixed inset-0 z-[60]">
      {/* Announce each step for screen readers without stealing focus. */}
      <p className="sr-only" aria-live="polite">
        Step {stepNumber} of {totalSteps}. {step.title}. {step.instruction}
      </p>

      {hole ? (
        <>
          <MaskPanel style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }} />
          <MaskPanel
            style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }}
          />
          <MaskPanel
            style={{ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height }}
          />
          <MaskPanel
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
          />
          {/* The ring never intercepts, so the target underneath stays clickable. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none fixed rounded-xl ring-2 ring-[var(--mkt-brand)]",
              "shadow-[0_0_0_6px_rgba(103,87,229,0.16)]",
              !reduced && "transition-all duration-300 ease-out"
            )}
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        </>
      ) : (
        // No target on screen yet: dim everything rather than flashing an
        // un-masked page while the route settles.
        <MaskPanel style={{ inset: 0 }} />
      )}

      {card}
    </div>,
    document.body
  );
}

/** One quadrant of the mask. Solid to the pointer, so only the hole is live. */
function MaskPanel({ style }: { style: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className="pointer-events-auto fixed bg-[rgba(17,19,17,0.58)]"
      style={style}
    />
  );
}

/**
 * Places the card beside the hole, then clamps it inside the viewport.
 *
 * Clamping is what stops the card being half off-screen on a laptop, and the
 * flip below is what stops it covering the very control the visitor has just
 * been told to click.
 */
function cardPosition(
  hole: Rect,
  placement: DemoPlacement,
  cardHeight: number
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const estHeight = cardHeight;

  let top: number;
  let left: number;

  // A side placement needs a clear column beside the target. A full-width
  // element (a table row, a wide panel) has none, and clamping a side-placed
  // card back into the viewport lands it squarely on top of the very control
  // the visitor was told to click. Fall back to below instead.
  const fitsRight = hole.left + hole.width + GAP + CARD_WIDTH <= vw - 12;
  const fitsLeft = hole.left - GAP - CARD_WIDTH >= 12;
  const effective =
    (placement === "right" && !fitsRight && !fitsLeft) ||
    (placement === "left" && !fitsLeft && !fitsRight)
      ? "bottom"
      : placement;

  switch (effective) {
    case "right":
      top = hole.top;
      left = fitsRight ? hole.left + hole.width + GAP : hole.left - CARD_WIDTH - GAP;
      break;
    case "left":
      top = hole.top;
      left = fitsLeft ? hole.left - CARD_WIDTH - GAP : hole.left + hole.width + GAP;
      break;
    case "top":
      top = hole.top - estHeight - GAP;
      left = hole.left + hole.width / 2 - CARD_WIDTH / 2;
      if (top < 12) top = hole.top + hole.height + GAP;
      break;
    case "bottom":
    default:
      top = hole.top + hole.height + GAP;
      left = hole.left + hole.width / 2 - CARD_WIDTH / 2;
      // No room below: go above rather than overlap.
      if (top + estHeight > vh - 12) top = hole.top - estHeight - GAP;
      break;
    case "center":
      top = vh / 2 - estHeight / 2;
      left = vw / 2 - CARD_WIDTH / 2;
      break;
  }

  return {
    top: Math.min(Math.max(12, top), Math.max(12, vh - estHeight - 12)),
    left: Math.min(Math.max(12, left), Math.max(12, vw - CARD_WIDTH - 12)),
  };
}

/** Exported for the placement tests — same maths, no DOM. */
export function resolvePlacement(
  hole: Rect,
  placement: DemoPlacement,
  viewport: { width: number; height: number }
): DemoPlacement {
  const fitsRight = hole.left + hole.width + GAP + CARD_WIDTH <= viewport.width - 12;
  const fitsLeft = hole.left - GAP - CARD_WIDTH >= 12;
  if (placement === "right" && !fitsRight && !fitsLeft) return "bottom";
  if (placement === "left" && !fitsLeft && !fitsRight) return "bottom";
  return placement;
}
