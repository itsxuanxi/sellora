"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { useDemo } from "@/components/demo/demo-store";
import { DEMO_ROUTES } from "@/lib/demo/steps";

/**
 * The demo's front door. One promise, three stages, one button.
 *
 * `Start the demo` arms the tour and drops the visitor on step 1; `Skip to the
 * sales workspace` leaves the tour off so they can wander. Both land on the
 * same workspace — the difference is only whether the coachmarks run.
 */

const STAGES = [
  {
    n: "01",
    eyebrow: "Detect",
    title: "Capture the signals that matter",
    body: "Selryn connects website activity, email engagement, meetings and CRM changes into one opportunity timeline.",
  },
  {
    n: "02",
    eyebrow: "Decide",
    title: "Know what to do next",
    body: "Selryn ranks the opportunity by expected revenue and recommends one action with the evidence attached.",
  },
  {
    n: "03",
    eyebrow: "Learn",
    title: "Connect action to outcome",
    body: "The customer response, pipeline movement and revenue result flow back into Selryn’s learning loop.",
  },
];

export default function DemoIntroPage() {
  const { start, skipTour } = useDemo();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-brand-deep)]">
          Guided demo
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mkt-line)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
          <Clock className="size-3" aria-hidden />
          3 minutes
        </span>
      </div>

      <h1 className="mt-5 max-w-3xl text-balance text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-[3.4rem]">
        Follow one deal from signal to revenue.
      </h1>
      <p className="mt-6 max-w-2xl text-pretty text-[17px] leading-relaxed text-[var(--mkt-muted)]">
        See how Selryn detects buying intent, prioritizes the opportunity,
        recommends the next best action, and connects the result back to
        pipeline and revenue.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            start();
            router.push(DEMO_ROUTES.workspace);
          }}
          className="group inline-flex h-12 items-center gap-2 rounded-full bg-[var(--mkt-brand)] px-7 text-[15px] font-medium text-white transition-colors hover:bg-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]"
        >
          Start the demo
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            skipTour();
            router.push(DEMO_ROUTES.workspace);
          }}
          className="inline-flex h-12 items-center rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-6 text-[15px] font-medium text-[var(--mkt-ink)] transition-colors hover:border-[var(--mkt-brand)] hover:text-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)]"
        >
          Skip to the sales workspace
        </button>
      </div>

      <p className="mt-5 text-[13px] text-[var(--mkt-muted)]">
        No sign-up, no CRM connection, no credit card. Every company and person
        in this demo is fictional, and nothing you do here leaves your browser.
      </p>

      <ol className="mt-16 grid gap-5 md:grid-cols-3">
        {STAGES.map((s) => (
          <li
            key={s.n}
            className="rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-6"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[13px] text-[var(--mkt-brand-deep)]">
                {s.n}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
                {s.eyebrow}
              </span>
            </div>
            <h2 className="mt-4 text-[16px] font-medium leading-snug tracking-tight">
              {s.title}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--mkt-muted)]">
              {s.body}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-12 text-[13px] text-[var(--mkt-muted)]">
        Prefer to talk to someone?{" "}
        <Link
          href="/request-demo"
          className="font-medium text-[var(--mkt-ink)] underline decoration-[var(--mkt-line)] underline-offset-4 hover:text-[var(--mkt-brand-deep)]"
        >
          Book a demo
        </Link>
        .
      </p>
    </div>
  );
}
