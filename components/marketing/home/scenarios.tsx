"use client";

import { useId } from "react";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutoRotate } from "@/components/marketing/home/use-auto-rotate";
import { StackedPanels, TabStrip } from "@/components/marketing/home/tab-strip";
import {
  DEMO_DATA_NOTE,
  INTEGRATIONS,
  OUTCOME_METRICS,
  SCENARIOS,
  SCENARIO_DURATION_MS,
  TRUST_POINTS,
} from "@/components/marketing/home/demo-data";

/**
 * Screen 2 — "How does Sellora work, and why should I trust it?"
 *
 * Three scenarios rotate through one continuously-changing app surface: the
 * timeline, the account and the outcome panel all swap together, so it reads
 * as the same product doing different work rather than three marketing cards.
 *
 * This section absorbs what used to be five separate blocks (Problem,
 * Capabilities, Workflow, Ask Sellora, Solutions, Control), plus the
 * integrations strip. Rotation behaviour is shared with the hero via
 * useAutoRotate; only the layout differs.
 */

const IDS = SCENARIOS.map((s) => s.id);
const LABELS = SCENARIOS.map((s) => s.tabLabel);

export function Scenarios() {
  const rotate = useAutoRotate(SCENARIOS.length, SCENARIO_DURATION_MS);
  const baseId = useId();

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 border-t border-white/[0.06] bg-white/[0.012] px-5 py-20 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        {/* ── Fixed heading ── */}
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-violet-300">
            How it works
          </p>
          <h2 className="mt-4 text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.6rem]">
            One revenue brain. From signal to action.
          </h2>
          <p className="mt-5 text-pretty text-[16px] leading-relaxed text-neutral-300">
            Sellora connects pipeline activity, detects what changed, ranks
            every opportunity by expected revenue, and recommends the next best
            action.
          </p>
        </div>

        {/* ── Rotating scenarios ── */}
        <div ref={rotate.containerRef} {...rotate.hoverProps} className="mt-10">
          <TabStrip
            rotate={rotate}
            labels={LABELS}
            ids={IDS}
            baseId={baseId}
            ariaLabel="Sellora workflow scenarios"
            size="lg"
          />

          <StackedPanels
            ids={IDS}
            baseId={baseId}
            active={rotate.active}
            className="overflow-hidden rounded-xl border border-white/[0.10] bg-[#101014] shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)]"
            render={(_id, i, selected) => (
              <ScenarioPanel index={i} active={selected} />
            )}
          />
        </div>

        {/* ── Integrations + trust, folded in rather than given their own screens ── */}
        <div className="mt-14 grid gap-10 border-t border-white/[0.08] pt-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
              Integrations
            </h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {INTEGRATIONS.map((it) => (
                <li key={it.name}>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]",
                      it.status === "available"
                        ? "border border-white/[0.10] bg-white/[0.03] text-neutral-200"
                        : "border border-dashed border-white/[0.12] text-neutral-400"
                    )}
                  >
                    {it.status === "available" && (
                      <span className="size-1.5 rounded-full bg-violet-400" aria-hidden />
                    )}
                    {it.name}
                    {it.status === "planned" && (
                      // neutral-500 measured 4.12:1 at 10px — below AA.
                      <span className="text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                        planned
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-neutral-400">
              Solid rows connect today. Dashed rows are on the roadmap and are
              not yet available — we would rather say so than imply otherwise.
            </p>

            {/* Outcome metrics: unfilled until measured. */}
            <h3 className="mt-9 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
              Customer outcomes
            </h3>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              {OUTCOME_METRICS.map((m) => (
                <div
                  key={m}
                  className="rounded-lg border border-white/[0.08] px-3 py-3 text-center"
                >
                  <dd
                    className="text-2xl font-medium text-neutral-500"
                    aria-label="Pending measurement"
                  >
                    &mdash;
                  </dd>
                  <dt className="mt-1 text-[11px] leading-tight text-neutral-300">{m}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-neutral-400">
              We publish these once measured with real customers, not before.
            </p>
          </div>

          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
              Control and trust
            </h3>
            <ul className="mt-4 space-y-3.5">
              {TRUST_POINTS.map((t) => (
                <li key={t.text} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                      t.status === "available"
                        ? "border-violet-400/30 bg-violet-400/10 text-violet-300"
                        : "border-white/[0.12] text-neutral-400"
                    )}
                    aria-hidden
                  >
                    {t.status === "available" ? (
                      <Check className="size-3" />
                    ) : (
                      <Clock className="size-3" />
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-[14px] leading-snug text-neutral-200">
                    {t.text}
                    {t.status === "planned" && (
                      <span className="rounded border border-white/[0.12] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400">
                        Planned
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-white/[0.08] pt-4 text-[12px] leading-relaxed text-neutral-400">
              Sellora holds no third-party security certification at this time
              and does not claim one. If your procurement needs a security
              review, contact us and we will work through it directly.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── One scenario ───────────────────────────────────────────────────────────

function ScenarioPanel({ index, active }: { index: number; active: boolean }) {
  const s = SCENARIOS[index];

  return (
    <div className="flex h-full flex-col">
      {/* chrome */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.08] bg-white/[0.02] px-4 py-2.5 sm:px-5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </span>
        <span className="text-[11px] font-medium tracking-[0.05em] text-neutral-300">
          {s.account}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.1em] text-neutral-400">
          Workflow
        </span>
      </div>

      <div className="grid flex-1 gap-6 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* ── Timeline ── */}
        <div>
          <p className="text-[13px] font-medium leading-snug text-white">{s.title}</p>

          {/* Keyed on `active` so steps re-land each time the scenario returns.
              fade-up moves opacity and translate only, never height, so the
              replay cannot change the panel's size. */}
          <ol key={active ? `on-${index}` : `off-${index}`} className="mt-4 space-y-2.5">
            {s.steps.map((step, i) => (
              <li
                key={step.label}
                className={cn("relative pl-6", active && "animate-fade-up")}
                style={active ? { animationDelay: `${i * 80}ms` } : undefined}
              >
                <span
                  className="absolute left-0 top-[3px] flex size-3.5 items-center justify-center rounded-full border border-violet-400/40 bg-violet-400/10"
                  aria-hidden
                >
                  <span className="size-1 rounded-full bg-violet-400" />
                </span>
                {i < s.steps.length - 1 && (
                  <span
                    className="absolute left-[6.5px] top-[17px] h-[calc(100%+2px)] w-px bg-white/[0.10]"
                    aria-hidden
                  />
                )}
                <span className="block text-[13px] leading-snug text-neutral-100">
                  {step.label}
                </span>
                {step.note && (
                  <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400">
                    {step.note}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* ── Outcome ── */}
        <div className="flex flex-col gap-3 lg:border-l lg:border-white/[0.08] lg:pl-6">
          <span className="text-[10px] font-medium uppercase tracking-[0.11em] text-neutral-400">
            Outcome
          </span>

          <dl className="space-y-2.5">
            {s.outcome.map((o) => (
              <div
                key={o.label}
                className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5"
              >
                <dt className="text-[11px] text-neutral-400">{o.label}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-[15px] font-medium",
                    o.tone === "good" ? "text-emerald-300" : "text-violet-200"
                  )}
                >
                  {o.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-auto rounded-md border border-violet-400/20 bg-violet-400/[0.06] px-2.5 py-2 text-[12px] leading-snug text-violet-100">
            {s.result}
          </p>
        </div>
      </div>

      <div className="border-t border-white/[0.08] px-4 py-2 sm:px-5">
        <span className="text-[10px] text-neutral-400">{DEMO_DATA_NOTE}</span>
      </div>
    </div>
  );
}
