"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { Reveal, Section, SectionLabel } from "@/components/marketing/section";
import { DATA_NOTE, Panel, SignalChip } from "@/components/marketing/home/product-ui";

/**
 * §6 — the loop, shown as one product surface advancing through states
 * instead of five unrelated cards.
 *
 * The stage advances on a timer while the section is on screen, and stops the
 * moment it scrolls away or the user takes control by clicking a step. Under
 * prefers-reduced-motion it never auto-advances — the steps become a plain
 * clickable list and the first state is shown.
 *
 * The animation carries information: each stage shows what the system knows at
 * that point, so watching it once explains the pipeline.
 */

interface Stage {
  n: string;
  title: string;
  detail: string;
}

const STAGES: Stage[] = [
  {
    n: "01",
    title: "Connect your pipeline",
    detail: "Accounts, contacts and deals come in from your CRM or an import.",
  },
  {
    n: "02",
    title: "Monitor every opportunity",
    detail: "Each deal is watched continuously — not reviewed once a week.",
  },
  {
    n: "03",
    title: "Detect intent and risk signals",
    detail: "Buying actions and silence are both evidence, and both get recorded.",
  },
  {
    n: "04",
    title: "Rank deals by expected revenue",
    detail: "Value × probability, so attention follows money rather than volume.",
  },
  {
    n: "05",
    title: "Recommend the next best action",
    detail: "One action per deal, with the reasoning a human can check.",
  },
];

const STAGE_MS = 3200;

export function Workflow() {
  const [stage, setStage] = useState(0);
  const [userControlled, setUserControlled] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Only run while visible — an off-screen timer is wasted work.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (userControlled || !inView || prefersReducedMotion()) return;
    const t = setInterval(() => setStage((s) => (s + 1) % STAGES.length), STAGE_MS);
    return () => clearInterval(t);
  }, [userControlled, inView]);

  return (
    <Section id="how-it-works" ref={sectionRef}>
      <Reveal>
        <SectionLabel number="03" label="How it works" />
        <h2 className="mt-8 max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          From signal to action, continuously.
        </h2>
        <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-neutral-300">
          Sellora does not produce a weekly report. It runs against your
          pipeline as it changes, and the recommendation updates with it.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        {/* ── Steps ── */}
        <ol className="flex flex-col">
          {STAGES.map((s, i) => {
            const active = i === stage;
            return (
              <li key={s.n}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => {
                    setUserControlled(true);
                    setStage(i);
                  }}
                  className={cn(
                    "group relative w-full border-l-2 py-4 pl-5 pr-2 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]",
                    active ? "border-violet-400" : "border-white/[0.10] hover:border-white/30"
                  )}
                >
                  <span className="flex items-baseline gap-3">
                    <span
                      className={cn(
                        "font-mono text-[11px] transition-colors",
                        active ? "text-violet-300" : "text-neutral-500"
                      )}
                    >
                      {s.n}
                    </span>
                    <span
                      className={cn(
                        "text-[15px] font-medium transition-colors sm:text-base",
                        active ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
                      )}
                    >
                      {s.title}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 block overflow-hidden pl-[2.1rem] text-[14px] leading-relaxed text-neutral-300 transition-all duration-500",
                      active ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    {s.detail}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* ── The one surface, advancing ── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Panel
            label="Cloudmint · continuous evaluation"
            meta={
              <span className="text-[11px] tabular-nums text-neutral-400">
                Step {stage + 1} / {STAGES.length}
              </span>
            }
          >
            {/* progress hairline */}
            <div className="h-px w-full bg-white/[0.06]" aria-hidden>
              <div
                className="h-px bg-violet-400/70 transition-[width] duration-500 ease-out"
                style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }}
              />
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-5">
              <StageRow
                on={stage >= 0}
                label="Pipeline connected"
                value="1,284 accounts · 312 open deals"
              />
              <StageRow
                on={stage >= 1}
                label="Monitoring"
                value="312 opportunities watched continuously"
              />

              <div
                className={cn(
                  "transition-all duration-500",
                  stage >= 2 ? "opacity-100" : "pointer-events-none opacity-25"
                )}
              >
                <div className="text-[10px] uppercase tracking-[0.09em] text-neutral-400">
                  Signals detected
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <SignalChip>Proposal opened ×2</SignalChip>
                  <SignalChip>New stakeholder</SignalChip>
                  <SignalChip>No reply · 4 days</SignalChip>
                </div>
              </div>

              <div
                className={cn(
                  "transition-all duration-500",
                  stage >= 3 ? "opacity-100" : "pointer-events-none opacity-25"
                )}
              >
                <div className="text-[10px] uppercase tracking-[0.09em] text-neutral-400">
                  Expected revenue
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-2 tabular-nums">
                  <span className="text-lg font-medium text-white">$61,000</span>
                  <span className="text-neutral-400" aria-hidden>×</span>
                  <span className="text-lg font-medium text-white">70%</span>
                  <span className="text-neutral-400" aria-hidden>=</span>
                  <span className="text-lg font-medium text-violet-300">$42,800</span>
                  <span className="text-[11px] text-neutral-400">rank 01 of 312</span>
                </div>
              </div>

              <div
                className={cn(
                  "transition-all duration-500",
                  stage >= 4 ? "opacity-100" : "pointer-events-none opacity-25"
                )}
              >
                <div className="text-[10px] uppercase tracking-[0.09em] text-neutral-400">
                  Recommended action
                </div>
                <div className="mt-1.5 flex items-start gap-2 rounded-md border border-violet-400/20 bg-violet-400/[0.06] px-2.5 py-2">
                  <span className="text-[12px] leading-snug text-violet-100">
                    Send a stakeholder-specific follow-up today
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-white/[0.08] px-4 py-2 sm:px-5">
              <span className="text-[10px] text-neutral-400">{DATA_NOTE}</span>
            </div>
          </Panel>
        </div>
      </div>
    </Section>
  );
}

function StageRow({
  on,
  label,
  value,
}: {
  on: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 transition-opacity duration-500",
        on ? "opacity-100" : "opacity-25"
      )}
    >
      <span className="text-[12px] text-neutral-400">{label}</span>
      <span className="text-[12px] tabular-nums text-neutral-200">{value}</span>
    </div>
  );
}
