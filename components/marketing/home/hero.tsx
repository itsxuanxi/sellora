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
 * The demo is the evidence for the headline, so it takes the larger column.
 * On mobile the copy and the two buttons come first, the demo follows, and
 * the viewport-height constraint is dropped so nothing is crammed.
 *
 * min-w-0 on both grid columns is load-bearing: grid items default to
 * min-width:auto, so the demo's nowrap tab row would otherwise stretch the
 * grid past the viewport on small screens.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--mkt-line)] px-5 pb-20 pt-24 md:px-8 md:pb-24 md:pt-28 lg:flex lg:min-h-[calc(100svh-4rem)] lg:items-center lg:py-24">
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

      <div className="relative mx-auto grid w-full max-w-[1320px] items-center gap-14 lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] lg:gap-16">
        {/* ── The claim ── */}
        <div className="min-w-0 max-w-[540px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--mkt-brand-deep)]">
            AI revenue intelligence for B2B sales
          </p>

          <h1 className="mt-6 text-balance text-[2.75rem] font-medium leading-[1.04] tracking-[-0.02em] text-[var(--mkt-ink)] sm:text-[3.25rem] lg:text-[3.6rem] xl:text-[4rem]">
            Know which deals need attention
            <span className="text-[var(--mkt-brand-deep)]">
              {" "}
              — and what to do next.
            </span>
          </h1>

          <p className="mt-7 max-w-[30rem] text-pretty text-[17px] leading-[1.65] text-[var(--mkt-muted)]">
            Selryn turns CRM activity and buyer signals into prioritized revenue
            opportunities, explainable next actions, and measurable pipeline
            outcomes. Your team always keeps the final call.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
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
              person, and no model is trained on customer data. */}
          <p className="mt-8 text-[13.5px] leading-relaxed text-[var(--mkt-muted)]">
            Evidence behind every recommendation
            <span className="mx-2.5 text-[var(--mkt-line)]" aria-hidden>
              ·
            </span>
            Nothing sends without approval
            <span className="mx-2.5 text-[var(--mkt-line)]" aria-hidden>
              ·
            </span>
            Your data stays yours
          </p>
        </div>

        {/* ── The evidence ── */}
        <div className="relative min-w-0">
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}
