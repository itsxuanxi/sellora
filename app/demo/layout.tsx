import type { Metadata } from "next";
import { GuidedDemoProvider } from "@/components/demo/demo-store";
import { DemoSpotlight } from "@/components/demo/demo-spotlight";
import { DemoShell } from "@/components/demo/demo-shell";

export const metadata: Metadata = {
  title: "Guided demo",
  description:
    "Follow one deal from signal to revenue. No sign-up, no CRM connection, no credit card.",
};

/**
 * The demo shell.
 *
 * Deliberately outside both the (marketing) and (app) route groups: it needs
 * neither the marketing navbar nor an authenticated session. `middleware.ts`
 * protects an explicit list of app routes and /demo is not on it, so this is
 * public without any auth change.
 *
 * It renders the app's own palette and chrome rather than the marketing
 * microsite's, because the promise of a demo is that this is the product.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground antialiased">
      <GuidedDemoProvider>
        <DemoShell>{children}</DemoShell>
        <DemoSpotlight />
      </GuidedDemoProvider>
    </div>
  );
}
