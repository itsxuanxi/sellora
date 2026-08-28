"use client";

import { useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { signInToDemo } from "@/app/(marketing)/auth-actions";

/**
 * The one door into the sandbox.
 *
 * Provisioning seeds a whole workspace — accounts, signals, scored
 * opportunities, a worked history — so it takes a few seconds. The button owns
 * that wait rather than handing the visitor a blank page, and says what is
 * happening while it works.
 */
export function SandboxEntryButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      // Awaited inside the transition: `signInToDemo` finishes with a
      // `redirect()`, and React only propagates that if it can see the promise.
      // Firing it and discarding the result leaves the button spinning on a
      // page that has already been replaced server-side.
      onClick={() => startTransition(async () => { await signInToDemo(); })}
      className="group inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Building your sandbox workspace…
        </>
      ) : (
        <>
          Open the sandbox workspace
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}
