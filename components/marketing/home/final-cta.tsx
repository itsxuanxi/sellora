import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignalField } from "@/components/marketing/home/signal-field";
import { Reveal } from "@/components/marketing/section";

/**
 * §11 — the closing ask, framed as a business result rather than a product
 * feature. The signal texture returns here at low opacity to bookend the
 * hero, which is the only place it appears twice.
 */
export function FinalCta({ startHref }: { startHref: string }) {
  return (
    <section className="relative isolate overflow-hidden border-t border-white/[0.06] px-5 py-28 md:px-8 md:py-36">
      <SignalField className="opacity-40" density={0.00004} />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_70%_at_50%_50%,rgba(139,124,246,0.10),transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <Reveal>
          <h2 className="text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[3rem]">
            Find the revenue already hiding in your pipeline.
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-neutral-300">
            See which deals need attention, why they matter, and what your team
            should do next.
          </p>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="mailto:hello@sellora.ai?subject=Sellora%20demo"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-black transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:bg-neutral-300"
            >
              Book a demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={startHref}
              className="inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-[15px] font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:bg-white/[0.10]"
            >
              Start free
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
