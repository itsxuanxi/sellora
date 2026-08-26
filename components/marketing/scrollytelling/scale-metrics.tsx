"use client";

import { useLayoutEffect, useRef } from "react";
import { ensureGsap, gsap, ScrollTrigger, safeRevert } from "@/components/marketing/gsap-config";
import { prefersReducedMotion } from "@/lib/motion";
import { SectionLabel } from "@/components/marketing/section";
import {
  ScaleNetworkScene,
  type ScaleNetworkHandle,
} from "@/components/marketing/scrollytelling/scale-network-scene";

type Metric = { value: string; target?: number; label: string };

const METRICS: Metric[] = [
  { value: "24/7", label: "Pipeline coverage" },
  { value: "0", target: 6, label: "Autonomous agents" },
  { value: "<1s", label: "Response time" },
  { value: "0", target: 0, label: "Manual CRM updates" },
];

const CAPTIONS = [
  "One conversation.",
  "A hundred, running at once.",
  "Ten thousand, and counting.",
  "Your entire revenue pipeline.",
];

export function ScaleMetrics() {
  const sectionRef = useRef<HTMLElement>(null);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const captionRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const networkHandle = useRef<ScaleNetworkHandle | null>(null);

  useLayoutEffect(() => {
    ensureGsap();
    const section = sectionRef.current;
    if (!section) return;

    if (prefersReducedMotion()) {
      METRICS.forEach((m, i) => {
        const el = numberRefs.current[i];
        if (!el) return;
        el.textContent = m.target !== undefined ? `${m.target}` : m.value;
      });
      gsap.set(captionRefs.current[captionRefs.current.length - 1], { opacity: 1 });
      networkHandle.current?.setProgress(1);
      return;
    }

    const ctx = gsap.context(() => {
      captionRefs.current.forEach((el, i) => gsap.set(el, { opacity: i === 0 ? 1 : 0 }));

      const totalPx = window.innerHeight * 4.5;
      const state = { t: 0 };

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: `+=${totalPx}`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          state.t = self.progress;
          networkHandle.current?.setProgress(state.t);

          METRICS.forEach((m, i) => {
            const el = numberRefs.current[i];
            if (!el || m.target === undefined) return;
            el.textContent = `${Math.round(m.target * state.t)}`;
          });

          const step = Math.min(
            CAPTIONS.length - 1,
            Math.floor(state.t * CAPTIONS.length)
          );
          captionRefs.current.forEach((el, i) => {
            if (!el) return;
            gsap.to(el, { opacity: i === step ? 1 : 0, duration: 0.3, overwrite: "auto" });
          });
        },
      });
    }, section);

    return () => safeRevert(ctx);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex h-svh flex-col justify-center overflow-hidden border-t border-white/[0.06] bg-[#020203] px-5 md:px-8"
    >
      <ScaleNetworkScene handleRef={networkHandle} />
      <div
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_85%_70%_at_50%_50%,transparent_55%,rgba(0,0,0,0.6)_100%)]"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-4 sm:gap-14">
        <div>
          <div className="hidden sm:block">
            <SectionLabel number="03" label="Pipeline at scale" />
          </div>
          <span className="font-mono text-xs text-violet-400/80 sm:hidden">03</span>
          <h2 className="mt-2 max-w-md text-balance text-xl font-light leading-[1.1] tracking-tight sm:mt-6 sm:text-4xl md:text-5xl">
            Built to run your whole funnel, not a slice of it.
          </h2>

          <div className="relative mt-4 h-6 sm:mt-6 sm:h-7">
            {CAPTIONS.map((c, i) => (
              <span
                key={c}
                ref={(el) => {
                  captionRefs.current[i] = el;
                }}
                className="absolute inset-0 text-sm text-neutral-400 sm:text-base"
              >
                {c}
              </span>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 sm:mt-10 sm:gap-x-6 sm:gap-y-8">
            {METRICS.map((m, i) => (
              <div key={m.label}>
                <span
                  ref={(el) => {
                    numberRefs.current[i] = el;
                  }}
                  className="block text-lg font-medium tracking-tight text-white sm:text-4xl md:text-5xl"
                >
                  {m.value}
                </span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.1em] text-neutral-500 sm:mt-2 sm:text-xs sm:tracking-[0.16em]">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden />
      </div>
    </section>
  );
}
