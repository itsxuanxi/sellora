"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { useDemo } from "@/components/demo/demo-store";
import { DEMO_ROUTES } from "@/lib/demo/steps";

/**
 * The demo's own header. Always says GUIDED DEMO, so it is never mistaken for
 * a real workspace, and always offers a way out — Restart, Exit, and the one
 * commercial door (Book a demo) that a visitor might want mid-tour.
 */
export function DemoChrome() {
  const { restart, exit } = useDemo();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--mkt-line)] bg-[var(--mkt-surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Logo size="sm" />
        <span className="hidden rounded-full border border-[var(--mkt-brand)]/30 bg-[var(--mkt-brand-wash)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--mkt-brand-deep)] sm:inline">
          Guided demo
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              restart();
              router.push(DEMO_ROUTES.workspace);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mkt-line)] px-3 py-1.5 text-[12px] font-medium text-[var(--mkt-ink)] transition-colors hover:border-[var(--mkt-brand)] hover:text-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)]"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Restart</span>
          </button>
          <Link
            href="mailto:hello@sellora.ai?subject=Sellora%20demo"
            className="hidden rounded-full border border-[var(--mkt-line)] px-3 py-1.5 text-[12px] font-medium text-[var(--mkt-ink)] transition-colors hover:border-[var(--mkt-brand)] hover:text-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] md:inline-block"
          >
            Book a demo
          </Link>
          <button
            type="button"
            onClick={() => {
              exit();
              router.push("/");
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mkt-ink)] px-3 py-1.5 text-[12px] font-medium text-[var(--mkt-page)] transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)]"
          >
            <X className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Exit demo</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/** The persistent reminder that none of this is real. */
export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={
        className ??
        "inline-block rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--mkt-muted)]"
      }
    >
      Illustrative demo data
    </span>
  );
}
