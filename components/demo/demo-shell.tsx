"use client";

import { usePathname } from "next/navigation";
import { DemoBar, DemoSidebar } from "@/components/demo/demo-chrome";
import { DEMO_ROUTES } from "@/lib/demo/steps";

/**
 * Everything inside the demo except the front door is framed exactly like the
 * signed-in app: the same fixed rail, the same 60-wide offset, the same
 * `max-w-6xl` content column with the same padding as `app/(app)/layout.tsx`.
 *
 * The intro at /demo is the one exception — it is a page about the demo rather
 * than a screen of the product, so it keeps a bare header.
 */
export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === DEMO_ROUTES.intro;

  if (bare) {
    return (
      <>
        <DemoBar bare />
        <main>{children}</main>
      </>
    );
  }

  return (
    <>
      <DemoSidebar />
      <div className="lg:pl-60">
        <DemoBar />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </>
  );
}
