"use client";

import { useId, useMemo } from "react";
import { useAutoRotate } from "@/components/marketing/home/use-auto-rotate";
import { useDemoSequence } from "@/components/marketing/home/use-demo-sequence";
import { StackedPanels, TabStrip } from "@/components/marketing/home/tab-strip";
import { DemoStage } from "@/components/marketing/home/demo-stage";
import {
  DEMO_DATA_NOTE,
  HERO_SCENARIOS,
  HERO_STAGE_DURATION_MS,
  scenarioDelays,
  scenarioStatus,
} from "@/components/marketing/home/demo-data";

/**
 * Screen 1's product surface: four scenarios of one continuous piece of work
 * on one deal — Cloudmint is detected, ranked, acted on, then the result is
 * recorded — so the hero shows Selryn working rather than four screenshots.
 *
 * Two clocks, and only two, both shared:
 *
 *   useAutoRotate    which scenario is on screen, and every pause reason
 *                    (hover, hidden tab, off-viewport, reduced motion,
 *                    manual pick) that the whole demo obeys.
 *   useDemoSequence  how far through that scenario we are, reading its
 *                    pause state from the hook above rather than deciding
 *                    for itself.
 *
 * There is exactly one sequence instance, driving the active scenario. The
 * other three panels stay mounted for height but reveal nothing, so four
 * scenarios never animate at once.
 *
 * Each scenario's dwell time is summed from its own step delays, so adding a
 * step lengthens its tab automatically instead of being truncated by a shared
 * constant.
 */

const IDS = HERO_SCENARIOS.map((s) => s.id);
const LABELS = HERO_SCENARIOS.map((s) => s.tabLabel);

export function HeroDemo() {
  // One shared dwell across all four, so the tab progress line means the same
  // thing on every tab. A test asserts each scenario's steps finish inside it.
  const rotate = useAutoRotate(HERO_SCENARIOS.length, HERO_STAGE_DURATION_MS);
  const baseId = useId();

  const activeScenario = HERO_SCENARIOS[rotate.active];
  const delays = useMemo(() => scenarioDelays(activeScenario), [activeScenario]);

  const sequence = useDemoSequence({
    stepCount: activeScenario.steps.length,
    delays,
    paused: rotate.contentPaused,
    reduced: rotate.reduced,
    resetKey: activeScenario.id,
  });

  return (
    <div ref={rotate.containerRef} {...rotate.interactionProps} className="w-full">
      <TabStrip
        rotate={rotate}
        labels={LABELS}
        ids={IDS}
        baseId={baseId}
        ariaLabel="Selryn product walkthrough"
        size="xl"
        fill
      />

      <StackedPanels
        ids={IDS}
        baseId={baseId}
        active={rotate.active}
        // A fixed panel height is what lets four scenarios of different length
        // share one container without the page moving under the reader. It is
        // taller on narrow screens on purpose: the same copy wraps to many
        // more lines at 375px, and a height tuned for the desktop panel would
        // clip the recommendation card there.
        //
        // The two heights are measured, not guessed. The binding case is the
        // recommendation panel at the moment the approval control is awaiting
        // and the approved card has not yet replaced it — both are laid out,
        // and that is the tallest anything gets.
        className="h-[780px] overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] shadow-[var(--mkt-shadow-panel)] sm:h-[700px]"
        render={(id, i, selected) => (
          <PanelChrome status={scenarioStatus(HERO_SCENARIOS[i])} live={selected}>
            <DemoStage
              scenario={HERO_SCENARIOS[i]}
              // Inactive panels hold their full height but stay blank, so the
              // scenario replays from its first step when it comes back round.
              revealed={selected ? sequence.revealed : 0}
              reduced={rotate.reduced}
              live={selected}
            />
          </PanelChrome>
        )}
      />
    </div>
  );
}

// ── Shared chrome ──────────────────────────────────────────────────────────

function PanelChrome({
  status,
  live,
  children,
}: {
  status: { label: string; count: string };
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* A status bar, not window chrome.
          This used to be three grey circles imitating a macOS title bar —
          decoration that took the most valuable strip of the panel and said
          nothing. It now states what the panel is doing and how much of it is
          done, which is the one thing a reader glancing at a product shot
          wants to know. */}
      <div className="flex items-center gap-3 border-b border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-5 py-3">
        {live && (
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mkt-success)]">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--mkt-success)]/60 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[var(--mkt-success)]" />
            </span>
            Live
          </span>
        )}
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
          {/* The mechanism only. The panel label named the subject —
              "Signal monitor · Cloudmint" — which the row directly beneath
              already states in full, so carrying it here made the bar read
              as the same sentence twice. */}
          {status.label}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums tracking-[0.06em] text-[var(--mkt-ink)]">
          {status.count}
        </span>
      </div>

      {/* min-h-0 lets the step list shrink inside the fixed-height panel
          instead of pushing the footer out of the bottom. */}
      <div className="min-h-0 flex-1 px-5 py-4 sm:px-6">{children}</div>

      {/* Kept, but quiet: the disclosure has to be present and must not
          compete with the product surface above it. */}
      <div className="border-t border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-5 py-2 sm:px-6">
        <span className="text-[10px] text-[var(--mkt-muted)]/75">{DEMO_DATA_NOTE}</span>
      </div>
    </div>
  );
}
