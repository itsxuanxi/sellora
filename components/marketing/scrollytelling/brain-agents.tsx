"use client";

import { useLayoutEffect, useRef } from "react";
import { AGENTS } from "@/lib/agents-data";
import { ensureGsap, gsap, safeRevert } from "@/components/marketing/gsap-config";
import { prefersReducedMotion, isMobileViewport } from "@/lib/motion";
import { SectionLabel } from "@/components/marketing/section";

const VB = 400;
const CENTER = VB / 2;
const RADIUS = 150;

// rounded to 2dp: server/client can otherwise disagree on the last bit of
// Math.cos/sin, which trips a React hydration mismatch on the SVG attrs
const round2 = (v: number) => Math.round(v * 100) / 100;

function polar(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return [round2(CENTER + r * Math.cos(rad)), round2(CENTER + r * Math.sin(rad))] as const;
}

/**
 * "One brain, six agents" — a pinned, scroll-scrubbed scene. The whole
 * timeline's progress is bound 1:1 to scroll position via ScrollTrigger's
 * `scrub`, so scrolling down plays it forward and scrolling up reverses it
 * exactly — there is no autoplay and no toggleActions.
 */
export function BrainAgents() {
  const sectionRef = useRef<HTMLElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const coreGlowRef = useRef<SVGCircleElement>(null);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const particleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    ensureGsap();
    const section = sectionRef.current;
    if (!section) return;

    const reduced = prefersReducedMotion();
    const mobile = isMobileViewport();

    // Static end-state for reduced motion: show everything settled, no pin.
    if (reduced) {
      gsap.set(coreRef.current, { scale: 1, opacity: 1 });
      gsap.set(lineRefs.current, { strokeDashoffset: 0 });
      gsap.set(nodeRefs.current, { opacity: 1, scale: 1 });
      gsap.set(particleRefs.current, { opacity: 0 });
      textRefs.current.forEach((el, i) => gsap.set(el, { opacity: i === AGENTS.length ? 1 : 0 }));
      return;
    }

    const ctx = gsap.context(() => {
      const steps = AGENTS.length; // 6
      const stepPx = mobile ? 340 : 480;
      const introPx = mobile ? 260 : 380;
      const totalPx = introPx + steps * stepPx;

      // Precompute per-agent line lengths for the dash-draw effect.
      const lineLengths = AGENTS.map((a) => {
        const [x, y] = polar(a.angle, RADIUS);
        return Math.hypot(x - CENTER, y - CENTER);
      });
      lineRefs.current.forEach((el, i) => {
        if (!el) return;
        el.style.strokeDasharray = `${lineLengths[i]}`;
        el.style.strokeDashoffset = `${lineLengths[i]}`;
      });

      gsap.set(coreRef.current, { scale: 0.25, opacity: 0, transformOrigin: "50% 50%" });
      gsap.set(coreGlowRef.current, { scale: 0.4, opacity: 0, transformOrigin: "50% 50%" });
      gsap.set(nodeRefs.current, { opacity: 0, scale: 0.6, transformOrigin: "50% 50%" });
      gsap.set(particleRefs.current, { opacity: 0 });
      // text[0] = intro copy, text[1..6] = per-agent copy
      gsap.set(textRefs.current[0], { opacity: 1, y: 0 });
      textRefs.current.slice(1).forEach((el) => gsap.set(el, { opacity: 0, y: 12 }));

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

      const introUnits = introPx / stepPx;

      // Intro: brain fades/scales in from the void.
      tl.to(coreGlowRef.current, { scale: 1, opacity: 0.9, duration: introUnits * 0.7 }, 0);
      tl.to(coreRef.current, { scale: 1, opacity: 1, duration: introUnits }, 0);
      tl.to(textRefs.current[0], { opacity: 1, duration: introUnits * 0.4 }, 0);
      tl.to(textRefs.current[0], { opacity: 0, y: -12, duration: introUnits * 0.3 }, introUnits * 0.7);

      AGENTS.forEach((_, i) => {
        const start = introUnits + i;
        const line = lineRefs.current[i];
        const node = nodeRefs.current[i];
        const particle = particleRefs.current[i];
        const [nx, ny] = polar(AGENTS[i].angle, RADIUS);

        // dim the previously-active node (or none, for i === 0)
        if (i > 0) {
          tl.to(nodeRefs.current[i - 1], { opacity: 0.35, scale: 0.85, duration: 0.2 }, start);
        }

        // draw the connecting line
        tl.to(line, { strokeDashoffset: 0, duration: 0.55 }, start);
        // node lights up
        tl.to(node, { opacity: 1, scale: 1, duration: 0.35 }, start + 0.3);
        // particle travels from core to node, then fades
        if (particle) {
          const state = { t: 0 };
          tl.to(
            state,
            {
              t: 1,
              duration: 0.4,
              onUpdate: () => {
                const x = CENTER + (nx - CENTER) * state.t;
                const y = CENTER + (ny - CENTER) * state.t;
                particle.setAttribute("cx", `${x}`);
                particle.setAttribute("cy", `${y}`);
              },
            },
            start + 0.35
          );
          tl.to(particle, { opacity: 1, duration: 0.08 }, start + 0.35);
          tl.to(particle, { opacity: 0, duration: 0.15 }, start + 0.68);
        }

        // swap left-panel copy
        tl.to(textRefs.current[i + 1], { opacity: 1, y: 0, duration: 0.3 }, start + 0.15);
        if (i < steps - 1) {
          tl.to(textRefs.current[i + 1], { opacity: 0, y: -12, duration: 0.25 }, start + 0.85);
        }
      });
    }, section);

    return () => safeRevert(ctx);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="brain"
      className="relative isolate flex h-svh flex-col justify-center overflow-hidden border-t border-white/[0.06] bg-[#08090c] px-5 md:px-8"
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-4 sm:gap-10">
        {/* left: crossfading narrative copy */}
        <div className="relative h-40 sm:h-56 md:h-64">
          <div ref={(el) => { textRefs.current[0] = el; }} className="absolute inset-0 flex flex-col justify-center">
            <div className="hidden sm:block">
              <SectionLabel number="01" label="One brain, six agents" />
            </div>
            <span className="font-mono text-xs text-violet-400/80 sm:hidden">01</span>
            <h2 className="mt-2 max-w-md text-balance text-2xl font-light leading-[1.1] tracking-tight sm:mt-6 sm:text-4xl md:text-5xl">
              One brain. Six agents.
            </h2>
          </div>
          {AGENTS.map((agent, i) => (
            <div
              key={agent.name}
              ref={(el) => { textRefs.current[i + 1] = el; }}
              className="absolute inset-0 flex flex-col justify-center"
            >
              <span className="font-mono text-xs text-violet-400/80 sm:text-sm">
                {agent.n} / 06
              </span>
              <h3 className="mt-2 text-2xl font-light tracking-tight text-white sm:mt-4 sm:text-4xl md:text-5xl">
                {agent.name}
              </h3>
            </div>
          ))}
        </div>

        {/* right: the brain + agent network */}
        <div className="relative mx-auto aspect-square w-full max-w-md">
          <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full overflow-visible" aria-hidden>
            <defs>
              <radialGradient id="brain-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(196,181,253,0.95)" />
                <stop offset="100%" stopColor="rgba(139,92,246,0.05)" />
              </radialGradient>
            </defs>

            {AGENTS.map((agent, i) => {
              const [x, y] = polar(agent.angle, RADIUS);
              return (
                <line
                  key={agent.name}
                  ref={(el) => { lineRefs.current[i] = el; }}
                  x1={CENTER}
                  y1={CENTER}
                  x2={x}
                  y2={y}
                  stroke="rgba(180,160,255,0.55)"
                  strokeWidth={1.5}
                />
              );
            })}

            <circle ref={coreGlowRef} cx={CENTER} cy={CENTER} r={90} fill="url(#brain-core)" />
            <circle ref={coreRef} cx={CENTER} cy={CENTER} r={44} fill="#0b0b12" stroke="rgba(196,181,253,0.8)" strokeWidth={1.5} />

            {AGENTS.map((agent, i) => (
              <circle
                key={`particle-${agent.name}`}
                ref={(el) => { particleRefs.current[i] = el; }}
                cx={CENTER}
                cy={CENTER}
                r={3.4}
                fill="rgba(224,214,255,0.95)"
              />
            ))}

            {AGENTS.map((agent, i) => {
              const [x, y] = polar(agent.angle, RADIUS);
              const below = Math.sin((agent.angle * Math.PI) / 180) >= 0;
              return (
                <g key={agent.name} ref={(el) => { nodeRefs.current[i] = el; }}>
                  <circle cx={x} cy={y} r={26} fill="#0b0b12" stroke="rgba(196,181,253,0.7)" strokeWidth={1.5} />
                  <circle cx={x} cy={y} r={4} fill="rgba(224,214,255,0.95)" />
                  <text
                    x={x}
                    y={y + (below ? 42 : -36)}
                    textAnchor="middle"
                    className="fill-neutral-300"
                    style={{ font: "500 11px var(--font-sans, sans-serif)" }}
                  >
                    {agent.name}
                  </text>
                  {/* the real result this agent just produced — the only
                      description text for this agent; the left panel keeps
                      just its name, so nothing is said twice */}
                  <text
                    x={x}
                    y={y + (below ? 56 : -22)}
                    textAnchor="middle"
                    className="fill-violet-300"
                    style={{ font: "500 9.5px var(--font-sans, sans-serif)" }}
                  >
                    {agent.result}
                  </text>
                </g>
              );
            })}
          </svg>
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium tracking-tight text-white">
            Selryn
          </span>
        </div>
      </div>
    </section>
  );
}
