import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroDemo } from "@/components/marketing/home/hero-demo";

/**
 * Screen 1 — the whole product argument, in one view.
 *
 * The layout is deliberately two things and no more: a single outcome-driven
 * claim on the left, and one full-size product surface on the right. An
 * earlier version added a four-chip process row and a third call to action,
 * which is how a hero stops being a claim and becomes a summary of a
 * brochure. What is left has room to breathe.
 *
 * The demo is the evidence for the headline, so it takes the larger column —
 * and from `lg` up it runs past the right edge of the viewport rather than
 * stopping at a centred container. A product surface that is visibly wider
 * than the window reads as a screenshot of something larger, cropped; the
 * same panel boxed inside a container reads as an illustration sized to fit
 * the marketing page. The crop is the claim.
 *
 * Implementation: above `lg` the grid drops the section's symmetric padding
 * and takes a left inset equal to what a centred 1320px container would have
 * had, with none on the right. So the copy column still lines up with the nav
 * and the footer, and only the panel breaks the margin.
 *
 * min-w-0 on both grid columns is load-bearing: grid items default to
 * min-width:auto, so the demo's nowrap tab row would otherwise stretch the
 * grid past the viewport on small screens.
 */
export function Hero() {
  return (
    <section
      id="product"
      className="relative isolate overflow-hidden border-b border-[var(--mkt-line)] pb-20 pt-28 md:pb-24 md:pt-32 lg:flex lg:min-h-[calc(100svh-6.5rem)] lg:items-center lg:py-24"
    >
      {/* Two very low-opacity washes, for depth only — never a glow. The page
          should read as paper with light on it, not as a gradient. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(ellipse_60%_100%_at_78%_0%,rgba(103,87,229,0.09),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_55%_100%_at_10%_100%,rgba(103,87,229,0.04),transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-[1320px] items-center gap-14 px-5 md:px-8 lg:mx-0 lg:max-w-none lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] lg:gap-14 lg:pl-[max(2rem,calc((100vw-1320px)/2))] lg:pr-0 xl:gap-16">
        {/* ── The claim ── */}
        <div className="min-w-0 max-w-[540px]">
          {/* The slot a funded company fills with an investor badge. Selryn has
              no investor to name, so it names the one thing a visitor can act
              on in the next ten seconds instead — and unlike a logo, it is a
              link that goes somewhere. */}
          <Link
            href="/demo"
            className="group inline-flex items-center gap-2 rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] py-1 pl-1 pr-3 text-[13px] text-[var(--mkt-muted)] shadow-[var(--mkt-shadow-card)] transition-colors hover:border-[var(--mkt-brand)]/40 hover:text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]"
          >
            <span className="shrink-0 whitespace-nowrap rounded-full bg-[var(--mkt-brand-wash)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mkt-brand-deep)]">
              Early access
            </span>
            Run the guided demo on a live deal
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          {/* Founder-led teams and lean sales teams are who we are chasing
              first, so they are named. Not a restriction: nothing in the
              product assumes SaaS, or a founder doing the selling. */}
          <p className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--mkt-brand-deep)]">
            For founder-led and small B2B sales teams
          </p>

          <h1 className="mt-3.5 text-balance text-[2.4rem] font-medium leading-[1.03] tracking-[-0.028em] text-[var(--mkt-ink)] sm:text-[3.2rem] sm:leading-[1.01] sm:tracking-[-0.032em] lg:text-[3.5rem] xl:text-[3.9rem]">
            Catch the deals slipping away after your
            <span className="text-[var(--mkt-brand-deep)]"> demos and proposals.</span>
          </h1>

          <p className="mt-7 max-w-[30rem] text-pretty text-[17px] leading-[1.6] text-[var(--mkt-muted)]">
            A demo goes well, the proposal goes out, and three weeks later
            nobody remembers who owes whom a reply. Selryn reads your deals and
            their email history, shows which ones have gone quiet and what the
            records say about why, tells you who to follow up today, and tracks
            what came back. It does not replace your CRM, and nothing reaches a
            customer without you approving it.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/request-demo"
              className="group inline-flex h-[52px] items-center gap-2 rounded-full bg-[var(--mkt-ink)] px-7 text-[15px] font-medium text-[var(--mkt-page)] transition-colors hover:bg-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)] active:bg-black"
            >
              Book a demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-[52px] items-center rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-7 text-[15px] font-medium text-[var(--mkt-ink)] transition-colors hover:border-[var(--mkt-brand)] hover:text-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)] active:bg-[var(--mkt-surface-2)]"
            >
              Try Selryn
            </Link>
          </div>

          {/* Each clause is true of the product as built: recommendations
              carry their evidence, nothing customer-facing sends without a
              person, and no model is trained on customer data.

              Set in the same monospace caps as the product's own field labels.
              A hero's last line is where a company usually puts its proof —
              customer counts, logos, funding. Selryn has none of those yet, so
              it states what it guarantees instead. That is a smaller claim,
              and it has the advantage of being true. */}
          <ul className="mt-10 flex flex-col items-start gap-y-2 border-t border-[var(--mkt-line)] pt-6 font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--mkt-muted)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
            {[
              "A reason on every recommendation",
              "Nothing sends without approval",
              "Never trained on your data",
            ].map((claim, i) => (
              <li key={claim} className="flex items-center gap-3">
                {/* Stacked on a phone, so the interpuncts would sit at the
                    start of lines two and three looking like stray bullets. */}
                {i > 0 && (
                  <span className="hidden text-[var(--mkt-line)] sm:inline" aria-hidden>
                    ·
                  </span>
                )}
                {claim}
              </li>
            ))}
          </ul>
        </div>

        {/* ── The evidence ── */}
        <div className="relative min-w-0">
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}
