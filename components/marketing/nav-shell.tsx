"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Condenses the marketing nav once the page scrolls: a slightly tighter bar
 * that picks up a light blur and a very soft shadow. Warm white rather than
 * black — a solid dark bar would fight the light page beneath it.
 * Purely presentational; auth-aware content comes from the server component.
 *
 * The announcement strip sits *inside* the fixed header, below the nav row,
 * so the two scroll as one object and the hero only has to clear one height.
 * That height is published as --mkt-header so the hero's top padding is
 * derived from it rather than guessed at and re-guessed whenever the bar
 * changes; see the note on the announcement below.
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled &&
          "shadow-[0_1px_16px_rgba(28,31,29,0.06)] backdrop-blur-xl"
      )}
    >
      <div
        className={cn(
          "border-b transition-colors duration-300",
          scrolled
            ? "border-[var(--mkt-line)] bg-[color-mix(in_srgb,var(--mkt-page)_88%,transparent)] backdrop-blur-xl"
            : "border-transparent bg-[color-mix(in_srgb,var(--mkt-page)_70%,transparent)] backdrop-blur-md"
        )}
      >
        <nav
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-between px-5 transition-[height] duration-300 md:px-8",
            scrolled ? "h-14" : "h-16"
          )}
        >
          {children}
        </nav>
      </div>

      <Announcement />
    </header>
  );
}

/**
 * The strip every funded company uses to announce a raise.
 *
 * Selryn has no raise to announce, so it announces the only thing it can
 * honestly put there: the guided demo, which really does run one deal from a
 * revenue risk through to a booked meeting. It is a real link to a real page,
 * which is more than most of these strips manage.
 */
function Announcement() {
  return (
    <div className="bg-[var(--mkt-brand-deep)] text-white">
      <Link
        href="/demo"
        className="group mx-auto flex h-10 max-w-6xl items-center justify-center gap-2.5 px-5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 md:px-8"
      >
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] sm:inline-flex">
          <span className="size-1 rounded-full bg-white/80" aria-hidden />
          New
        </span>
        {/* Two strings rather than one truncated one. A strip that ellipses
            mid-word — "…end to end — reve…" — reads as a layout bug, and the
            reader loses the half of the sentence that says what it does. */}
        <span className="truncate text-[13px] text-white/85 sm:hidden">
          See the guided demo
        </span>
        <span className="hidden truncate text-[13px] text-white/85 sm:inline">
          The guided demo now runs one deal end to end — revenue risk to booked
          meeting.
        </span>
        <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-medium underline decoration-white/40 underline-offset-4 group-hover:decoration-white sm:inline-flex">
          Try it
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}
