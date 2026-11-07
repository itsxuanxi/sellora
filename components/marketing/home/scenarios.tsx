"use client";

import { useId, useMemo } from "react";
import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegrationClaim } from "@/lib/marketing/capabilities";
import { useAutoRotate } from "@/components/marketing/home/use-auto-rotate";
import {
  sequenceDuration,
  useDemoSequence,
} from "@/components/marketing/home/use-demo-sequence";
import { TabStrip } from "@/components/marketing/home/tab-strip";
import {
  DEMO_DATA_NOTE,
  RECORDED_STEPS,
  SCENARIOS,
  stepDelays,
  CAPABILITY_STATUS_HELP,
  TRUST_POINTS,
} from "@/components/marketing/home/demo-data";

/**
 * Screen 2 — "How does Selryn work, and why should I trust it?"
 *
 * Sits on the slightly deeper band so the three screens read as light →
 * slightly deeper → light, giving the page tonal structure without any dark
 * background.
 *
 * The layout deliberately differs from screen 1: tabs and the process
 * timeline occupy the left rail while the right side carries the changing
 * product surface, so the two carousels do not look like the same component
 * twice. Timeline and panel swap together, which is what makes it read as one
 * application doing different work.
 *
 * Step states follow the spec: completed steps get a green check, the step in
 * focus a solid purple dot with darker text, later steps stay muted, and a
 * risk step is marked with a small amber dot rather than tinting the row.
 */

const IDS = SCENARIOS.map((s) => s.id);
const LABELS = SCENARIOS.map((s) => s.tabLabel);

/** Steps that describe a risk, marked with a small amber dot. */
const RISK_STEPS: Record<string, number[]> = {
  recover: [1, 2],
  prioritize: [],
  convert: [],
};

