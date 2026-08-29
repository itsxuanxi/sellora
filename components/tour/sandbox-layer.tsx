"use client";

import { useSearchParams } from "next/navigation";
import { TourProvider, useTour } from "@/components/tour/tour-provider";
import { TourCoachmark } from "@/components/tour/tour-coachmark";
import { TourComplete } from "@/components/tour/tour-complete";

/**
 * Wraps the sandbox in its guided tour, and does nothing anywhere else.
 *
 * A real customer's workspace renders `children` untouched — no provider, no
 * overlay, no listeners. That is deliberate: the tour is a visitor aid, and
 * the product must not carry it into paying workspaces.
 */
export function SandboxLayer({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  // No Suspense boundary: `app/(app)/layout.tsx` is force-dynamic, so
  // useSearchParams never suspends here. Wrapping it in one whose fallback
  // also rendered `children` emitted the entire dashboard twice.
  return <GuidedSandbox>{children}</GuidedSandbox>;
}

/**
 * Starts the story only when the visitor asked for it.
 *
 * "Start the demo" lands on `?tour=start`; "Skip to the workspace" does not,
 * and gets the product without a coachmark over it. Once running, progress
 * lives in sessionStorage, so the flag is only needed on the way in.
 */
function GuidedSandbox({ children }: { children: React.ReactNode }) {
  const guided = useSearchParams().get("tour") === "start";
  return (
    <TourProvider autoStart={guided}>
      {children}
      <TourCoachmark />
      <TourFinish />
    </TourProvider>
  );
}

/** Shows the result screen once the story has actually been finished. */
function TourFinish() {
  const { completed, start, dismiss } = useTour();
  if (!completed) return null;
  return <TourComplete onRestart={start} onClose={dismiss} />;
}
