import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { isClerkEnabled } from "@/lib/flags";

export function FinalCta() {
  const startHref = isClerkEnabled ? "/sign-up" : "/sign-in";
  return (
    <section className="relative isolate overflow-hidden border-t border-white/[0.06] px-5 py-32 md:px-8 md:py-40">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_70%_at_50%_100%,rgba(139,92,246,0.2),transparent_70%)]"
        aria-hidden
      />
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance text-6xl font-light leading-[1.02] tracking-tight md:text-8xl">
          Put your sales layer{" "}
          <span className="bg-gradient-to-r from-white to-violet-300 bg-clip-text text-transparent">
            on autopilot.
          </span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-400">
          See Selryn engage, qualify, and book on your own pipeline. Set up
          takes minutes.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href="mailto:itsxuanxi8@icloud.com?subject=Selryn%20demo"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-black transition-all hover:bg-neutral-200"
          >
            Book a Demo
            <ArrowUpRight className="size-4" />
          </Link>
          <Link
            href={startHref}
            className="inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-[15px] font-medium text-white transition-colors hover:bg-white/5"
          >
            Start free
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
