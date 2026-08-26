"use client";

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
}: {
  rotate: AutoRotate;
  labels: string[];
  ids: readonly string[];
  baseId: string;
  ariaLabel: string;
  size?: "sm" | "lg";
}) {
  const { active, goTo, onKeyDown, registerTab, paused, reduced, remaining } = rotate;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              "group relative shrink-0 rounded-md text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]",
              size === "lg" ? "px-3 py-2.5" : "px-2.5 py-2",
              selected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
            )}
          >
            <span
              className={cn(
                "block whitespace-nowrap font-medium uppercase tracking-[0.11em] transition-colors",
                size === "lg" ? "text-[11px]" : "text-[10px]",
                selected ? "text-violet-200" : "text-neutral-400 group-hover:text-neutral-200"
              )}
            >
              {label}
            </span>

            <span
              className="mt-1.5 block h-px w-full overflow-hidden rounded-full bg-white/[0.10]"
              aria-hidden
            >
              {selected && (
                <span
                  key={`${active}-${paused}-${reduced}`}
                  className={cn(
                    "block h-px origin-left bg-violet-400",
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
    <div className={cn("grid", className)}>
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
              "col-start-1 row-start-1 transition-[opacity,transform] duration-300 ease-out",
              selected
                ? "opacity-100 [transform:translateY(0)]"
                : "pointer-events-none opacity-0 [transform:translateY(6px)]"
            )}
          >
            {render(id, i, selected)}
          </div>
        );
      })}
    </div>
  );
}
