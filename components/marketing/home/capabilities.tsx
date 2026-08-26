"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal, Section, SectionLabel } from "@/components/marketing/section";
import {
  ActionRow,
  DATA_NOTE,
  Panel,
  RiskLabel,
  SAMPLE_DEALS,
  SignalChip,
} from "@/components/marketing/home/product-ui";

/**
 * §5 — the capability section, framed as one judgement system rather than six
 * separate agents.
 *
 * The four questions are the product's actual output contract, so they drive
 * the interface directly: selecting one swaps the panel to the view that
 * answers it. The motion is the explanation — nothing animates that is not a
 * product state change.
 *
 * Implemented as a real ARIA tablist so arrow keys work and screen readers
 * announce the relationship between question and panel.
 */

type QuestionId = "who" | "why" | "what" | "stake";

const QUESTIONS: {
  id: QuestionId;
  question: string;
  answer: string;
}[] = [
  {
    id: "who",
    question: "Who should we contact?",
    answer:
      "Every open deal ranked by expected revenue, so the top of the list is where the next hour is worth the most.",
  },
  {
    id: "why",
    question: "Why now?",
    answer:
      "The specific evidence behind the ranking — what the buyer did, when, and how long it has been since anyone responded.",
  },
  {
    id: "what",
    question: "What should we do?",
    answer:
      "One recommended action per opportunity, with the reasoning attached. Not five options — one.",
  },
  {
    id: "stake",
    question: "How much is at stake?",
    answer:
      "Expected revenue, not contract value. A deal that was never certain was never yours to lose in full.",
  },
];

