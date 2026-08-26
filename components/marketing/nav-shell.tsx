"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Condenses the marketing nav once the page scrolls — a tighter bar with a
 * stronger blur/shadow, echoing the minimal floating nav on cinematic
 * one-pagers. Purely presentational; auth-aware content is passed as
 * children from the server component.
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
          ? "border-white/[0.08] bg-[#09090B]/85 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          : "border-white/[0.04] bg-[#09090B]/40 backdrop-blur-md"
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
