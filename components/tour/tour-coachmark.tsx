"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTour, useTourTarget } from "@/components/tour/tour-provider";

/**
 * The coachmark: a dimming mask with a hole cut around the real control, and
 * a card explaining it.
 *
 * The mask is four panels rather than one overlay with a transparent hole,
 * because the hole has to stay clickable — on a "click" step the highlighted
 * control is the only way forward, and it must receive the real click that
 * runs the real server action.
 */

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;

export function TourCoachmark() {
  const { step, index, total, running, reduced, advance, back, complete, skip } = useTour();
  const { el: target, phase, retry } = useTourTarget(step?.target);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  // The card's real height. Assuming one is how the card ends up sitting on
  // top of the thing it is pointing at: step copy varies by several lines.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(0);

  useEffect(() => setMounted(true), []);

  // Track the target by polling its box.
  //
  // Listening for scroll and resize is the obvious implementation and it is
  // not reliable enough here: the highlight has to follow the element through
  // scrollIntoView, streamed content that shifts layout, and dialogs opening
  // underneath it — and a single missed event leaves the ring drawn around
  // where the target used to be, which looks exactly like the tour pointing
  // at the wrong thing. Reading one rect per frame and only setting state
  // when it actually moves costs little and cannot miss.
  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }

    let frame = 0;
    let last = "";

    const tick = () => {
      const r = target.getBoundingClientRect();
      // A zero-size box means the element is in the DOM but not shown — the
      // sidebar is `hidden lg:flex`, so its nav links measure 0x0 on a phone.
      // Highlighting that would draw a ring around nothing and strand the
      // visitor on a step with no way forward.
      const next =
        r.width === 0 || r.height === 0
          ? null
          : {
              top: r.top - PAD,
              left: r.left - PAD,
              width: r.width + PAD * 2,
              height: r.height + PAD * 2,
            };
      const key = next ? `${next.top}|${next.left}|${next.width}|${next.height}` : "none";
      if (key !== last) {
        last = key;
        setRect(next);
      }
      frame = requestAnimationFrame(tick);
    };

    tick();
    frame = requestAnimationFrame(tick);
    // rAF stops while the document is hidden, so a timer carries the
    // measurement across a backgrounded tab and the highlight is correct the
    // moment the visitor comes back.
    const timer = window.setInterval(tick, 250);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [target]);

  // Bring the target on screen when the step changes.
  //
  // A single scrollIntoView is not enough here. On a fresh navigation the
  // element exists before the content below it has finished laying out, so
  // one call lands on a position that is then pushed away; and a smooth
  // scroll can be superseded by the next render. This retries a few times and
  // stops as soon as the target is actually visible, which is the only
  // condition that matters.
  useEffect(() => {
    if (!target) return;
    let tries = 0;
    let timer: number | undefined;

    const onScreen = () => {
      const r = target.getBoundingClientRect();
      return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
    };

    const attempt = () => {
      if (onScreen() || tries >= 6) return;
      tries += 1;
      target.scrollIntoView({
        block: "center",
        behavior: reduced || tries > 1 ? "auto" : "smooth",
      });
      timer = window.setTimeout(attempt, 250);
    };

    attempt();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [target, step?.id, reduced]);

  // On a "click" step, the real interaction is what advances the tour. The
  // listener is passive and capture-phase: it observes the click on its way
  // down and never interferes with what the control actually does.
  useEffect(() => {
    if (!target || step?.advance !== "click") return;
    const onClick = () => advance();
    target.addEventListener("click", onClick, { capture: true });
    return () => target.removeEventListener("click", onClick, { capture: true });
  }, [target, step?.advance, step?.id, advance]);

  useEffect(() => {
    if (!cardRef.current) return;
    const measure = () => setCardHeight(cardRef.current?.offsetHeight ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [step?.id, mounted, running]);

  if (!mounted || !running || !step) return null;

  // Three cases, not two.
  //
  // `searching` is the one that was missing: a step whose target has not
  // streamed in yet used to render immediately as a floating card with Next,
  // identical to a step whose anchor does not exist. On the first step of the
  // story that meant a visitor could click past the thing the step was about
  // before it appeared. Now the card holds, and only after TARGET_WAIT_MS
  // does it say it cannot find the control — with a button to look again,
  // because the usual cause is a page that is still loading.
  const unanchored = rect === null;
  const searching = unanchored && phase === "searching";
  const missing = unanchored && phase === "missing";
  const placed = rect
    ? placeCard(rect, cardHeight, step.placement ?? "bottom")
    : {
        anchorY: Math.max(12, viewport().height / 2 - 160),
        above: false,
        maxHeight: viewport().height - 24,
      };
  const cardLeft = rect
    ? Math.min(Math.max(12, rect.left), Math.max(12, viewport().width - 372))
    : Math.max(12, viewport().width / 2 - 180);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <p className="sr-only" aria-live="polite">
        Step {index + 1} of {total}. {step.title}. {step.instruction}
      </p>

      {rect && (
        <>
          <Mask style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }} />
          <Mask style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} />
          <Mask
            style={{
              top: rect.top,
              left: 0,
              width: Math.max(0, rect.left),
              height: rect.height,
            }}
          />
          <Mask
            style={{
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height,
            }}
          />
          {/* The ring never intercepts, so the control underneath stays live. */}
          <div
            aria-hidden
            className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-300 ease-out"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        </>
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-label={step.title}
        className="pointer-events-auto fixed left-0 top-0 w-[360px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border border-border/70 bg-card p-5 shadow-xl transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${Math.round(cardLeft)}px, ${Math.round(placed.anchorY)}px, 0)${
            placed.above ? " translateY(-100%)" : ""
          }`,
          maxHeight: placed.maxHeight,
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
            {step.phase}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] tabular-nums text-muted-foreground">
            Step {index + 1} of {total}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full transition-all duration-200",
                i === index
                  ? "h-1.5 w-5 bg-primary"
                  : i < index
                    ? "size-1.5 bg-primary/50"
                    : "size-1.5 bg-muted"
              )}
            />
          ))}
        </div>

        <h2 className="mt-4 text-[15px] font-semibold leading-snug tracking-tight">
          {step.title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        {!unanchored && (
          <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-foreground">
            {step.instruction}
          </p>
        )}

        {searching && (
          <p
            className="mt-3 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground"
            aria-live="polite"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Waiting for this screen to finish loading…
          </p>
        )}

        {missing && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-50/70 px-3 py-2.5 dark:bg-amber-950/30">
            <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200">
              This part of the screen did not load.
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-900/80 dark:text-amber-200/80">
              {step.instruction} Nothing is broken in your workspace — the tour
              just cannot find that control right now.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-2.5 py-1 text-[12px] font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200"
            >
              <RotateCcw className="size-3" aria-hidden />
              Look again
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={back}
            disabled={index === 0}
            className="rounded-full px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            ← Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={skip}
              className="rounded-full px-2 py-1 text-[12px] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              {index === total - 1 ? "Close" : "Skip tour"}
            </button>
            {/* No Next on a click step: the highlighted control is the only
                way forward, which is what makes this a tour of the product
                rather than a slideshow about it. */}
            {(step.advance === "read" || missing) && (
              <button
                type="button"
                onClick={index === total - 1 ? complete : advance}
                className="rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {index === total - 1 ? "Finish" : "Next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function viewport() {
  return {
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  };
}

/**
 * Where the card goes, and how tall it may be.
 *
 * Two rules the tour must never break: the card cannot cover the element it
 * is pointing at, and it cannot run off the screen. Position alone cannot
 * guarantee both — the targets here include whole page sections, and when a
 * tall target leaves too little room on either side, any position that avoids
 * the overlap runs off the viewport instead.
 *
 * So the card is bounded as well as placed: it takes the roomier gap and is
 * capped to that gap's height, scrolling internally if the copy needs more.
 * A slightly scrollable card is a much smaller failure than one sitting on
 * top of the thing the step is about.
 */
function placeCard(
  rect: Rect,
  cardHeight: number,
  placement: "top" | "bottom"
): { anchorY: number; above: boolean; maxHeight: number } {
  const GAP = 12;
  const { height } = viewport();
  const wanted = cardHeight || 260;

  // Gaps are measured against the part of the target actually on screen. A
  // target taller than the viewport has no off-screen gap to place into, and
  // measuring against its full height would compute a negative one.
  const visibleTop = Math.max(0, rect.top);
  const visibleBottom = Math.min(height, rect.top + rect.height);
  const below = Math.max(0, height - visibleBottom - GAP * 2);
  const above = Math.max(0, visibleTop - GAP * 2);

  const preferBelow = placement === "bottom";
  const fitsPreferred = preferBelow ? below >= wanted : above >= wanted;
  const fitsOther = preferBelow ? above >= wanted : below >= wanted;
  const useBelow = fitsPreferred ? preferBelow : fitsOther ? !preferBelow : below >= above;

  return {
    // The edge of the gap the card is pinned to. When placed above, the card
    // is shifted up by its own height in CSS rather than by a measured value:
    // the measurement lags a render behind the content, and being seven
    // pixels stale is enough to overlap the thing the step is pointing at.
    anchorY: useBelow ? visibleBottom + GAP : visibleTop - GAP,
    above: !useBelow,
    maxHeight: Math.max(160, useBelow ? below : above),
  };
}

function Mask({ style }: { style: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className="pointer-events-auto fixed bg-foreground/40 transition-all duration-300 ease-out"
      style={style}
    />
  );
}
