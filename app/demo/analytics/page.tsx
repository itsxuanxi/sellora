"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompleteStep, useDemo } from "@/components/demo/demo-store";
import { DemoDataBadge } from "@/components/demo/demo-chrome";
import { DEMO_ROUTES } from "@/lib/demo/steps";
import {
  ADVANCED_EXPECTED,
  DEMO_LOOP,
  DEMO_OPPORTUNITY,
  DEMO_SUMMARY,
  EXPECTED_UPLIFT,
  INITIAL_EXPECTED,
  formatUsd,
} from "@/lib/demo/fixture";

/**
 * Step 9: the loop, laid out end to end, and the way out.
 *
 * The chain is the whole argument of the product — that a recommendation can
 * be traced to the signals behind it and forward to what the buyer did — so it
 * is rendered as five linked stages rather than a chart.
 *
 * The completion panel reports advancement and nothing more. No win is
 * claimed, no revenue is described as realised, and no accuracy figure appears
 * anywhere: none of those would be true.
 */
export default function DemoAnalyticsPage() {
  const { state } = useDemo();
  const completeStep = useCompleteStep();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--mkt-muted)]">
            Outcome
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-[28px]">
            Close the signal–action–outcome loop
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--mkt-muted)]">
            Sellora records which signals led to which recommendation, what the
            team executed, how the buyer responded, and how the opportunity
            changed.
          </p>
        </div>
        <DemoDataBadge />
      </div>

      {/* The chain */}
      <ol className="mt-8 grid gap-3 lg:grid-cols-5">
        {DEMO_LOOP.map((link, i) => (
          <li key={link.stage} className="relative">
            <div className="h-full rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--mkt-brand-wash)] font-mono text-[10px] text-[var(--mkt-brand-deep)]">
                  {i + 1}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--mkt-brand-deep)]">
                  {link.stage}
                </span>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--mkt-ink)]">
                {link.body}
              </p>
            </div>
            {i < DEMO_LOOP.length - 1 && (
              <ArrowRight
                className="absolute -right-[13px] top-1/2 hidden size-4 -translate-y-1/2 text-[var(--mkt-line)] lg:block"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ol>

      {/* Outcome numbers */}
      <section className="mt-8 rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5">
        <h2 className="text-[15px] font-medium tracking-tight">
          What changed on {DEMO_OPPORTUNITY.name}
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Expected revenue before"
            value={formatUsd(INITIAL_EXPECTED)}
          />
          <Stat
            label="Expected revenue after"
            value={formatUsd(state.opportunityUpdated ? ADVANCED_EXPECTED : INITIAL_EXPECTED)}
            strong
          />
          <Stat
            label="Change"
            value={
              state.opportunityUpdated ? `+${formatUsd(EXPECTED_UPLIFT)}` : "—"
            }
            tone="good"
          />
        </dl>
        <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--mkt-muted)]">
          The opportunity advanced from {DEMO_OPPORTUNITY.initialStage} to{" "}
          {DEMO_OPPORTUNITY.advancedStage}. It has not been won, and Sellora is
          not claiming to have closed it — the loop records what happened, in
          order, so the connection can be checked rather than asserted.
        </p>
      </section>

      {!state.demoCompleted ? (
        <div className="mt-8">
          <button
            type="button"
            data-demo-target="complete-demo"
            onClick={() => completeStep("demoCompleted")}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--mkt-brand)] px-7 text-[15px] font-medium text-white transition-colors hover:bg-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]"
          >
            <Check className="size-4" strokeWidth={3} aria-hidden />
            Complete demo
          </button>
        </div>
      ) : (
        <CompletionPanel onReplay={() => router.push(DEMO_ROUTES.workspace)} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "good";
}) {
  return (
    <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-4 py-3">
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-[20px] tabular-nums leading-none tracking-tight",
          strong && "font-medium",
          tone === "good" && "text-[var(--mkt-success)]"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CompletionPanel({ onReplay }: { onReplay: () => void }) {
  const { restart } = useDemo();

  return (
    <section
      role="status"
      className="mt-8 overflow-hidden rounded-3xl bg-[var(--mkt-dark)] px-6 py-10 sm:px-10 sm:py-12"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#A99BFF]">
        Demo complete
      </p>
      <h2 className="mt-3 max-w-2xl text-balance text-2xl font-medium leading-tight tracking-tight text-[#F7F8F5] sm:text-3xl">
        You moved one deal from signal to revenue action.
      </h2>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#C9CCC7]">
        You saw how Sellora detects buying signals, prioritizes an opportunity,
        recommends one action, keeps the seller in control, and connects the
        buyer response back to pipeline.
      </p>

      <dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_SUMMARY.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
          >
            <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#9BA09C]">
              {s.label}
            </dt>
            <dd className="mt-1 text-[15px] font-medium tabular-nums text-[#F7F8F5]">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/sign-in"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#F7F8F5] px-6 text-[14px] font-medium text-[var(--mkt-dark)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-dark)]"
        >
          Start a 14-day free trial
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link
          href="mailto:hello@sellora.ai?subject=Sellora%20demo"
          className="inline-flex h-11 items-center rounded-full border border-white/20 px-6 text-[14px] font-medium text-[#F7F8F5] transition-colors hover:border-[#A99BFF] hover:text-[#CFC6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF]"
        >
          Book a demo
        </Link>
        <button
          type="button"
          onClick={() => {
            restart();
            onReplay();
          }}
          className="inline-flex h-11 items-center rounded-full border border-white/20 px-6 text-[14px] font-medium text-[#F7F8F5] transition-colors hover:border-[#A99BFF] hover:text-[#CFC6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF]"
        >
          Replay guided demo
        </button>
        <Link
          href={DEMO_ROUTES.workspace}
          className="inline-flex h-11 items-center px-2 text-[14px] font-medium text-[#C9CCC7] underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
        >
          Explore the workspace
        </Link>
      </div>
    </section>
  );
}
