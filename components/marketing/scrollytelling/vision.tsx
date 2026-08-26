"use client";

import { useLayoutEffect, useRef } from "react";
import { ensureGsap, gsap, safeRevert } from "@/components/marketing/gsap-config";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * A short, spacious manifesto beat between the hero and the first cinematic
 * chapter — scroll-scrubbed scale + opacity, not a one-shot fade, so it
 * still feels tied to the scrollbar rather than "playing" on arrival.
 */
export function Vision() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    ensureGsap();
    const section = sectionRef.current;
    const text = textRef.current;
    if (!section || !text) return;

    if (prefersReducedMotion()) {
      gsap.set(text, { opacity: 1, scale: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(text, { opacity: 0.15, scale: 0.94, transformOrigin: "50% 50%" });
      gsap.to(text, {
        opacity: 1,
        scale: 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top 85%",
          end: "top 25%",
          scrub: true,
        },
      });
    }, section);

    return () => safeRevert(ctx);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative border-t border-white/[0.06] bg-[#08090c] px-5 py-32 md:px-8 md:py-48"
    >
      <p
        ref={textRef}
        className="mx-auto max-w-4xl text-balance text-center text-3xl font-light leading-[1.3] tracking-tight text-neutral-200 md:text-5xl"
      >
        Every B2B pipeline leaks the same way — in the hours nobody&apos;s
        watching. Sellora is the layer that never clocks out: one brain,
        six agents, working every visitor until they&apos;re a meeting on
        your calendar.
      </p>
    </section>
  );
}
