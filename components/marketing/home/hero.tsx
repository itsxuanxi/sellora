import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignalField } from "@/components/marketing/home/signal-field";
import { HeroDemo } from "@/components/marketing/home/hero-demo";

/**
 * Screen 1 — "What is Sellora, and what does it actually do?"
 *
 * Sized to fill a laptop viewport without ever clipping the demo: the section
 * uses min-h with the nav height subtracted rather than a hard 100vh, and
 * drops that constraint below `lg` so the stacked mobile layout can grow
 * naturally instead of cramming.
 *
 * min-w-0 on both grid columns is load-bearing. Grid items default to
 * min-width:auto, so the demo's nowrap tab row would otherwise stretch the
 * grid past the viewport on mobile — and because this section clips overflow,
 * that failure is silent: the last tab simply disappears.
 */
export function Hero({ startHref }: { startHref: string }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/[0.06] px-5 pb-16 pt-24 md:px-8 md:pb-20 md:pt-28 lg:flex lg:min-h-[calc(100svh-4rem)] lg:items-center lg:py-20">
      <SignalField className="opacity-[0.55]" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(139,124,246,0.10),transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-14">
        {/* ── Fixed copy: never changes with the carousel ── */}
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-violet-300">
            AI revenue intelligence for B2B sales
          </p>

          <h1 className="mt-5 text-balance text-4xl font-medium leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
            Know which deals need attention&mdash;before they go cold.
          </h1>

          <p className="mt-5 text-pretty text-[17px] leading-relaxed text-neutral-300">
            Sellora monitors every opportunity, detects buying and risk signals,
            and tells your team exactly who to contact, why now, and what to do
            next.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="mailto:hello@sellora.ai?subject=Sellora%20demo"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-black transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:bg-neutral-300"
            >
              Book a demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={startHref}
              className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-[15px] font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:bg-white/[0.10]"
            >
              Start free
            </Link>
          </div>

          {/* Each of these three is true of the product as built: Sellora is a
              separate layer from the CRM, nothing sends without approval, and
              no model is trained on customer data. */}
          <p className="mt-6 text-[13px] leading-relaxed text-neutral-400">
            Works alongside your CRM
            <span className="mx-2 text-neutral-600" aria-hidden>
              ·
            </span>
            Human-controlled actions
            <span className="mx-2 text-neutral-600" aria-hidden>
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
