"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The nav's "Book a demo" button.
 *
 * A client component only so it can read the pathname: on /request-demo the
 * button that would take you there is the one you already used, and leaving it
 * looking like an untaken action makes the nav disagree with the page. It
 * stays a link rather than becoming inert text, so a visitor who has scrolled
 * into the page still has a way back to the top of the form.
 */
export function NavDemoCta({ className }: { className?: string }) {
  const pathname = usePathname();
  const active = pathname === "/request-demo";

  return (
    <Link
      href="/request-demo"
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]",
        active
          ? // Emphasised in the brand purple rather than the default ink, so
            // it reads as "you are here" without going grey and looking broken.
            "bg-[var(--mkt-brand)] text-white hover:bg-[var(--mkt-brand-deep)]"
          : "bg-[var(--mkt-ink)] text-[var(--mkt-page)] hover:bg-[var(--mkt-brand-deep)] active:bg-black",
        className
      )}
    >
      Book a demo
    </Link>
  );
}
