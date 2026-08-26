"use client";

import { useLayoutEffect, useRef } from "react";
import {
  Bot,
  CalendarCheck2,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  UserCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ensureGsap, gsap, safeRevert } from "@/components/marketing/gsap-config";
import { prefersReducedMotion, isMobileViewport } from "@/lib/motion";
import { SectionLabel } from "@/components/marketing/section";

type Step = { icon: LucideIcon; label: string; body: string };

const STEPS: Step[] = [
  { icon: UserRound, label: "Visitor arrives", body: "Someone lands on your site — from an ad, a search, a cold email link." },
  { icon: MessageCircle, label: "Sellora starts the conversation", body: "The chat agent greets them and answers questions using your product knowledge." },
  { icon: Sparkles, label: "Buying intent is detected", body: "Behavior and language get read in real time — this isn't a browser, it's a buyer." },
  { icon: UserCheck, label: "Lead is qualified", body: "Budget, need, and timing get scored automatically from what they say and do." },
  { icon: CalendarCheck2, label: "Meeting is booked", body: "A qualified lead gets a calendar link on the spot — no back-and-forth." },
  { icon: RefreshCcw, label: "CRM is updated", body: "Contact, notes, and stage sync to your CRM automatically. Zero data entry." },
  { icon: Bot, label: "Sales rep receives the opportunity", body: "Your rep opens a fully-briefed, closed-won-shaped opportunity — ready to close." },
];

const VB_W = 1000;
const VB_H = 260;

