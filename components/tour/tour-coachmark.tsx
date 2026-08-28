"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const { step, index, total, running, advance, back, finish } = useTour();
  const target = useTourTarget(step?.target, [step?.id]);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Track the target through scrolls, resizes and content changes.
  useEffect(() => {
    if (!target) return setRect(null);

    const measure = () => {
      const r = target.getBoundingClientRect();
      // A zero-size box means the element is in the DOM but not shown — the
      // sidebar is `hidden lg:flex`, so its nav links measure 0×0 on a phone.
      // Highlighting that would draw a ring around nothing and strand the
      // visitor on a step with no way forward.
      if (r.width === 0 || r.height === 0) return setRect(null);
      setRect({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      });
    };

    measure();
    if (target.getBoundingClientRect().height > 0) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [target]);

  // On a "click" step, the real interaction is what advances the tour. The
  // listener is passive and capture-phase: it observes the click on its way
  // down and never interferes with what the control actually does.
  useEffect(() => {
    if (!target || step?.advance !== "click") return;
    const onClick = () => advance();
    target.addEventListener("click", onClick, { capture: true });
    return () => target.removeEventListener("click", onClick, { capture: true });
  }, [target, step?.advance, step?.id, advance]);

  if (!mounted || !running || !step) return null;

  // With no visible target the step becomes a plain card: centred, and
  // advanced by a button rather than by an interaction the visitor cannot see.
  const unanchored = rect === null;
  const below = (step.placement ?? "bottom") === "bottom";
  const cardTop = rect
    ? below
      ? rect.top + rect.height + 12
      : Math.max(12, rect.top - 12 - 260)
    : Math.max(12, window.innerHeight / 2 - 160);
  const cardLeft = rect
    ? Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - 372))
    : Math.max(12, window.innerWidth / 2 - 180);

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
        role="dialog"
        aria-label={step.title}
        className="pointer-events-auto fixed w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-border/70 bg-card p-5 shadow-xl transition-all duration-300 ease-out"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
            {step.eyebrow}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] tabular-nums text-muted-foreground">
            Step {index + 1} of {total}
          </span>
        </div>

        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-0.5 flex-1 rounded-full transition-colors",
                i <= index ? "bg-primary" : "bg-muted"
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
              onClick={finish}
              className="rounded-full px-2 py-1 text-[12px] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              {index === total - 1 ? "Close" : "Skip tour"}
            </button>
            {/* No Next on a click step: the highlighted control is the only
                way forward, which is what makes this a tour of the product
                rather than a slideshow about it. */}
            {(step.advance === "read" || unanchored) && (
              <button
                type="button"
                onClick={index === total - 1 ? finish : advance}
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

function Mask({ style }: { style: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className="pointer-events-auto fixed bg-foreground/40 transition-all duration-300 ease-out"
      style={style}
    />
  );
}
