import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * Minimal footer on the warm-white surface. The redesign puts everything a
 * visitor needs into three screens, so this is navigation of last resort.
 */
const LINKS = [
  { label: "Product", href: "/#how-it-works" },
  { label: "Try Sellora", href: "/demo" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Security", href: "/#how-it-works" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "mailto:hello@sellora.ai" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--mkt-line)] bg-[var(--mkt-page)] px-5 py-10 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Logo />

        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="rounded text-sm text-[var(--mkt-muted)] transition-colors hover:text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <span className="text-xs text-[var(--mkt-muted)]">
          © {new Date().getFullYear()} Sellora
        </span>
      </div>
    </footer>
  );
}
