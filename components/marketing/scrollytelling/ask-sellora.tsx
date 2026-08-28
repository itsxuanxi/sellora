"use client";

import { useLayoutEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { ensureGsap, gsap, safeRevert } from "@/components/marketing/gsap-config";
import { prefersReducedMotion, isMobileViewport } from "@/lib/motion";
import { SectionLabel } from "@/components/marketing/section";

type Account = { name: string; score: number; x: number; y: number };

const ACCOUNTS: Account[] = [
  { name: "Cloudmint", score: 96, x: 18, y: 28 },
  { name: "Brightcart", score: 91, x: 78, y: 62 },
  { name: "Ledgerly", score: 87, x: 32, y: 78 },
];

// faint ambient nodes scattered behind the terminal — deterministic, not
// random-on-every-render, so SSR/CSR markup matches. Kept sparse on purpose:
// depth cue, not a second thing competing for attention.
const AMBIENT = Array.from({ length: 11 }, (_, i) => ({
  x: (i * 137) % 100,
  y: (i * 71) % 100,
}));

/**
 * Act V — "Ask Selryn": a floating AI terminal with a light 3D tilt,
 * scroll-scrubbed through a scripted exchange. Each ranked account lights up
 * a matching node in the network behind the terminal and draws a line to it,
 * with its intent score counting up — all bound to progress, reversible.
 */
export function AskSelryn() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLParagraphElement>(null);
  const answerRef = useRef<HTMLParagraphElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scoreRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  useLayoutEffect(() => {
    ensureGsap();
    const section = sectionRef.current;
    if (!section) return;

    const reduced = prefersReducedMotion();
    const mobile = isMobileViewport();

    if (reduced) {
      gsap.set(questionRef.current, { opacity: 1 });
      gsap.set(answerRef.current, { opacity: 1 });
      gsap.set(rowRefs.current, { opacity: 1, x: 0 });
      gsap.set(nodeRefs.current, { opacity: 1, scale: 1 });
      gsap.set(lineRefs.current, { opacity: 0.5 });
      ACCOUNTS.forEach((a, i) => {
        const el = scoreRefs.current[i];
        if (el) el.textContent = `${a.score}%`;
      });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(questionRef.current, { opacity: 0, y: 8 });
      gsap.set(answerRef.current, { opacity: 0, y: 8 });
      gsap.set(rowRefs.current, { opacity: 0, x: -10 });
      gsap.set(nodeRefs.current, { opacity: 0.15, scale: 0.7, transformOrigin: "50% 50%" });
      gsap.set(lineRefs.current, { opacity: 0 });

      const totalPx = window.innerHeight * (mobile ? 3 : 3.6);
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: `+=${totalPx}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // subtle, continuous spatial drift of the terminal itself
      tl.fromTo(
        cardRef.current,
        { rotateY: -7, rotateX: 5, y: 12 },
        { rotateY: 4, rotateX: -3, y: -12, duration: 1 },
        0
      );

      tl.to(questionRef.current, { opacity: 1, y: 0, duration: 0.12 }, 0.05);
      tl.to(answerRef.current, { opacity: 1, y: 0, duration: 0.12 }, 0.22);

      ACCOUNTS.forEach((account, i) => {
        const start = 0.36 + i * 0.18;
        tl.to(rowRefs.current[i], { opacity: 1, x: 0, duration: 0.14 }, start);
        tl.to(nodeRefs.current[i], { opacity: 1, scale: 1, duration: 0.14 }, start);
        tl.to(lineRefs.current[i], { opacity: 0.55, duration: 0.14 }, start);

        const counter = { v: 0 };
        tl.to(
          counter,
          {
            v: account.score,
            duration: 0.16,
            onUpdate: () => {
              const el = scoreRefs.current[i];
              if (el) el.textContent = `${Math.round(counter.v)}%`;
            },
          },
          start
        );
      });
    }, section);

    return () => safeRevert(ctx);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex h-svh flex-col justify-center overflow-hidden border-t border-white/[0.06] bg-[#020203] px-5 md:px-8"
    >
      <div
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(30,20,55,0.5),#020203_75%)]"
        aria-hidden
      />

      {/* ambient network + highlighted accounts — a full-bleed background
          layer, not a grid column, so it never competes with the terminal
          for height inside this pinned h-svh section */}
      <div className="absolute inset-0">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {AMBIENT.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={0.5} fill="rgba(255,255,255,0.12)" />
          ))}
          {ACCOUNTS.map((a, i) => (
            <line
              key={`line-${a.name}`}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              x1={a.x}
              y1={a.y}
              x2={50}
              y2={50}
              stroke="rgba(196,181,253,0.55)"
              strokeWidth={0.25}
            />
          ))}
        </svg>
        {ACCOUNTS.map((a, i) => (
          <span
            key={a.name}
            ref={(el) => {
              nodeRefs.current[i] = el;
            }}
            className="absolute flex size-2.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-300 shadow-[0_0_16px_4px_rgba(196,181,253,0.55)]"
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
          />
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="mb-8 flex justify-center md:mb-10 md:justify-start">
          <SectionLabel number="04" label="Ask Selryn" />
        </div>

        {/* the floating terminal */}
        <div className="flex justify-center" style={{ perspective: 1200 }}>
          <div
            ref={cardRef}
            className="w-full max-w-md rounded-none border border-white/10 bg-[#020203]/80 p-6 shadow-[0_40px_100px_rgba(0,0,0,0.6)] backdrop-blur-md md:p-8"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-neutral-500">
              <Sparkles className="size-3.5 text-violet-300" />
              Selryn terminal
            </div>

            <p ref={questionRef} className="text-sm text-neutral-400">
              <span className="text-neutral-500">User —</span> Which accounts
              should my team call first today?
            </p>

            <p ref={answerRef} className="mt-4 text-2xl font-light tracking-tight text-white md:text-3xl">
              Ranked 14 accounts by intent.
            </p>

            <div className="mt-6 space-y-3 border-t border-white/[0.08] pt-6">
              {ACCOUNTS.map((account, i) => (
                <div
                  key={account.name}
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  className="flex items-center justify-between border-b border-white/[0.06] pb-3 last:border-b-0 last:pb-0"
                >
                  <span className="text-sm text-neutral-300">
                    <span className="mr-3 font-mono text-xs text-neutral-600">
                      0{i + 1}
                    </span>
                    {account.name}
                  </span>
                  <span
                    ref={(el) => {
                      scoreRefs.current[i] = el;
                    }}
                    className="font-mono text-sm text-violet-300"
                  >
                    0%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
