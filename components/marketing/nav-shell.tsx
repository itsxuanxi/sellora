"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Condenses the marketing nav once the page scrolls: a slightly tighter bar
 * that picks up a light blur and a very soft shadow. Warm white rather than
 * black — a solid dark bar would fight the light page beneath it.
 * Purely presentational; auth-aware content comes from the server component.
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
        "fixed inset-x-0 top-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-[var(--mkt-line)] bg-[color-mix(in_srgb,var(--mkt-page)_88%,transparent)] shadow-[0_1px_16px_rgba(28,31,29,0.06)] backdrop-blur-xl"
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
    </header>
  );
}
