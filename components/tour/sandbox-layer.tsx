"use client";

import { TourProvider } from "@/components/tour/tour-provider";
import { TourCoachmark } from "@/components/tour/tour-coachmark";

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
  return (
    <TourProvider autoStart>
      {children}
      <TourCoachmark />
    </TourProvider>
  );
}
