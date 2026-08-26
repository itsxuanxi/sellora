import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavShell } from "@/components/marketing/nav-shell";
import { MobileNavMenu } from "@/components/marketing/home/mobile-nav-menu";
import { getAuthState, isClerkEnabled } from "@/lib/auth";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#solutions", label: "Solutions" },
  { href: "#pricing", label: "Pricing" },
];

export async function MarketingNavbar() {
  const { signedIn } = await getAuthState();
  const appHref = signedIn ? "/dashboard" : "/sign-in";
  void isClerkEnabled;

  return (
    <NavShell>
      <Logo onDark />

      <div className="hidden items-center gap-8 md:flex">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded text-sm text-neutral-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#09090B]"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href={appHref}
          className="hidden rounded px-2 py-1 text-sm text-neutral-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] sm:block"
        >
          {signedIn ? "Dashboard" : "Sign in"}
        </Link>
        <Link
          href="mailto:hello@sellora.ai?subject=Sellora%20demo"
          className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:bg-neutral-300"
        >
          Book a demo
        </Link>
        <MobileNavMenu links={LINKS} appHref={appHref} signedIn={signedIn} />
      </div>
    </NavShell>
  );
}
