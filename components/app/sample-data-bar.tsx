"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, FlaskConical, Loader2 } from "lucide-react";
import { SANDBOX_WORKSPACE_NOTICE, SIMULATION_NOTICE } from "@/lib/sandbox";
import { useOptionalTour } from "@/components/tour/tour-provider";
import {
  clearSampleDataAction,
  loadSampleDataAction,
} from "@/app/(app)/sample-actions";

/**
 * The standing disclosure.
 *
 * Any workspace holding sample rows says so on every screen — a sandbox
 * visitor and a customer who clicked "Load sample data" at onboarding see the
 * same strip, because the risk it warns about is the same one: the numbers on
 * screen describe invented companies.
 *
 * The clear is one click and irreversible-by-design, which is the whole point
 * of offering sample data in a real workspace at all.
 */
export function SampleDataBar({
  sandbox,
  hasSampleData,
}: {
  /** The whole workspace is a throwaway sandbox. */
  sandbox: boolean;
  /** Sample rows are present (true for a fresh sandbox too). */
  hasSampleData: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // Present only in a sandbox; a real workspace has no tour to restart.
  const tour = useOptionalTour();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      // Whichever way this went, the record the user was looking at may no
      // longer exist — clearing deletes it, loading replaces it. Going home
      // is the only destination guaranteed to still be there.
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="border-b border-amber-500/25 bg-amber-50/70 dark:bg-amber-950/20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-800 dark:text-amber-300">
          <FlaskConical className="size-3" aria-hidden />
          Sample data
        </span>

        <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-amber-900/90 dark:text-amber-200/90">
          {sandbox ? SANDBOX_WORKSPACE_NOTICE : SIMULATION_NOTICE}
          {error && <span className="ml-2 font-medium text-rose-700">{error}</span>}
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          {tour && !tour.running && (
            <button
              type="button"
              onClick={tour.start}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-3 py-1.5 text-[12px] font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200"
            >
              <Compass className="size-3" aria-hidden />
              Guided tour
            </button>
          )}
          {sandbox && (
            <Link
              href="/sign-up"
              className="rounded-full bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Create a real workspace
            </Link>
          )}
          {hasSampleData ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(clearSampleDataAction)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-3 py-1.5 text-[12px] font-medium text-amber-900 transition-colors hover:bg-amber-500/10 disabled:opacity-60 dark:text-amber-200"
            >
              {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
              Clear sample data
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(loadSampleDataAction)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-3 py-1.5 text-[12px] font-medium text-amber-900 transition-colors hover:bg-amber-500/10 disabled:opacity-60 dark:text-amber-200"
            >
              {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
              Load sample data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
