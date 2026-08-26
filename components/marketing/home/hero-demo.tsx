"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { formatMoney } from "@/lib/revenue/money";
import {
  COMMAND,
  DEMO_DATA_NOTE,
  DEMO_DEALS,
  DEMO_STAGES,
  FOCUS_DEAL,
  MONITORING,
  NEXT_ACTION,
  PRIORITIZATION,
  STAGE_DURATION_MS,
} from "@/components/marketing/home/demo-data";

/**
 * The hero's auto-advancing product demo.
 *
 * Four stages of one continuous piece of work on a single deal — Cloudmint is
 * detected, ranked, acted on, and rolled up — so the carousel reads as Sellora
 * working rather than as four screenshots.
 *
 * Two implementation notes worth knowing before editing:
 *
 * 1. LAYOUT STABILITY. All four panels are always mounted and stacked in the
 *    same CSS grid cell, so the container is permanently as tall as the
 *    tallest panel and switching can never move the page. Inactive panels are
 *    faded out and made `inert` + `aria-hidden` rather than `hidden`, because
 *    `hidden` would drop them from layout and reintroduce the height jump.
 *
 * 2. THE TIMER. Advancing uses a single timeout whose remaining time is
 *    tracked explicitly, so pausing (hover, tab blur) resumes where it left
 *    off instead of restarting. The progress line is a CSS animation paused
 *    by the same state — deliberately not React state, which would mean ~60
 *    re-renders a second for a decorative bar.
 */

const TONE_TEXT = {
  high: "text-violet-300",
  rising: "text-sky-300",
  risk: "text-rose-300",
} as const;

const TONE_DOT = {
  high: "bg-violet-400",
  rising: "bg-sky-400",
  risk: "bg-rose-400",
} as const;

const PRIORITY_STYLE = {
  urgent: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  warn: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  watch: "border-white/[0.12] bg-white/[0.04] text-neutral-300",
} as const;

