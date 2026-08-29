"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { signInToDemo } from "@/app/(marketing)/auth-actions";

/**
 * The two doors into the sandbox: the guided story, or the bare workspace.
 *
 * Provisioning seeds a whole workspace, so it takes a few seconds. The button
 * owns that wait rather than handing the visitor a blank page — and owns the
 * failure too. An earlier version discarded the action's result, so a sandbox
 * that could not be created simply stopped spinning and said nothing.
 */
export function SandboxEntry() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<"guided" | "workspace" | null>(null);

  function enter(guided: boolean) {
    setError(null);
    setAttempt(guided ? "guided" : "workspace");
    startTransition(async () => {
      // On success this never returns — the action redirects. Anything that
      // comes back is a failure worth showing.
      const result = await signInToDemo({ guided });
      if (result && !result.ok) {
        setError(result.error ?? "Could not open the sandbox workspace.");
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => enter(true)}
          className="group inline-flex h-[54px] items-center gap-2 rounded-full bg-foreground px-8 text-[16px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {pending && attempt === "guided" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Preparing your workspace…
            </>
          ) : (
            <>
              {error ? "Try again" : "Start the demo"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => enter(false)}
          className="inline-flex h-[54px] items-center px-2 text-[15px] font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground disabled:opacity-70"
        >
          {pending && attempt === "workspace" ? "Opening…" : "Skip to the workspace"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-[13.5px] text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {error} Nothing was created — press <strong>Try again</strong> to
            retry.
          </span>
        </p>
      )}
    </div>
  );
}