export function Capabilities() {
  const [active, setActive] = useState<QuestionId>("who");
  const baseId = useId();

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = QUESTIONS.findIndex((q) => q.id === active);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setActive(QUESTIONS[(i + 1) % QUESTIONS.length].id);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive(QUESTIONS[(i - 1 + QUESTIONS.length) % QUESTIONS.length].id);
    }
  };

  return (
    <Section id="product" className="bg-white/[0.012]">
      <Reveal>
        <SectionLabel number="02" label="The product" />
        <h2 className="mt-8 max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          One revenue brain. Every deal prioritized.
        </h2>
        <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-neutral-300">
          Sellora is not a set of disconnected assistants. It is a single
          judgement system that reads your whole pipeline and answers four
          questions.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
        {/* ── Questions ── */}
        <div
          role="tablist"
          aria-label="What Sellora answers"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          className="flex flex-col"
        >
          {QUESTIONS.map((q) => {
            const selected = q.id === active;
            return (
              <button
                key={q.id}
                role="tab"
                id={`${baseId}-tab-${q.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${q.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(q.id)}
                className={cn(
                  "group border-l-2 py-5 pl-5 pr-2 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]",
                  selected
                    ? "border-violet-400"
                    : "border-white/[0.10] hover:border-white/30"
                )}
              >
                <span
                  className={cn(
                    "block text-lg font-medium tracking-tight transition-colors sm:text-xl",
                    selected ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
                  )}
                >
                  {q.question}
                </span>
                <span
                  className={cn(
                    "mt-2 block overflow-hidden text-[14px] leading-relaxed text-neutral-300 transition-all duration-500",
                    selected ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  {q.answer}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Panel ── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {QUESTIONS.map((q) => (
            <div
              key={q.id}
              role="tabpanel"
              id={`${baseId}-panel-${q.id}`}
              aria-labelledby={`${baseId}-tab-${q.id}`}
              hidden={q.id !== active}
            >
              {q.id === active && <QuestionPanel id={q.id} />}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function QuestionPanel({ id }: { id: QuestionId }) {
  const focus = SAMPLE_DEALS[0];

  return (
    <Panel
      label={PANEL_LABEL[id]}
      meta={<span className="text-[11px] text-neutral-400">{DATA_NOTE}</span>}
      // A short fade so switching questions reads as a state change rather
      // than a hard cut. Collapsed to instant by the global reduced-motion
      // rule in globals.css.
      className="animate-fade-in"
    >
      {id === "who" && (
        <ul className="divide-y divide-white/[0.06]">
          {SAMPLE_DEALS.map((d) => (
            <li key={d.company} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className="w-5 shrink-0 text-[11px] tabular-nums text-neutral-400">
                {d.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
                {d.company}
              </span>
              <span className="shrink-0 text-[13px] font-medium tabular-nums text-white">
                {d.expected}
              </span>
              <span className="hidden w-20 shrink-0 justify-end sm:flex">
                <RiskLabel level={d.risk} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {id === "why" && (
        <div className="px-4 py-4 sm:px-5">
          <div className="text-[13px] font-medium text-white">{focus.company}</div>
          <ol className="mt-4 space-y-3.5 border-l border-white/[0.10] pl-4">
            {[
              { when: "Today · 2:31 PM", what: "Pricing page viewed", note: "3rd visit this week" },
              { when: "Today · 1:52 PM", what: "Proposal opened", note: "2nd open in 24 hours" },
              { when: "Yesterday", what: "New stakeholder joined", note: "VP Finance, same domain" },
              { when: "4 days ago", what: "Last outbound sent", note: "No reply since" },
            ].map((e) => (
              <li key={e.what} className="relative">
                <span
                  className="absolute -left-[21px] top-1.5 size-1.5 rounded-full bg-violet-400 ring-2 ring-[#0B0B0F]"
                  aria-hidden
                />
                <div className="text-[10px] uppercase tracking-[0.09em] text-neutral-400">
                  {e.when}
                </div>
                <div className="mt-0.5 text-[13px] text-white">{e.what}</div>
                <div className="text-[11px] text-neutral-400">{e.note}</div>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.09em] text-neutral-400">
              Sellora&rsquo;s read
            </div>
            <p className="mt-1 text-[13px] leading-snug text-neutral-200">
              Strong purchase intent, no response for 4 days. Contact within 24
              hours.
            </p>
          </div>
        </div>
      )}

      {id === "what" && (
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <div className="text-[13px] font-medium text-white">{focus.company}</div>
          <ActionRow>{focus.action}</ActionRow>
          <div>
            <div className="text-[10px] uppercase tracking-[0.09em] text-neutral-400">
              Why
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-300">
              They opened the proposal twice in 24 hours and a second
              stakeholder joined the evaluation, but nobody has followed up for
              four days. Deals contacted within 24 hours of a proposal open
              convert materially better than ones left to cool.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] text-neutral-400">Alternatives:</span>
            {["Call the prospect", "Bring the founder in", "Send a case study"].map((a) => (
              <SignalChip key={a}>{a}</SignalChip>
            ))}
          </div>
        </div>
      )}

      {id === "stake" && (
        <div className="px-4 py-5 sm:px-5">
          <div className="text-[13px] font-medium text-white">{focus.company}</div>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-medium tabular-nums">
            <span className="text-2xl text-white">{focus.dealValue}</span>
            <span className="text-neutral-400" aria-hidden>
              ×
            </span>
            <span className="text-2xl text-white">{focus.probability}</span>
            <span className="text-neutral-400" aria-hidden>
              =
            </span>
            <span className="text-2xl text-violet-300">{focus.expected}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-5 text-[11px] text-neutral-400">
            <span>Deal value</span>
            <span>Probability of closing</span>
            <span className="text-violet-300/80">Expected revenue</span>
          </div>

          <p className="mt-5 border-t border-white/[0.08] pt-4 text-[13px] leading-relaxed text-neutral-300">
            Reporting the full {focus.dealValue} as &ldquo;at risk&rdquo; would
            overstate it — this deal was never certain. Sellora prices exposure
            at expected revenue, then discounts it further by how severe the
            problem is. Conservative numbers survive contact with your CRM.
          </p>
        </div>
      )}
    </Panel>
  );
}

const PANEL_LABEL: Record<QuestionId, string> = {
  who: "Opportunities · ranked by expected revenue",
  why: "Buying signals · Cloudmint",
  what: "Recommended next action",
  stake: "Expected revenue",
};