export function HeroDemo() {
  const [active, setActive] = useState(0);
  // Two independent reasons to hold the carousel. Sharing one boolean made
  // them fight: leaving the demo with the mouse would resume playback even
  // while the browser tab was in the background.
  const [hoverPaused, setHoverPaused] = useState(false);
  const [pagePaused, setPagePaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const paused = hoverPaused || pagePaused;
  const baseId = useId();

  // Remaining time on the current stage, so a pause resumes rather than restarts.
  const remainingRef = useRef(STAGE_DURATION_MS);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Jump to a stage and restart its clock — used by clicks and keyboard. */
  const goTo = useCallback(
    (index: number) => {
      clearTimer();
      remainingRef.current = STAGE_DURATION_MS;
      setActive(((index % DEMO_STAGES.length) + DEMO_STAGES.length) % DEMO_STAGES.length);
    },
    [clearTimer]
  );

  // The advance timer. Re-armed whenever the stage changes or play resumes.
  useEffect(() => {
    if (reduced || paused) return;

    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      // Null the ref BEFORE advancing. The cleanup below runs when `active`
      // changes and banks unspent time for pause/resume; without this it
      // cannot tell "paused mid-stage" from "stage completed" and would bank
      // ~0ms, so the next stage would flash past in the 240ms floor.
      timerRef.current = null;
      remainingRef.current = STAGE_DURATION_MS;
      setActive((a) => (a + 1) % DEMO_STAGES.length);
    }, remainingRef.current);

    return () => {
      // A still-pending timer means we were interrupted (pause or manual
      // jump), so bank what is left — that is what makes resume seamless.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const spent = Date.now() - startedAtRef.current;
        remainingRef.current = Math.max(240, remainingRef.current - spent);
      }
    };
  }, [active, paused, reduced]);

  // Hold while the tab is hidden or unfocused — a carousel advancing in a
  // background tab means a returning visitor lands mid-story.
  //
  // Focus is tracked from blur/focus *events* rather than polling
  // document.hasFocus(). Some embedded and automated contexts report no focus
  // even while the page is plainly visible, and reading that on mount would
  // leave the demo frozen for those visitors. Reacting to a real blur avoids
  // that failure mode while still meeting the requirement.
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

  // Belt-and-braces cleanup: the effect above already clears on unmount, but
  // an explicit teardown guarantees no timer outlives the component.
  useEffect(() => clearTimer, [clearTimer]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = active + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = DEMO_STAGES.length - 1;
    if (next === null) return;
    e.preventDefault();
    const idx = ((next % DEMO_STAGES.length) + DEMO_STAGES.length) % DEMO_STAGES.length;
    goTo(idx);
    tabRefs.current[idx]?.focus();
  };

  return (
    <div
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      // Deliberately no focus-based pause: clicking a tab focuses it, so
      // pausing on focus would freeze the carousel the first time anyone
      // interacted with it. Keyboard users instead get a full fresh interval
      // on every arrow press, because goTo() restarts the clock.
      className="w-full"
    >
      {/* ── Tabs ── */}
      <div
        role="tablist"
        aria-label="Sellora product walkthrough"
        onKeyDown={onKeyDown}
        // Horizontally scrollable on narrow screens rather than wrapping,
        // which would change the demo's height on mobile.
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {DEMO_STAGES.map((stage, i) => {
          const selected = i === active;
          return (
            <button
              key={stage.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`${baseId}-tab-${stage.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${stage.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => goTo(i)}
              className={cn(
                "group relative shrink-0 rounded-md px-2.5 py-2 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]",
                selected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
              )}
            >
              <span
                className={cn(
                  "block whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.11em] transition-colors",
                  selected ? "text-violet-200" : "text-neutral-400 group-hover:text-neutral-200"
                )}
              >
                {stage.label}
              </span>

              {/* Progress rail — fills over the stage duration, pauses with it. */}
              <span
                className="mt-1.5 block h-px w-full overflow-hidden rounded-full bg-white/[0.10]"
                aria-hidden
              >
                {selected && (
                  <span
                    // Remounting on each stage restarts the animation cleanly.
                    key={`${active}-${paused}-${reduced}`}
                    className={cn(
                      "block h-px origin-left bg-violet-400",
                      reduced ? "scale-x-100" : "[animation:demo-progress_var(--dur)_linear_forwards]"
                    )}
                    style={
                      reduced
                        ? undefined
                        : ({
                            // Resume from where the pause left off.
                            ["--dur" as string]: `${remainingRef.current}ms`,
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

      {/* ── Stacked panels: container height = tallest panel, always ── */}
      <div className="grid overflow-hidden rounded-xl border border-white/[0.10] bg-[#101014] shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)]">
        {DEMO_STAGES.map((stage, i) => {
          const selected = i === active;
          return (
            <div
              key={stage.id}
              role="tabpanel"
              id={`${baseId}-panel-${stage.id}`}
              aria-labelledby={`${baseId}-tab-${stage.id}`}
              aria-hidden={!selected}
              inert={!selected}
              className={cn(
                "col-start-1 row-start-1 transition-[opacity,transform,filter] duration-300 ease-out",
                selected
                  ? "opacity-100 blur-0 [transform:translateY(0)]"
                  : "pointer-events-none opacity-0 blur-[3px] [transform:translateY(4px)]"
              )}
            >
              <PanelChrome label={stage.panelLabel} live={stage.id === "monitoring"}>
                {stage.id === "monitoring" && <MonitoringPanel active={selected} />}
                {stage.id === "prioritization" && <PrioritizationPanel />}
                {stage.id === "action" && <ActionPanel />}
                {stage.id === "command" && <CommandPanel />}
              </PanelChrome>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared chrome ──────────────────────────────────────────────────────────

function PanelChrome({
  label,
  live,
  children,
}: {
  label: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </span>
        <span className="truncate text-[11px] font-medium tracking-[0.05em] text-neutral-300">
          {label}
        </span>
        {live && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-neutral-300">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400/70 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-violet-400" />
            </span>
            Live
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-3.5 sm:px-5">{children}</div>

      <div className="border-t border-white/[0.08] px-4 py-2 sm:px-5">
        <span className="text-[10px] text-neutral-400">{DEMO_DATA_NOTE}</span>
      </div>
    </div>
  );
}

function StatusLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.11em] text-neutral-400">
      {children}
    </p>
  );
}

// ── Stage 1 ────────────────────────────────────────────────────────────────

function MonitoringPanel({ active }: { active: boolean }) {
  return (
    <div>
      <StatusLine>{MONITORING.status}</StatusLine>

      {/* Keyed on `active` so the stagger replays each time the stage comes
          round. `fade-up` animates opacity and translate only — never height —
          so replaying it cannot disturb the panel's size. */}
      <ul key={active ? "on" : "off"} className="space-y-2">
        {DEMO_DEALS.map((d, i) => (
          <li
            key={d.company}
            className={cn(
              "rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5",
              active && "animate-fade-up"
            )}
            style={active ? { animationDelay: `${i * 110}ms` } : undefined}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-white">{d.company}</span>
              <span className={cn("flex items-center gap-1.5 text-[11px]", TONE_TEXT[d.readoutTone])}>
                <span className={cn("size-1.5 rounded-full", TONE_DOT[d.readoutTone])} aria-hidden />
                {d.readoutLabel}: {d.readoutValue}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {d.signals.map((s) => (
                <span
                  key={s}
                  className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-neutral-300"
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-400">{d.status}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Stage 2 ────────────────────────────────────────────────────────────────

function PrioritizationPanel() {
  return (
    <div>
      <StatusLine>{PRIORITIZATION.status}</StatusLine>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-b border-white/[0.08] text-left">
              {["", "Account", "Deal value", "Close", "Expected", "Priority"].map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className={cn(
                    "pb-2 text-[10px] font-medium uppercase tracking-[0.09em] text-neutral-400",
                    i >= 2 && i <= 4 && "text-right"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {DEMO_DEALS.map((d) => (
              <tr key={d.company}>
                <td className="py-2.5 pr-2 text-[11px] tabular-nums text-neutral-400">
                  {d.rank}
                </td>
                <td className="py-2.5 pr-2 text-[13px] font-medium text-white">
                  {d.company}
                </td>
                <td className="py-2.5 pr-2 text-right text-[12px] tabular-nums text-neutral-200">
                  {formatMoney(d.dealValue)}
                </td>
                <td className="py-2.5 pr-2 text-right text-[12px] tabular-nums text-neutral-300">
                  {d.probability}%
                </td>
                <td className="py-2.5 pr-2 text-right text-[13px] font-medium tabular-nums text-violet-200">
                  {formatMoney(d.expected)}
                </td>
                <td className="py-2.5 text-right">
                  <span
                    className={cn(
                      "inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]",
                      PRIORITY_STYLE[d.priorityTone]
                    )}
                  >
                    {d.priority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 border-t border-white/[0.08] pt-2.5 text-[11px] text-neutral-400">
        {PRIORITIZATION.formula}
      </p>
    </div>
  );
}

// ── Stage 3 ────────────────────────────────────────────────────────────────

function ActionPanel() {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-white">{NEXT_ACTION.company}</span>
        <span className="text-[12px] text-neutral-400">
          Expected revenue{" "}
          <span className="font-medium tabular-nums text-violet-200">
            {formatMoney(NEXT_ACTION.expected)}
          </span>
        </span>
      </div>

      <div className="mt-3">
        <StatusLine>Why now</StatusLine>
        <ul className="space-y-1">
          {NEXT_ACTION.whyNow.map((r) => (
            <li key={r} className="flex gap-2 text-[12px] leading-snug text-neutral-200">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-violet-400" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-md border border-violet-400/20 bg-violet-400/[0.06] px-2.5 py-2">
        <span className="text-[12px] font-medium leading-snug text-violet-100">
          {NEXT_ACTION.action}
        </span>
      </div>

      {/* Draft awaiting approval — never shown as sent. */}
      <div className="mt-3 rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5">
        <div className="text-[10px] uppercase tracking-[0.09em] text-neutral-400">
          Draft · awaiting your approval
        </div>
        <p className="mt-1 truncate text-[12px] font-medium text-neutral-100">
          {NEXT_ACTION.draft.subject}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-neutral-300">
          {NEXT_ACTION.draft.body}
        </p>
      </div>

      {/* Rendered as non-focusable spans: this is a picture of the product,
          not a live control, so it must not enter the tab order. */}
      <div className="mt-3 flex flex-wrap items-center gap-2" aria-hidden>
        <span className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-neutral-200">
          Review message
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-black">
          Approve and send
        </span>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">{NEXT_ACTION.approvalNote}</p>
    </div>
  );
}

// ── Stage 4 ────────────────────────────────────────────────────────────────

function CommandPanel() {
  const max = Math.max(...COMMAND.trend);
  const pts = COMMAND.trend
    .map((v, i) => {
      const x = (i / (COMMAND.trend.length - 1)) * 100;
      const y = 30 - (v / max) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {COMMAND.metrics.map((m) => (
          <div key={m.label}>
            <div className="text-[10px] font-medium uppercase tracking-[0.09em] text-neutral-400">
              {m.label}
            </div>
            <div
              className={cn(
                "mt-0.5 text-lg font-medium tabular-nums tracking-tight",
                m.tone === "risk"
                  ? "text-rose-300"
                  : m.tone === "accent"
                    ? "text-violet-200"
                    : "text-white"
              )}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 border-t border-white/[0.08] pt-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.09em] text-neutral-400">
          Expected revenue trend
        </div>
        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          className="mt-1.5 h-9 w-full"
          role="img"
          aria-label="Expected revenue trending upward over the last twelve weeks"
        >
          <polyline
            points={pts}
            fill="none"
            stroke="rgb(167 139 250)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <dl className="mt-2 grid grid-cols-3 gap-3 border-t border-white/[0.08] pt-2.5">
        {COMMAND.breakdown.map((b) => (
          <div key={b.label}>
            <dt className="text-[10px] leading-tight text-neutral-400">{b.label}</dt>
            <dd
              className={cn(
                "mt-0.5 text-[15px] font-medium tabular-nums",
                b.tone === "up"
                  ? "text-emerald-300"
                  : b.tone === "down"
                    ? "text-rose-300"
                    : "text-neutral-100"
              )}
            >
              {b.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 rounded-md border border-violet-400/20 bg-violet-400/[0.06] px-2.5 py-2 text-[12px] leading-snug text-violet-100">
        {COMMAND.insight}
      </p>
    </div>
  );
}

/** Re-exported so other marketing surfaces can stay on the same story. */
export { FOCUS_DEAL };
