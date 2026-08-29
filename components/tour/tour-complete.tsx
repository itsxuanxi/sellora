"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, Loader2, RotateCcw, X } from "lucide-react";
import { getTourOutcome, type TourOutcome } from "@/app/(app)/tour-actions";

/**
 * The closing screen.
 *
 * Every figure is read back from the record rather than remembered by the
 * tour, so a visitor who skipped the actions sees a screen that says nothing
 * moved — which is true, and better than congratulating them for work they
 * did not do.
 */
export function TourComplete({
  onRestart,
  onClose,
}: {
  onRestart: () => void;
  onClose: () => void;
}) {
  const [outcome, setOutcome] = useState<TourOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    getTourOutcome()
      .then((result) => {
        if (!cancelled) setOutcome(result);
      })
      .catch(() => {
        // A failed read must not trap the visitor behind a spinner.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted) return null;

  const moved = outcome?.changed ?? false;

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-foreground/50 p-4 backdrop-blur-sm">
      <div className="mx-auto my-[6vh] w-full max-w-2xl rounded-3xl border border-border/70 bg-card p-8 shadow-2xl sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Demo complete
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 className="mt-4 text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
          {moved
            ? "One risk detected. One action approved. One deal moved forward."
            : "That is the loop — detect, decide, act, learn."}
        </h2>

        {loading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Reading the result…
          </p>
        ) : outcome ? (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              {moved ? (
                <>
                  {outcome.company} · {outcome.dealValue}. Every figure below was
                  computed by the same scoring engine a customer runs, from the
                  evidence you recorded.
                </>
              ) : (
                <>
                  You moved through the story without recording an action, so
                  nothing changed on {outcome.company} — which is exactly what
                  the record shows. Restart and approve the follow-up to see the
                  figures move.
                </>
              )}
            </p>

            <dl className="mt-7 grid gap-3 sm:grid-cols-3">
              <Metric
                label="Win probability"
                value={`${outcome.winBefore}% → ${outcome.winAfter}%`}
                positive={outcome.winAfter > outcome.winBefore}
              />
              <Metric
                label="Expected revenue"
                value={`${outcome.expectedBefore} → ${outcome.expectedAfter}`}
                positive={outcome.upliftPositive}
              />
              <Metric
                label="Change"
                value={moved ? outcome.upliftLabel : "No change"}
                positive={outcome.upliftPositive}
              />
            </dl>

            <p className="mt-4 text-[13px] text-muted-foreground">
              The deal advanced. It has not been won — Selryn reports movement,
              never a result it cannot see.
            </p>
          </>
        ) : (
          <p className="mt-4 text-[15px] text-muted-foreground">
            The sample deal is no longer in this workspace, so there is nothing
            to report. Reload the sample data to run the story again.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Create a real workspace
            <ArrowRight className="size-4" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 items-center rounded-full border border-border/70 px-6 text-[15px] font-medium transition-colors hover:border-primary hover:text-primary"
          >
            Explore the sandbox
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-12 items-center gap-1.5 px-2 text-[15px] font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Restart the demo
          </button>
          <Link
            href="/request-demo"
            className="inline-flex h-12 items-center px-2 text-[15px] font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Metric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3.5">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          "mt-1.5 text-[19px] font-semibold tabular-nums tracking-tight " +
          (positive ? "text-emerald-700 dark:text-emerald-400" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
