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
        className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--mkt-line)] text-[var(--mkt-ink)] transition-colors hover:bg-[var(--mkt-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)] active:bg-[var(--mkt-line)]"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full border-b border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-5 pb-6 pt-2 shadow-[0_16px_40px_rgba(28,31,29,0.10)]"
        >
          <nav aria-label="Main">
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded border-b border-[var(--mkt-line)] py-3.5 text-[15px] text-[var(--mkt-ink)] transition-colors hover:text-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={appHref}
                  onClick={() => setOpen(false)}
                  className="block rounded py-3.5 text-[15px] text-[var(--mkt-ink)] transition-colors hover:text-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)]"
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
