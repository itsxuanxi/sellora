"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCompleteStep, useDemo } from "@/components/demo/demo-store";
import { DemoDataBadge } from "@/components/demo/demo-chrome";
import { DEMO_ROUTES } from "@/lib/demo/steps";
import {
  DEMO_NOTE,
  RANKED_PIPELINE,
  formatUsd,
} from "@/lib/demo/fixture";

/**
 * Step 1's surface: the ranked pipeline.
 *
 * Cloudmint sits first because expected revenue puts it there — Northstar is
 * the larger deal at $68,000 and ranks below it. That ordering is the point of
 * the screen, so the table shows the arithmetic in a column rather than
 * asserting a rank the visitor has to take on trust.
 */
export default function DemoWorkspacePage() {
  const { state } = useDemo();
  const completeStep = useCompleteStep();
  const router = useRouter();

  function openOpportunity(id: string) {
    if (id !== "cloudmint") return;
    completeStep("opportunityOpened");
    router.push(DEMO_ROUTES.opportunity);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--mkt-muted)]">
            Sales workspace
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-[28px]">
            Today&apos;s priorities
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--mkt-muted)]">
            Ranked by expected revenue — deal value multiplied by win
            probability — not by deal size or recency.
          </p>
        </div>
        <DemoDataBadge />
      </div>

      {/* Desktop: a table, because the whole point is comparing a column of
          numbers. Mobile falls back to cards below. */}
      <div className="mt-7 overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)]">
        <div className="hidden grid-cols-[2.2fr_1fr_1fr_1.2fr_1fr] gap-3 border-b border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mkt-muted)] md:grid">
          <span>Opportunity</span>
          <span className="text-right">Deal value</span>
          <span className="text-right">Win prob.</span>
          <span className="text-right">Expected revenue</span>
          <span className="text-right">Last activity</span>
        </div>

        <ul>
          {RANKED_PIPELINE.map((r, i) => {
            const isFocus = r.id === "cloudmint";
            // The focus row carries the live values so the number the visitor
            // sees here can never disagree with the detail page.
            const winProbability = isFocus ? state.winProbability : r.winProbability;
            const expected = isFocus ? state.expectedRevenue : r.expected;

            return (
              <li key={r.id}>
                <button
                  type="button"
                  data-demo-target={isFocus ? "pipeline-cloudmint" : undefined}
                  onClick={() => openOpportunity(r.id)}
                  disabled={!isFocus}
                  aria-label={
                    isFocus
                      ? `Open ${r.company} — ${formatUsd(r.dealValue)}`
                      : `${r.company} is not part of this demo`
                  }
                  className={cn(
                    "w-full border-b border-[var(--mkt-line)] px-5 py-4 text-left transition-colors last:border-b-0",
                    isFocus
                      ? "cursor-pointer hover:bg-[var(--mkt-brand-wash)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--mkt-brand)]"
                      : "cursor-not-allowed opacity-55"
                  )}
                >
                  <div className="grid gap-2 md:grid-cols-[2.2fr_1fr_1fr_1.2fr_1fr] md:items-center md:gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 font-mono text-[12px] tabular-nums text-[var(--mkt-muted)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-medium">{r.company}</span>
                          {isFocus && (
                            <span className="rounded-full bg-[var(--mkt-danger)]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--mkt-danger)]">
                              Needs attention
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--mkt-muted)]">
                          {isFocus ? state.stage : r.stage} · {r.note}
                        </p>
                      </div>
                    </div>

                    <Cell label="Deal value" value={formatUsd(r.dealValue)} />
                    <Cell label="Win prob." value={`${winProbability}%`} />
                    <Cell
                      label="Expected revenue"
                      value={formatUsd(expected)}
                      strong={isFocus}
                    />
                    <Cell label="Last activity" value={r.lastActivity} muted />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-4 text-[12px] text-[var(--mkt-muted)]">
        {DEMO_NOTE}. Only Cloudmint is interactive in this demo.
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 md:block md:text-right">
      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--mkt-muted)] md:hidden">
        {label}
      </span>
      <span
        className={cn(
          "text-[14px] tabular-nums",
          strong ? "font-medium text-[var(--mkt-ink)]" : muted ? "text-[var(--mkt-muted)]" : ""
        )}
      >
        {value}
      </span>
    </div>
  );
}
