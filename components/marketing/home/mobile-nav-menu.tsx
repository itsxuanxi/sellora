"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

/**
 * Mobile navigation.
 *
 * The previous navbar simply hid its links below `md`, leaving phone visitors
 * with no way to reach any section. This is a plain disclosure menu rather
 * than a modal: it closes on Escape, on outside click, and on navigation, and
 * returns focus to the trigger so keyboard users are not stranded.
 */
export function MobileNavMenu({
  links,
  appHref,
  signedIn,
}: {
  links: { href: string; label: string }[];
  appHref: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(t) &&
        !triggerRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-9 items-center justify-center rounded-full border border-white/[0.12] text-neutral-200 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:bg-white/[0.10]"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full border-b border-white/[0.08] bg-[#09090B]/98 px-5 pb-6 pt-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          <nav aria-label="Main">
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded border-b border-white/[0.06] py-3.5 text-[15px] text-neutral-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={appHref}
                  onClick={() => setOpen(false)}
                  className="block rounded py-3.5 text-[15px] text-neutral-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                >
                  {signedIn ? "Dashboard" : "Sign in"}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
