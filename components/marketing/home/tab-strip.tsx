"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AutoRotate } from "@/components/marketing/home/use-auto-rotate";

/**
 * The tab row for an auto-rotating demo: an ARIA tablist whose selected tab
 * carries a hairline progress line showing time left on the stage.
 *
 * The line is a CSS animation paused declaratively via animation-play-state,
 * not a rAF-driven React state — a decorative bar should not cost ~60
 * re-renders a second. It is keyed on stage + pause state so it restarts
 * cleanly and resumes from the banked remaining time.
 *
 * Scrolls horizontally rather than wrapping on narrow screens: wrapping would
 * change the strip's height, which would move the panel below it.
 */
export function TabStrip({
  rotate,
  labels,
  ids,
  baseId,
  ariaLabel,
  size = "sm",
  orientation = "horizontal",
  fill = false,
}: {
  rotate: AutoRotate;
  labels: string[];
  ids: readonly string[];
  baseId: string;
  ariaLabel: string;
  size?: "sm" | "lg" | "xl";
  /** Vertical suits a left rail, where long scenario labels would otherwise
   * overflow a horizontal strip and get clipped. */
  orientation?: "horizontal" | "vertical";
  /**
   * Tabs share the available width equally rather than sizing to their labels.
   * Below the breakpoint where four equal tabs would crush the text, the strip
   * falls back to scrolling - a squeezed unreadable tab is worse than one the
   * reader has to scroll to.
   */
  fill?: boolean;
}) {
  const { active, goTo, onKeyDown, registerTab, paused, reduced, remaining } = rotate;
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the selected tab in view on narrow screens. Without this the
  // carousel advances to a tab that has scrolled off the right edge, and on a
  // phone the strip silently stops agreeing with the panel below it.
  //
  // Scrolls the strip's own scrollLeft rather than calling scrollIntoView:
  // that would also scroll the *page* to bring the strip into view, yanking
  // the reader somewhere they did not ask to go every time a tab advances.
  useEffect(() => {
    if (orientation !== "horizontal") return;
    const list = listRef.current;
    const tab = list?.children[active] as HTMLElement | undefined;
    if (!list || !tab) return;
    if (list.scrollWidth <= list.clientWidth) return;

    const target = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
    list.scrollTo({
      left: Math.max(0, target),
      behavior: reduced ? "auto" : "smooth",
    });
  }, [active, orientation, reduced]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={cn(
        "flex gap-1.5",
        orientation === "vertical"
          ? "flex-col"
          : // Horizontal strips scroll rather than wrap: wrapping would change
            // the strip's height and move the panel beneath it.
            "-mx-1 overflow-x-auto px-1 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      {labels.map((label, i) => {
        const selected = i === active;
        return (
          <button
            key={ids[i]}
            ref={registerTab(i)}
            role="tab"
            id={`${baseId}-tab-${ids[i]}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${ids[i]}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => goTo(i)}
            className={cn(
              "group relative rounded-lg border text-left transition-colors",
              orientation === "vertical"
                ? "w-full"
                : fill
                  ? // Equal tracks once there is room; scrolling chips below it.
                    "shrink-0 sm:min-w-0 sm:flex-1"
                  : "shrink-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]",
              size === "lg" ? "px-3.5 py-2.5" : size === "xl" ? "px-4 py-2" : "px-3 py-2",
              selected
                ? "border-[var(--mkt-brand)] bg-[var(--mkt-brand-wash)]"
                : "border-transparent bg-[var(--mkt-surface-2)] hover:bg-[color-mix(in_srgb,var(--mkt-surface)_70%,var(--mkt-surface-2))]"
            )}
          >
            <span
              className={cn(
                "block font-medium uppercase tracking-[0.11em] transition-colors",
                orientation === "vertical" ? "" : "whitespace-nowrap",
                size === "lg" ? "text-[11px]" : size === "xl" ? "text-[11.5px]" : "text-[10px]",
                selected
                  ? "text-[var(--mkt-brand-deep)]"
                  : "text-[var(--mkt-muted)] group-hover:text-[var(--mkt-ink)]"
              )}
            >
              {label}
            </span>

            <span
              className={cn(
                "mt-1.5 block w-full overflow-hidden rounded-full bg-[var(--mkt-line)]",
                size === "xl" ? "h-[2px]" : "h-px"
              )}
              aria-hidden
            >
              {selected && (
                <span
                  key={`${active}-${paused}-${reduced}`}
                  className={cn(
                    "block h-full origin-left bg-[var(--mkt-brand)]",
                    reduced
                      ? "scale-x-100"
                      : "[animation:demo-progress_var(--dur)_linear_forwards]"
                  )}
                  style={
                    reduced
                      ? undefined
                      : ({
                          ["--dur" as string]: `${remaining}ms`,
                          animationPlayState: paused ? "paused" : "running",
                        } as React.CSSProperties)
                  }
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Stacked panel container. All panels stay mounted in one grid cell so the
 * container is permanently as tall as the tallest — switching can never move
 * the page. Inactive panels get `inert` + `aria-hidden` rather than `hidden`,
 * which would drop them from layout and reintroduce the height jump.
 */
export function StackedPanels({
  ids,
  baseId,
  active,
  render,
  className,
}: {
  ids: readonly string[];
  baseId: string;
  active: number;
  render: (id: string, index: number, selected: boolean) => React.ReactNode;
  className?: string;
}) {
  return (
    // grid-rows-[minmax(0,1fr)] is load-bearing wherever the caller sets a
    // fixed height: without it the single implicit row sizes to content, the
    // height merely clips, and a flex-1 child inside stretches into the
    // overflow rather than fitting. With no fixed height it resolves to
    // max-content, so this is safe for the auto-height callers too.
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]",
        className
      )}
    >
      {ids.map((id, i) => {
        const selected = i === active;
        return (
          <div
            key={id}
            role="tabpanel"
            id={`${baseId}-panel-${id}`}
            aria-labelledby={`${baseId}-tab-${id}`}
            aria-hidden={!selected}
            inert={!selected}
            className={cn(
              // translate-y-* utilities rather than [transform:translateY(..)]:
              // the two arbitrary properties have equal specificity and the
              // 6px rule won the cascade for the selected panel too, leaving
              // it sitting 6px low and its footer clipped by the fixed-height
              // shell. First-class utilities compose through Tailwind's
              // transform pipeline and do not collide.
              "col-start-1 row-start-1 min-h-0 transition-[opacity,transform] duration-200 ease-out",
              selected
                ? "opacity-100 translate-y-0"
                : "pointer-events-none opacity-0 translate-y-1.5"
            )}
          >
            {render(id, i, selected)}
          </div>
        );
      })}
    </div>
  );
}