export function PipelineStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const segRefs = useRef<(SVGLineElement | null)[]>([]);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const iconWrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const signalRef = useRef<SVGCircleElement>(null);
  const wonGlowRef = useRef<SVGCircleElement>(null);

  useLayoutEffect(() => {
    ensureGsap();
    const section = sectionRef.current;
    if (!section) return;

    const reduced = prefersReducedMotion();
    const mobile = isMobileViewport();

    const n = STEPS.length;
    const positions = Array.from({ length: n }, (_, i) => ({
      x: 40 + ((VB_W - 80) / (n - 1)) * i,
      y: VB_H / 2,
    }));

    if (reduced) {
      gsap.set(segRefs.current, { strokeDashoffset: 0 });
      gsap.set(nodeRefs.current, { opacity: 1, scale: 1 });
      gsap.set(signalRef.current, { opacity: 0 });
      gsap.set(wonGlowRef.current, { opacity: 1, scale: 1 });
      textRefs.current.forEach((el, i) => gsap.set(el, { opacity: i === n - 1 ? 1 : 0 }));
      return;
    }

    const ctx = gsap.context(() => {
      const stepPx = mobile ? 300 : 420;
      const totalPx = stepPx * (n - 1) + (mobile ? 200 : 300); // ~450vh at desktop

      segRefs.current.forEach((el) => {
        if (!el) return;
        const len = (VB_W - 80) / (n - 1);
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
      });

      gsap.set(nodeRefs.current, { opacity: 0.25, scale: 0.7, transformOrigin: "50% 50%" });
      gsap.set(signalRef.current, { opacity: 0 });
      gsap.set(wonGlowRef.current, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" });
      textRefs.current.forEach((el, i) => gsap.set(el, { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 12 }));
      iconWrapRefs.current.forEach((el, i) => gsap.set(el, { opacity: i === 0 ? 1 : 0.35, scale: i === 0 ? 1 : 0.85 }));

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

      // first node lights up immediately; the signal appears and starts riding
      tl.to(nodeRefs.current[0], { opacity: 1, scale: 1, duration: 0.3 }, 0);
      tl.to(signalRef.current, { opacity: 1, duration: 0.15 }, 0);

      // ONE continuous signal travels the whole path — a single shot, not
      // six separate cuts — its position is a pure function of `state.t`
      // across the entire timeline, so scrubbing up retraces the same path.
      const travel = { t: 0 };
      tl.to(
        travel,
        {
          t: 1,
          duration: n - 1,
          onUpdate: () => {
            const seg = Math.min(n - 2, Math.floor(travel.t * (n - 1)));
            const local = travel.t * (n - 1) - seg;
            const a = positions[seg];
            const b = positions[seg + 1];
            const x = a.x + (b.x - a.x) * local;
            const y = a.y + (b.y - a.y) * local;
            signalRef.current?.setAttribute("cx", `${x}`);
            signalRef.current?.setAttribute("cy", `${y}`);
          },
        },
        0
      );

      STEPS.forEach((_, i) => {
        const start = i;
        if (i < n - 1) {
          const seg = segRefs.current[i];
          tl.to(seg, { strokeDashoffset: 0, duration: 0.6 }, start + 0.15);
          tl.to(nodeRefs.current[i + 1], { opacity: 1, scale: 1, duration: 0.3 }, start + 0.65);
          tl.to(iconWrapRefs.current[i], { opacity: 0.35, scale: 0.85, duration: 0.2 }, start + 0.65);
          tl.to(iconWrapRefs.current[i + 1], { opacity: 1, scale: 1, duration: 0.2 }, start + 0.75);
        }

        tl.to(textRefs.current[i], { opacity: 1, y: 0, duration: 0.3 }, start + 0.1);
        if (i < n - 1) {
          tl.to(textRefs.current[i], { opacity: 0, y: -12, duration: 0.25 }, start + 0.85);
        }
      });

      // closed-won: the final node blooms into a sustained glow
      tl.to(signalRef.current, { opacity: 0, duration: 0.15 }, n - 1.15);
      tl.to(wonGlowRef.current, { opacity: 0.9, scale: 1, duration: 0.3 }, n - 1.1);
    }, section);

    return () => safeRevert(ctx);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex h-svh flex-col justify-center overflow-hidden border-t border-white/[0.06] bg-[#08090c] px-5 py-16 md:px-8"
    >
      <div className="mx-auto w-full max-w-6xl">
        <SectionLabel number="02" label="Live pipeline, start to close" />

        {/* step icon rail */}
        <div className="mt-10 flex items-center justify-between gap-1">
          {STEPS.map((step, i) => (
            <div
              key={step.label}
              ref={(el) => {
                iconWrapRefs.current[i] = el;
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-violet-300 md:size-12"
            >
              <step.icon className="size-3.5 md:size-5" />
            </div>
          ))}
        </div>

        {/* connecting line + the one continuous traveling signal */}
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="mt-2 h-16 w-full md:h-20" preserveAspectRatio="none" aria-hidden>
          {STEPS.slice(0, -1).map((step, i) => {
            const x1 = 40 + ((VB_W - 80) / (STEPS.length - 1)) * i;
            const x2 = 40 + ((VB_W - 80) / (STEPS.length - 1)) * (i + 1);
            const y = VB_H / 2;
            return (
              <line
                key={step.label}
                ref={(el) => {
                  segRefs.current[i] = el;
                }}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke="rgba(180,160,255,0.5)"
                strokeWidth={2}
              />
            );
          })}
          {STEPS.map((step, i) => {
            const x = 40 + ((VB_W - 80) / (STEPS.length - 1)) * i;
            return (
              <g key={step.label} ref={(el) => {
                nodeRefs.current[i] = el;
              }} style={{ transformOrigin: `${x}px ${VB_H / 2}px` }}>
                <circle cx={x} cy={VB_H / 2} r={7} fill="rgba(224,214,255,0.95)" />
              </g>
            );
          })}
          <circle ref={signalRef} cx={40} cy={VB_H / 2} r={6} fill="rgba(196,181,253,1)" />
          <circle
            ref={wonGlowRef}
            cx={40 + (VB_W - 80)}
            cy={VB_H / 2}
            r={22}
            fill="rgba(103,232,169,0.5)"
          />
        </svg>

        {/* crossfading status copy */}
        <div className="relative mt-6 h-28 md:h-24">
          {STEPS.map((step, i) => (
            <div key={step.label} ref={(el) => {
              textRefs.current[i] = el;
            }} className="absolute inset-0">
              <h3 className="text-2xl font-light tracking-tight text-white md:text-4xl">{step.label}</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-400 md:text-base">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
