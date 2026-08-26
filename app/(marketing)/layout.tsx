import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";

/**
 * Marketing shell — light enterprise surface.
 *
 * `.mkt` carries the palette (see app/globals.css). The `dark` class and the
 * full-bleed near-black background that used to live here are gone: the page
 * is now warm white throughout, with exactly one dark band at the closing CTA.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mkt min-h-svh bg-[var(--mkt-page)] font-sans text-[var(--mkt-ink)] antialiased selection:bg-[var(--mkt-brand-wash)] selection:text-[var(--mkt-brand-deep)]">
      <SmoothScroll />
      <MarketingNavbar />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
