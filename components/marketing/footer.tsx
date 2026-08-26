import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * §12 — footer.
 *
 * Security points at the on-page trust section, which is real content. Privacy
 * and Terms point at dedicated routes; those pages are honest placeholders
 * that say they are in preparation rather than fabricated legal text, since
 * inventing a privacy policy is worse than admitting one is pending.
 */

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Product", href: "#product" },
      { label: "How it works", href: "#how-it-works" },
      { label: "See it work", href: "#demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Solutions", href: "#solutions" },
      { label: "Pricing", href: "#pricing" },
      { label: "Security", href: "#security" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Contact", href: "mailto:hello@sellora.ai" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] px-5 py-16 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo onDark />
          <p className="max-w-xs text-sm leading-relaxed text-neutral-400">
            AI revenue intelligence for B2B sales. Find the opportunities you
            are missing, know who to contact, and act before revenue
            disappears.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
              {col.title}
            </h2>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="rounded text-sm text-neutral-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-neutral-400">
        <span>© {new Date().getFullYear()} Sellora</span>
        <span>AI revenue intelligence for B2B sales.</span>
      </div>
    </footer>
  );
}
