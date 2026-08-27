import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignalField } from "@/components/marketing/home/signal-field";
import { HeroDemo } from "@/components/marketing/home/hero-demo";

/**
 * Screen 1 — "What is Sellora, and what does it actually do?"
 *
 * Warm white, with two very low-opacity radial washes purely for depth. The
 * only saturated colour in the headline is the closing phrase; a fully
 * gradient-filled heading would read as a consumer AI landing page rather
 * than enterprise software.
 *
 * On mobile the copy and CTAs come first and the demo follows, and the
 * viewport-height constraint is dropped so nothing is crammed.
 *
 * min-w-0 on both grid columns is load-bearing: grid items default to
 * min-width:auto, so the demo's nowrap tab row would otherwise stretch the
 * grid past the viewport on small screens.
 */
export function Hero({ startHref }: { startHref: string }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--mkt-line)] px-5 pb-16 pt-24 md:px-8 md:pb-20 md:pt-28 lg:flex lg:min-h-[calc(100svh-4rem)] lg:items-center lg:py-20">
      <SignalField className="opacity-70" />
      {/* Faint colour for spatial depth only — never a glow. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_55%_100%_at_75%_0%,rgba(103,87,229,0.07),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[380px] bg-[radial-gradient(ellipse_50%_100%_at_15%_100%,rgba(23,107,77,0.045),transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-14">
        {/* ── Fixed copy: never changes with the carousel ── */}
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-brand-deep)]">
            AI revenue intelligence for B2B sales
          </p>

          <h1 className="mt-5 text-balance text-[2.6rem] font-medium leading-[1.06] tracking-tight text-[var(--mkt-ink)] sm:text-5xl lg:text-[4rem] xl:text-[4.4rem]">
            Turn every sales signal into
            <span className="text-[var(--mkt-brand-deep)]">
              {" "}
              the next best revenue action.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-pretty text-[17px] leading-relaxed text-[var(--mkt-muted)]">
            Sellora learns which signals matter, recommends the action most
            likely to move each deal forward, and connects every decision to
            pipeline and revenue outcomes.
          </p>

          {/* Detect → Decide → Act → Learn. The loop is the product, so it is
              named on the hero rather than buried in a features grid. */}
          <ol className="mt-7 flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {["Detect", "Decide", "Act", "Learn"].map((step, i) => (
              <li key={step} className="flex items-center gap-1.5">
                <span className="rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-3 py-1 text-[13px] font-medium text-[var(--mkt-ink)]">
                  {step}
                </span>
                {i < 3 && (
                  <span className="text-[var(--mkt-line)]" aria-hidden>
                    &rarr;
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="mailto:hello@sellora.ai?subject=Sellora%20demo"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-[var(--mkt-ink)] px-6 text-[15px] font-medium text-[var(--mkt-page)] transition-colors hover:bg-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)] active:bg-black"
            >
              Book a demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={startHref}
              className="inline-flex h-12 items-center rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-6 text-[15px] font-medium text-[var(--mkt-ink)] transition-colors hover:border-[var(--mkt-brand)] hover:text-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)] active:bg-[var(--mkt-surface-2)]"
            >
              Start free trial
            </Link>
          </div>

          {/* Each is true of the product as built: Sellora is a separate layer
              from the CRM, nothing sends without approval, and no model is
              trained on customer data. */}
          <p className="mt-7 text-[13px] leading-relaxed text-[var(--mkt-muted)]">
            Evidence behind every recommendation
            <span className="mx-2 text-[var(--mkt-line)]" aria-hidden>
              ·
            </span>
            Human-controlled actions
            <span className="mx-2 text-[var(--mkt-line)]" aria-hidden>
              ·
            </span>
            Your data stays yours
          </p>
        </div>

        {/* ── Rotating product surface ── */}
        <div className="relative min-w-0 lg:-mr-4 xl:-mr-10">
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}
