import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavShell } from "@/components/marketing/nav-shell";
import { MobileNavMenu } from "@/components/marketing/home/mobile-nav-menu";
import { NavDemoCta } from "@/components/marketing/demo-cta";
import { getAuthState, isClerkEnabled } from "@/lib/auth";

// Three screens, so three destinations. Anchors must match section ids that
// still exist after the consolidation.
const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/demo", label: "Try Sellora" },
];

/**
 * The mobile sheet has no CTA button of its own, so it gets Book a demo as a
 * list entry. Desktop must not: it already renders NavDemoCta beside these.
 */
const MOBILE_LINKS = [...LINKS, { href: "/request-demo", label: "Book a demo" }];

export async function MarketingNavbar() {
  const { signedIn } = await getAuthState();
  const appHref = signedIn ? "/dashboard" : "/sign-in";
  void isClerkEnabled;

  return (
    <NavShell>
      <Logo />

      <div className="hidden items-center gap-8 md:flex">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded text-sm text-[var(--mkt-ink)] transition-colors hover:text-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--mkt-page)]"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href={appHref}
          className="hidden rounded px-2 py-1 text-sm text-[var(--mkt-muted)] transition-colors hover:text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)] sm:block"
        >
          {signedIn ? "Dashboard" : "Sign in"}
        </Link>
        <Link
          href="/demo"
          className="hidden rounded px-2 py-1 text-sm text-[var(--mkt-muted)] transition-colors hover:text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)] md:block"
        >
          Try Sellora
        </Link>
        <NavDemoCta />
        <MobileNavMenu links={MOBILE_LINKS} appHref={appHref} signedIn={signedIn} />
      </div>
    </NavShell>
  );
}
