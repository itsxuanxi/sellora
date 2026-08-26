"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { Reveal, Section, SectionLabel } from "@/components/marketing/section";
import { Panel } from "@/components/marketing/home/product-ui";
import { DEMO_DATA_NOTE, DEMO_DEALS } from "@/components/marketing/home/demo-data";
import { formatMoneyCompact } from "@/lib/revenue/money";

/**
 * §7 — the query surface.
 *
 * The question types itself once the section comes into view, then the ranked
 * answer resolves. That sequence is the point: it shows the shape of the
 * output — rank, company, expected revenue, evidence, risk, action — which is
 * what a buyer needs to judge whether the product is useful.
 *
 * There is no intermediate empty or zero state. Under reduced motion the
 * question and the full answer are simply present from the start.
 */

const QUESTION = "Which accounts should my team call first today?";

/**
 * The answer rows are derived from the same three deals the hero walked
 * through, so a visitor who watched the carousel sees the identical pipeline
 * here rather than a second, contradictory set of numbers.
 */
const RECOMMENDED_ACTIONS: Record<string, string> = {
  Cloudmint: "Send a stakeholder-specific follow-up",
  Brightcart: "Schedule technical validation",
  Ledgerly: "Re-open the conversation with a case study",
};

const ANSWERS = DEMO_DEALS.map((d) => ({
  rank: d.rank,
  company: d.company,
  expected: `${formatMoneyCompact(d.expected)} expected revenue`,
  evidence: d.signals,
  risk: d.readoutTone === "risk" ? d.status : null,
  action: RECOMMENDED_ACTIONS[d.company] ?? "Follow up today",
}));

export function AskSellora() {
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion: show the finished state, skip the sequence entirely.
    if (prefersReducedMotion()) {
      setTyped(QUESTION);
      setRevealed(ANSWERS.length);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();

        let i = 0;
        const type = setInterval(() => {
          i += 1;
          setTyped(QUESTION.slice(0, i));
          if (i >= QUESTION.length) {
            clearInterval(type);
            // Rows resolve one at a time, as a ranking would.
            ANSWERS.forEach((_, idx) =>
              setTimeout(() => setRevealed(idx + 1), 320 + idx * 260)
            );
          }
        }, 26);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const typing = typed.length > 0 && typed.length < QUESTION.length;

  return (
    <Section id="demo" className="bg-white/[0.012]" ref={ref}>
      <Reveal>
        <SectionLabel number="04" label="See it work" />
        <h2 className="mt-8 max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          Ask Sellora what deserves attention.
        </h2>
        <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-neutral-300">
          Every answer carries its evidence, so you can check the reasoning
          before you act on it.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mx-auto mt-14 max-w-3xl">
          <Panel
            label="Ask Sellora"
            meta={<span className="text-[11px] text-neutral-400">{DEMO_DATA_NOTE}</span>}
          >
            {/* ── Query ── */}
            <div className="flex items-start gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-5">
              <span className="mt-0.5 font-mono text-[13px] text-violet-300" aria-hidden>
                &gt;
              </span>
              <p className="min-h-[1.4em] text-[15px] leading-relaxed text-white">
                {typed}
                {typing && (
                  <span
                    className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-violet-300 [animation:caret-blink_1s_step-end_infinite]"
                    aria-hidden
                  />
                )}
              </p>
            </div>

            {/* ── Answer ── */}
            <ul className="divide-y divide-white/[0.06]">
              {ANSWERS.map((a, i) => (
                <li
                  key={a.company}
                  className={cn(
                    "px-4 py-4 transition-all duration-500 sm:px-5",
                    i < revealed
                      ? "translate-y-0 opacity-100"
                      : "translate-y-1.5 opacity-0"
                  )}
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[12px] tabular-nums text-violet-300">
                      {a.rank}
                    </span>
                    <span className="text-[15px] font-medium text-white">
                      {a.company}
                    </span>
                    <span className="ml-auto text-[13px] font-medium tabular-nums text-neutral-200">
                      {a.expected}
                    </span>
                  </div>

                  <p className="mt-1.5 pl-[2.1rem] text-[13px] text-neutral-300">
                    {a.evidence.join(" · ")}
                  </p>
                  {a.risk && (
                    <p className="mt-0.5 pl-[2.1rem] text-[13px] text-rose-300">
                      {a.risk}
                    </p>
                  )}
                  <p className="mt-2 pl-[2.1rem] text-[13px] text-neutral-200">
                    <span className="text-neutral-400">Recommended action: </span>
                    {a.action}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </Reveal>
    </Section>
  );
}
