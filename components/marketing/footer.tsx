import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * Minimal footer on the warm-white surface. The redesign puts everything a
 * visitor needs into three screens, so this is navigation of last resort.
 */
const LINKS = [
  { label: "Product", href: "/#how-it-works" },
  { label: "Try the demo", href: "/demo" },
  { label: "Book a demo", href: "/request-demo" },
  { label: "Pricing", href: "/#pricing" },
  // Was "/#how-it-works", a marketing section with a one-paragraph note at the
  // bottom of it. A buyer following a link labelled Security expects a page
  // about security, and procurement expects to be able to send it to someone.
  { label: "Security", href: "/security" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  // Points at the form rather than a mailbox: the form routes somewhere and
  // asks the questions that make a reply useful. There is no brand mailbox
  // yet, and inventing hello@ would be a mailbox nobody reads.
  { label: "Contact", href: "/request-demo" },
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
          © {new Date().getFullYear()} Selryn
        </span>
      </div>
    </footer>
  );
}
