import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * Minimal footer. The redesign puts everything a visitor needs into three
 * screens, so the footer is navigation of last resort rather than a sitemap.
 *
 * Security points at the trust block inside screen 2 — real on-page content.
 * Privacy and Terms are dedicated routes carrying honest placeholders that say
 * they are in preparation, rather than fabricated legal text.
 */
const LINKS = [
  { label: "Product", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Security", href: "/#how-it-works" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "mailto:hello@sellora.ai" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] px-5 py-10 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Logo onDark />

        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="rounded text-sm text-neutral-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <span className="text-xs text-neutral-400">
          © {new Date().getFullYear()} Sellora
        </span>
      </div>
    </footer>
  );
}
