import type { Metadata } from "next";
import { GuidedDemoProvider } from "@/components/demo/demo-store";
import { DemoSpotlight } from "@/components/demo/demo-spotlight";
import { DemoChrome } from "@/components/demo/demo-chrome";

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
 * `.mkt` carries Sellora's warm-white palette, so the demo looks like the rest
 * of the product rather than a separate microsite.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt min-h-svh bg-[var(--mkt-page)] font-sans text-[var(--mkt-ink)] antialiased">
      <GuidedDemoProvider>
        <DemoChrome />
        <main>{children}</main>
        <DemoSpotlight />
      </GuidedDemoProvider>
    </div>
  );
}