export function Scenarios({
  integrations,
}: {
  /** Resolved server-side against this deployment's credentials — see
   *  lib/marketing/capabilities.ts for why this is not a constant. */
  integrations: IntegrationClaim[];
}) {
  // Each scenario's dwell time is summed from its own steps: these run 7, 5
  // and 7 steps, and one shared constant either rushed the long ones or left
  // the short one sitting finished for seconds.
  const durations = useMemo(
    () => SCENARIOS.map((sc) => sequenceDuration(stepDelays(sc), 1600)),
    []
  );
  const rotate = useAutoRotate(SCENARIOS.length, durations);

  const activeScenario = SCENARIOS[rotate.active];
  const delays = useMemo(() => stepDelays(activeScenario), [activeScenario]);

  const sequence = useDemoSequence({
    stepCount: activeScenario.steps.length,
    delays,
    paused: rotate.contentPaused,
    reduced: rotate.reduced,
    resetKey: activeScenario.id,
  });
  const baseId = useId();

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 border-y border-[var(--mkt-line)] bg-[var(--mkt-band)] px-5 py-20 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-brand-deep)]">
            How it works
          </p>
          <h2 className="mt-4 text-balance text-3xl font-medium leading-[1.12] tracking-tight text-[var(--mkt-ink)] sm:text-4xl md:text-[2.7rem]">
            One place for the proposals nobody has answered.
          </h2>
          <p className="mt-5 text-pretty text-[16px] leading-relaxed text-[var(--mkt-muted)]">
            Selryn reads your deal records and the email history on them —
            who wrote, when, and whether anyone replied — names what is
            overdue and why, and drafts the follow-up for you to approve. It
            sits beside whatever you use to track work; there is nothing to
            migrate.
          </p>
        </div>

        {/* ── Left rail: tabs + timeline · Right: product surface ── */}
        <div
          ref={rotate.containerRef}
          {...rotate.interactionProps}
          className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10"
        >
          <div className="min-w-0">
            <TabStrip
              rotate={rotate}
              labels={LABELS}
              ids={IDS}
              baseId={baseId}
              ariaLabel="Selryn workflow scenarios"
              size="lg"
              orientation="vertical"
            />

            {/* All three timelines stay mounted, stacked in one grid cell, so
                the rail is permanently as tall as the longest scenario.
                Scenarios have 7, 5 and 7 steps — rendering only the active one
                moved the whole page 94px on every auto-advance. */}
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)]">
              {SCENARIOS.map((sc, sIdx) => {
                const shown = sIdx === rotate.active;
                return (
                  <div
                    key={sc.id}
                    aria-hidden={!shown}
                    inert={!shown}
                    className={cn(
                      "col-start-1 row-start-1 transition-[opacity,transform] duration-300 ease-out",
                      shown
                        ? "opacity-100 translate-y-0"
                        : "pointer-events-none opacity-0 translate-y-1.5"
                    )}
                  >
                    <p className="text-[15px] font-medium leading-snug text-[var(--mkt-ink)]">
                      {sc.title}
                    </p>

                    {/* Every step stays mounted and is revealed by opacity
                        and translate, never by mounting — that is what keeps
                        the rail exactly as tall as its finished state while
                        the steps land one at a time. */}
                    <ol className="mt-5 space-y-3">
                      {sc.steps.map((step, i) => {
                        // Live position from the sequence clock. Inactive
                        // scenarios read as un-started so they replay from
                        // the first step when they come back round.
                        const reached = shown ? sequence.revealed : 0;
                        const focus = shown && i === reached - 1 && !sequence.complete;
                        const done = i < reached && !focus;
                        const risk = RISK_STEPS[sc.id]?.includes(i);
                        return (
                          <li
                            key={step.label}
                            className={cn(
                              "relative pl-7 transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                              shown && i < reached
                                ? "opacity-100 translate-y-0"
                                : "opacity-0 translate-y-2"
                            )}
                            aria-hidden={!(shown && i < reached)}
                          >
                    <span
                      className={cn(
                        "absolute left-0 top-[2px] flex size-4 items-center justify-center rounded-full border",
                        done
                          ? "border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]"
                          : focus
                            ? "border-[var(--mkt-brand)] bg-[var(--mkt-brand)]"
                            : "border-[var(--mkt-line)] bg-[var(--mkt-surface)]"
                      )}
                      aria-hidden
                    >
                      {done ? (
                        <Check className="size-2.5" strokeWidth={3} />
                      ) : focus ? (
                        <span className="size-1.5 rounded-full bg-white" />
                      ) : null}
                    </span>

                    {i < sc.steps.length - 1 && (
                      <span
                        className="absolute left-[7.5px] top-[19px] h-[calc(100%+4px)] w-px bg-[var(--mkt-line)]"
                        aria-hidden
                      />
                    )}

                    <span
                      className={cn(
                        "flex flex-wrap items-center gap-x-2 text-[13px] leading-snug",
                        focus || done
                          ? "font-medium text-[var(--mkt-ink)]"
                          : "text-[var(--mkt-muted)]"
                      )}
                    >
                      {step.label}
                      {risk && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-normal text-[var(--mkt-warn-ink)]">
                          <span
                            className="size-1.5 rounded-full bg-[var(--mkt-warn)]"
                            aria-hidden
                          />
                          risk
                        </span>
                      )}
                    </span>
                    {step.note && (
                      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--mkt-muted)]">
                        {step.note}
                      </span>
                    )}
                  </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Product surface. One stacked container so height never moves. ── */}
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] shadow-[var(--mkt-shadow-panel)] lg:sticky lg:top-24 lg:self-start">
            {SCENARIOS.map((sc, i) => {
              const selected = i === rotate.active;
              return (
                <div
                  key={sc.id}
                  role="tabpanel"
                  id={`${baseId}-panel-${sc.id}`}
                  aria-labelledby={`${baseId}-tab-${sc.id}`}
                  aria-hidden={!selected}
                  inert={!selected}
                  className={cn(
                    "col-start-1 row-start-1 transition-[opacity,transform] duration-300 ease-out",
                    selected
                      ? "opacity-100 translate-y-0"
                      : "pointer-events-none opacity-0 translate-y-1.5"
                  )}
                >
                  <ScenarioSurface index={i} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Trust, folded in rather than given its own screen ── */}
        <div className="mt-16 grid gap-10 border-t border-[var(--mkt-line)] pt-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
              Integrations
            </h3>
            {/* Three states, because there are three real situations. The
                two-state version had to call a finished connector with no
                credentials either "available" — offering a connection nobody
                can make — or "planned", denying work that exists and is
                tested. The honest middle is "needs setup". */}
            <ul className="mt-4 flex flex-wrap gap-2">
              {integrations.map((it) => (
                <li key={it.name}>
                  <span
                    title={CAPABILITY_STATUS_HELP[it.status]}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]",
                      it.status === "available" &&
                        "border border-[var(--mkt-line)] bg-[var(--mkt-surface)] text-[var(--mkt-ink)]",
                      it.status === "needs_setup" &&
                        "border border-[var(--mkt-line)] text-[var(--mkt-ink)]",
                      it.status === "planned" &&
                        "border border-dashed border-[var(--mkt-line)] text-[var(--mkt-muted)]"
                    )}
                  >
                    {it.status === "available" && (
                      <span
                        className="size-1.5 rounded-full bg-[var(--mkt-success)]"
                        aria-hidden
                      />
                    )}
                    {it.status === "needs_setup" && (
                      <span
                        className="size-1.5 rounded-full border border-[var(--mkt-success)]"
                        aria-hidden
                      />
                    )}
                    {it.name}
                    {it.status !== "available" && (
                      <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--mkt-muted)]">
                        {it.status === "needs_setup" ? "needs setup" : "planned"}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
              A filled dot works now with nothing to configure. A hollow dot is
              built and tested but needs credentials or a connection first.
              Dashed is not built — we would rather say so than imply otherwise.
            </p>

            {/* What "email history" means here, stated before anyone pays for
                it. Selryn reads who wrote, when, and whether a reply came
                back — subjects, direction and timestamps, which is what a CRM
                exposes. It does not read message bodies, so it cannot find a
                question inside one; that is why open questions are marked
                Inferred in the product and are something you record, not
                something Selryn discovers. Writing the limit down is cheaper
                than a pilot that ends on it. */}
            <p className="mt-3 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-3.5 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
              <span className="font-medium text-[var(--mkt-ink)]">
                What Selryn reads from your email.
              </span>{" "}
              Who wrote, when, and whether a reply came back — the subject
              line, the direction and the date, which is what a connected CRM
              exposes. It does not open message bodies, so it will not find a
              question buried in one; questions you have noted on a deal count,
              and the product marks that difference on every card. Starting
              from a spreadsheet instead works too, on the dates in it.
            </p>

            <h3 className="mt-9 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
              What gets written down
            </h3>
            <ol className="mt-4 space-y-2.5">
              {RECORDED_STEPS.map((row, i) => (
                <li key={row.step} className="flex gap-3">
                  <span
                    className="mt-0.5 font-mono text-[10.5px] tabular-nums text-[var(--mkt-brand-deep)]"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] leading-snug text-[var(--mkt-ink)]">
                      {row.step}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--mkt-muted)]">
                      {row.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
              You can walk all five in the demo. Selryn has no customer results
              to publish yet and will not print a number it has not measured.
            </p>
          </div>

          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
              Control and trust
            </h3>
            <ul className="mt-4 space-y-3.5">
              {TRUST_POINTS.map((t) => (
                <li key={t.text} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                      t.status === "available"
                        ? "border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]"
                        : "border-[var(--mkt-line)] text-[var(--mkt-muted)]"
                    )}
                    aria-hidden
                  >
                    {t.status === "available" ? (
                      <Check className="size-3" />
                    ) : (
                      <Clock className="size-3" />
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-[14px] leading-snug text-[var(--mkt-ink)]">
                    {t.text}
                    {t.status === "planned" && (
                      <span className="rounded border border-[var(--mkt-line)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--mkt-muted)]">
                        Planned
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-[var(--mkt-line)] pt-4 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
              Selryn holds no third-party security certification and does not
              claim one.{" "}
              <Link
                href="/security"
                className="font-medium text-[var(--mkt-ink)] underline decoration-[var(--mkt-line)] underline-offset-4 transition-colors hover:text-[var(--mkt-brand-deep)]"
              >
                The security page
              </Link>{" "}
              lists what is in place and what is not, in enough detail to send
              to whoever asks.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── The changing product surface ───────────────────────────────────────────

function ScenarioSurface({ index }: { index: number }) {
  const s = SCENARIOS[index];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-4 py-2.5 sm:px-5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-[var(--mkt-line)]" />
          <span className="size-2 rounded-full bg-[var(--mkt-line)]" />
          <span className="size-2 rounded-full bg-[var(--mkt-line)]" />
        </span>
        <span className="text-[11px] font-medium tracking-[0.05em] text-[var(--mkt-ink)]">
          {s.account}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
          Workflow
        </span>
      </div>

      <div className="flex-1 space-y-4 px-4 py-5 sm:px-5">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.11em] text-[var(--mkt-muted)]">
            Outcome
          </span>
          <dl className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {s.outcome.map((o) => (
              <div
                key={o.label}
                className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-3 py-2.5"
              >
                <dt className="text-[11px] text-[var(--mkt-muted)]">{o.label}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-[15px] font-medium",
                    o.tone === "good"
                      ? "text-[var(--mkt-success)]"
                      : "text-[var(--mkt-brand-deep)]"
                  )}
                >
                  {o.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="rounded-xl border border-[var(--mkt-brand)]/25 bg-[var(--mkt-brand-wash)] px-3 py-2.5 text-[12px] leading-snug text-[var(--mkt-brand-deep)]">
          {s.result}
        </p>
      </div>

      <div className="border-t border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-4 py-2 sm:px-5">
        <span className="text-[10px] text-[var(--mkt-muted)]">{DEMO_DATA_NOTE}</span>
      </div>
    </div>
  );
}
