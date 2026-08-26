"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { isClerkEnabled } from "@/lib/flags";
import { ensureGsap, gsap, ScrollTrigger, safeRevert } from "@/components/marketing/gsap-config";
import { prefersReducedMotion } from "@/lib/motion";
import { AICoreScene, type AICoreHandle } from "@/components/marketing/scrollytelling/ai-core-scene";

/**
 * Act I — the cinematic hero. A single 400vh pinned scene: the camera dollies
 * from a distant, dark signal all the way through the AI core into the
 * neural network beneath it, and the copy is choreographed against the same
 * scroll-bound progress value in four beats (0–20 / 20–45 / 45–70 / 70–100%)
 * exactly as scripted. Nothing here plays on its own — every visual change
 * is a direct function of ScrollTrigger's `progress`, so scrolling up
 * reverses the whole shot precisely.
 */
export function CinematicHero() {
  const startHref = isClerkEnabled ? "/sign-up" : "/sign-in";
  const sectionRef = useRef<HTMLElement>(null);
  const coreHandle = useRef<AICoreHandle | null>(null);

  const chipRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const signalLabelRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    ensureGsap();
    const section = sectionRef.current;
    if (!section) return;

    if (prefersReducedMotion()) {
      gsap.set([chipRef.current, headlineRef.current, subRef.current, ctaRef.current], {
        opacity: 1,
        y: 0,
      });
      gsap.set(signalLabelRef.current, { opacity: 0 });
      coreHandle.current?.setProgress(0.3);
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(chipRef.current, { opacity: 0, y: 10 });
      gsap.set(signalLabelRef.current, { opacity: 1 });
      gsap.set(headlineRef.current, { opacity: 0, y: 16 });
      gsap.set(subRef.current, { opacity: 0, y: 12 });
      gsap.set(ctaRef.current, { opacity: 0, y: 12 });

      const totalPx = window.innerHeight * 4; // ~400vh

      // A plain, un-triggered timeline we scrub by hand from the single pin's
      // onUpdate — avoids two independent ScrollTriggers fighting over the
      // same pinned trigger element's recalculated bounds.
      const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });

      const st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: `+=${totalPx}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          coreHandle.current?.setProgress(self.progress);
          tl.progress(self.progress);
        },
      });

      // 0–20%: a faint signal in the dark; logo/headline slowly resolve
      tl.to(signalLabelRef.current, { opacity: 0, duration: 0.12 }, 0.08);
      tl.to(chipRef.current, { opacity: 1, y: 0, duration: 0.16 }, 0.02);
      tl.to(headlineRef.current, { opacity: 1, y: 0, duration: 0.18 }, 0.04);

      // 20–45%: subheadline arrives as particles converge on the core
      tl.to(subRef.current, { opacity: 1, y: 0, duration: 0.18 }, 0.22);
      tl.to(ctaRef.current, { opacity: 1, y: 0, duration: 0.18 }, 0.3);

      // 45–70%: camera nears the core; headline recedes as rings light up
      tl.to(
        headlineRef.current,
        { opacity: 0.25, y: -14, filter: "blur(2px)", duration: 0.22 },
        0.48
      );
      tl.to(subRef.current, { opacity: 0.2, duration: 0.2 }, 0.5);
      tl.to(ctaRef.current, { opacity: 0.15, duration: 0.2 }, 0.5);

      // 70–100%: pass through the core into the neural network, chip fades last
      tl.to(chipRef.current, { opacity: 0, duration: 0.18 }, 0.74);

      void st;
    }, section);

    return () => safeRevert(ctx);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex h-svh flex-col justify-center overflow-hidden bg-[#020203] px-5 md:px-8"
    >
      <AICoreScene handleRef={coreHandle} />

      {/* vignette + grain for filmic depth, always above the WebGL layer */}
      <div
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_85%_70%_at_50%_40%,transparent_55%,rgba(0,0,0,0.6)_100%)]"
        aria-hidden
      />
      <div
        className="anim-grain bg-grain pointer-events-none absolute -inset-8 opacity-[0.03] mix-blend-overlay"
        aria-hidden
      />

      <p
        ref={signalLabelRef}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[11px] tracking-[0.3em] text-violet-200/70"
      >
        · SIGNAL DETECTED ·
      </p>

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="max-w-xl">
          <div
            ref={chipRef}
            className="mb-8 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-neutral-300"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-violet-400 [animation:ping-ring_2s_ease-out_infinite]" />
              <span className="relative inline-flex size-1.5 rounded-full bg-violet-400" />
            </span>
            AI revenue intelligence for B2B sales
          </div>

          <h1
            ref={headlineRef}
            className="text-balance text-5xl font-light leading-[1.02] tracking-tight md:text-7xl"
          >
            Stop losing deals
            <br />
            <span className="bg-gradient-to-r from-white to-violet-300 bg-clip-text text-transparent">
              you should have won.
            </span>
          </h1>

          <p
            ref={subRef}
            className="mt-8 max-w-md text-pretty text-lg leading-relaxed text-neutral-500"
          >
            Sellora detects buying signals, identifies revenue at risk, prioritizes
            your best opportunities, and tells your sales team exactly what to do
            next.
          </p>

          <div ref={ctaRef} className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href={startHref}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-black transition-all hover:bg-neutral-200"
            >
              Find my revenue leaks
              <ArrowUpRight className="size-4" />
            </Link>
            <Link
              href="mailto:hello@sellora.ai?subject=Sellora%20demo"
              className="inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-[15px] font-medium text-white transition-colors hover:bg-white/5"
            >
              See Sellora in action
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
