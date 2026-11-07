"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RULE_ORDER, rankFollowUps, type FollowUpRule } from "@/lib/followup/rules";
import { BASIS_HELP, BASIS_LABEL, RISK_LABEL } from "@/lib/risk/kinds";
import { prefersReducedMotion } from "@/lib/motion";
import { Selly, SellyTrail, type SellyPose } from "@/components/brand/selly";
import { formatMoney } from "@/lib/revenue/money";
import {
  BY_DEAL_VALUE,
  DEMO_EVIDENCE,
  DEMO_PIPELINE,
  type DemoDealCard,
} from "@/components/marketing/home/product-demo-data";

/**
 * Three questions, one deal, in the order a seller asks them.
 *
 *   Who do I contact?  →  Why them, now?  →  What do I send?
 *
 * Interactive rather than a scripted animation, and the distinction is the
 * point: the panel that replaced this one played a fixed sequence of steps
 * on a timer. A visitor could not disagree with it, and because nothing was
 * computed, the sequence went on demonstrating an ordering the product had
 * already stopped using. Here the reorder calls `rankFollowUps` — the same
 * function Today calls — over data typed as `FollowUpItem`. If the rules
 * change, this changes with them or it stops compiling.
 *
 * Deliberately not a fourth demo system: this replaces the scripted one in
 * the same section, and the hero keeps its own.
 */

type StepId = "who" | "why" | "next";

const STEPS: {
  id: StepId;
  label: string;
  question: string;
  /** Selly's pose for this step. One drawn pose each — see components/brand/selly.tsx. */
  pose: SellyPose;
}[] = [
  { id: "who", label: "Who to contact", question: "Who needs me first?", pose: "who" },
  { id: "why", label: "Why now", question: "Why this one, today?", pose: "why" },
  { id: "next", label: "What to send", question: "What do I actually send?", pose: "next" },
];

export function ProductDemos() {
  const baseId = useId();
  // Wraps the step rail so the mascot can measure where each step sits.
  const railRef = useRef<HTMLOListElement | null>(null);
  const [step, setStep] = useState<StepId>("who");
  const [prioritized, setPrioritized] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("d_northwind");

  const selected =
    DEMO_PIPELINE.find((d) => d.opportunityId === selectedId) ?? DEMO_PIPELINE[0];

  /** Choosing a deal moves the story on; that is the whole interaction. */
  function choose(deal: DemoDealCard) {
    setSelectedId(deal.opportunityId);
    setStep("why");
  }

  return (
    <div className="mt-10">
      {/* Selly walks the path with the reader: one drawn pose per step, and
          she slides to whichever one is open. This is the movement the
          static chip was standing in for. */}
      <SellyTrail
        containerRef={railRef}
        active={STEPS.findIndex((s) => s.id === step)}
        poses={STEPS.map((s) => s.pose)}
        size={60}
      />

      {/* ── The three questions, as a path rather than a tab bar ── */}
      <ol
        ref={railRef}
        className="flex flex-wrap items-center gap-x-1.5 gap-y-2"
        role="tablist"
      >
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = STEPS.findIndex((x) => x.id === step) > i;
          return (
            <li key={s.id} className="flex items-center gap-1.5">
              <button
                type="button"
                role="tab"
                id={`${baseId}-${s.id}-tab`}
                aria-selected={active}
                aria-controls={`${baseId}-panel`}
                onClick={() => setStep(s.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]",
                  active
                    ? "border-[var(--mkt-brand)] bg-[var(--mkt-brand-wash)] text-[var(--mkt-brand-deep)]"
                    : "border-[var(--mkt-line)] bg-[var(--mkt-surface)] text-[var(--mkt-muted)] hover:text-[var(--mkt-ink)]"
                )}
              >
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    active || done ? "text-[var(--mkt-brand-deep)]" : "text-[var(--mkt-muted)]"
                  )}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <span className="text-[var(--mkt-line)]" aria-hidden>
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-${step}-tab`}
        className="mt-5 overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] shadow-[var(--mkt-shadow-card)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-4 py-2.5 sm:px-5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
            {STEPS.find((s) => s.id === step)?.question}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
            Sample data
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {step === "who" && (
            <WhoPanel
              prioritized={prioritized}
              selectedId={selectedId}
              onPrioritize={() => setPrioritized(true)}
              onReset={() => setPrioritized(false)}
              onChoose={choose}
            />
          )}
          {step === "why" && <WhyPanel deal={selected} onNext={() => setStep("next")} />}
          {step === "next" && <NextPanel deal={selected} />}
        </div>
      </div>
    </div>
  );
}

// ── 01 · Who to contact ────────────────────────────────────────────────────

/**
 * The checks Selryn runs, named from the rules it actually runs them with.
 *
 * Derived from RULE_ORDER rather than typed out, so the animation cannot
 * show a sequence of checks the ranker does not perform, and cannot fall out
 * of step with it later. The counts come from the sample pipeline the same
 * way — nothing here is a number somebody chose to look good.
 */
const CHECK_COPY: Record<FollowUpRule, string> = {
  followup_due: "A date you agreed, and missed",
  quote_no_reply: "A proposal nobody answered",
  no_next_step: "A meeting with nothing booked after it",
  gone_quiet: "Silence, with nothing agreed",
};

const CHECKS = RULE_ORDER.map((rule) => ({
  rule,
  label: CHECK_COPY[rule],
  hits: DEMO_PIPELINE.filter((d) => d.rule === rule && d.daysOverdue > 0).length,
}));

/** Long enough to read one line, short enough that four do not drag. */
const CHECK_MS = 420;

type Phase = "idle" | "analyzing" | "ranked";

function WhoPanel({
  prioritized,
  selectedId,
  onPrioritize,
  onReset,
  onChoose,
}: {
  prioritized: boolean;
  selectedId: string;
  onPrioritize: () => void;
  onReset: () => void;
  onChoose: (deal: DemoDealCard) => void;
}) {
  const [reduced, setReduced] = useState(false);
  const [phase, setPhase] = useState<Phase>(prioritized ? "ranked" : "idle");
  const [checksShown, setChecksShown] = useState(0);

  useEffect(() => setReduced(prefersReducedMotion()), []);

  // The product's own ranker. Not a sort written for this page.
  const ranked = useMemo(() => rankFollowUps(DEMO_PIPELINE), []);
  const list = phase === "ranked" ? ranked : BY_DEAL_VALUE;
  const top = ranked[0];

  // ── The reorder, animated from where each card actually was ──
  //
  // FLIP: measure before the list changes, then start each card from its old
  // offset and let one transition carry it home. A reflow rather than
  // requestAnimationFrame to flush the first frame, because rAF does not run
  // in a backgrounded tab and the cards would be left mid-flight.
  const cards = useRef(new Map<string, HTMLLIElement>());
  const before = useRef(new Map<string, number>());

  function measure() {
    const m = new Map<string, number>();
    cards.current.forEach((el, id) => m.set(id, el.getBoundingClientRect().top));
    before.current = m;
  }

  useLayoutEffect(() => {
    if (reduced || before.current.size === 0) return;
    cards.current.forEach((el, id) => {
      const prev = before.current.get(id);
      if (prev == null) return;
      const delta = prev - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      void el.offsetHeight;
      el.style.transition = "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "";
    });
    before.current = new Map();
  }, [phase, reduced]);

  function run() {
    if (reduced) {
      // No animation to watch, so no reason to make someone wait for one.
      setChecksShown(CHECKS.length);
      measure();
      setPhase("ranked");
      onPrioritize();
      return;
    }
    setPhase("analyzing");
    setChecksShown(0);
    CHECKS.forEach((_, i) => {
      window.setTimeout(() => setChecksShown(i + 1), CHECK_MS * (i + 1));
    });
    window.setTimeout(() => {
      measure();
      setPhase("ranked");
      onPrioritize();
    }, CHECK_MS * (CHECKS.length + 1));
  }

  function replay() {
    setPhase("idle");
    setChecksShown(0);
    before.current = new Map();
    cards.current.forEach((el) => {
      el.style.transition = "none";
      el.style.transform = "";
    });
    onReset();
  }

  return (
    <div>
      {/* ── The control, and what it is about to do ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--mkt-muted)]">
          {phase === "ranked" ? (
            <>
              Ordered by what is overdue. Brightcart is the biggest deal and
              sits third.
            </>
          ) : (
            <>Five open deals, as your CRM lists them — biggest first.</>
          )}
        </p>

        {phase === "ranked" ? (
          <button
            type="button"
            onClick={replay}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--mkt-line)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--mkt-muted)] transition-colors hover:border-[var(--mkt-brand)] hover:text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2"
          >
            <RotateCcw className="size-3" aria-hidden />
            Replay
          </button>
        ) : (
          <button
            type="button"
            onClick={run}
            disabled={phase === "analyzing"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--mkt-ink)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--mkt-page)] transition-colors hover:bg-[var(--mkt-brand-deep)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2"
          >
            {phase === "analyzing" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Search className="size-3.5" aria-hidden />
            )}
            Find who needs follow-up
          </button>
        )}
      </div>

      {/* ── The checks, as they land ──
             Four lines, one per rule, each naming a real check and how many
             deals it caught. Deliberately not "AI analysing…": these are
             four comparisons against dates and records in sample data, and
             dressing them as inference would be the one claim this page
             spends its whole length arguing against. */}
      {(phase === "analyzing" || phase === "ranked") && (
        <ul
          className="mt-3 space-y-1 border-l-2 border-[var(--mkt-brand)]/25 pl-3"
          aria-live="polite"
        >
          {CHECKS.slice(0, phase === "ranked" ? CHECKS.length : checksShown).map((c) => (
            <li
              key={c.rule}
              className={cn(
                "flex flex-wrap items-baseline gap-x-2 text-[12.5px]",
                !reduced && "animate-fade-up"
              )}
            >
              <Check className="size-3 shrink-0 text-[var(--mkt-success)]" aria-hidden />
              <span className="text-[var(--mkt-ink)]">{c.label}</span>
              <span className="text-[var(--mkt-muted)]">
                {c.hits === 0 ? "none" : c.hits === 1 ? "1 deal" : `${c.hits} deals`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ── The deals, as cards ── */}
      <ul className="mt-4 space-y-2">
        {list.map((deal, i) => {
          const lead = phase === "ranked" && i === 0;
          const chosen = deal.opportunityId === selectedId;
          return (
            <li
              key={deal.opportunityId}
              ref={(el) => {
                if (el) cards.current.set(deal.opportunityId, el);
                else cards.current.delete(deal.opportunityId);
              }}
              className="will-change-transform"
            >
              <button
                type="button"
                onClick={() => onChoose(deal)}
                className={cn(
                  "flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3.5 py-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2",
                  lead
                    ? "border-[var(--mkt-brand)] bg-[var(--mkt-brand-wash)] shadow-[var(--mkt-shadow-card)]"
                    : chosen
                      ? "border-[var(--mkt-brand)]/40 bg-[var(--mkt-surface-2)]"
                      : "border-[var(--mkt-line)] bg-[var(--mkt-surface)] hover:border-[var(--mkt-brand)]/40"
                )}
              >
                <span
                  className={cn(
                    "w-5 shrink-0 font-mono text-[11px] tabular-nums",
                    lead ? "text-[var(--mkt-brand-deep)]" : "text-[var(--mkt-muted)]"
                  )}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[var(--mkt-ink)]">
                    {deal.accountName}
                  </span>
                  <span className="block truncate text-[12.5px] text-[var(--mkt-muted)]">
                    {deal.contactName} · {deal.contactRole}
                  </span>
                </span>

                {phase === "ranked" && (
                  <span className="hidden min-w-0 flex-1 sm:block">
                    <span className="block truncate text-[12.5px] text-[var(--mkt-ink)]">
                      {RISK_LABEL[deal.risk]}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--mkt-muted)]">
                      {deal.daysOverdue > 0
                        ? `${deal.daysOverdue} days waiting`
                        : "nothing overdue"}
                    </span>
                  </span>
                )}

                <span
                  className={cn(
                    "shrink-0 text-right text-[13px] tabular-nums",
                    lead ? "text-[var(--mkt-ink)]" : "text-[var(--mkt-muted)]"
                  )}
                >
                  {formatMoney(deal.amount ?? 0, deal.currency)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* ── The verdict, and the way into Why ── */}
      {phase === "ranked" ? (
        <div className="mt-4 rounded-xl border border-[var(--mkt-brand)]/25 bg-[var(--mkt-brand-wash)]/60 p-3.5">
          <p className="text-[13.5px] leading-relaxed text-[var(--mkt-ink)]">
            <span className="font-medium">{top.accountName} first.</span>{" "}
            {top.because}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onChoose(top)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mkt-ink)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--mkt-page)] transition-colors hover:bg-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2"
            >
              See why
              <ArrowRight className="size-3.5" aria-hidden />
            </button>
            <span className="text-[12px] text-[var(--mkt-muted)]">
              Deal size only breaks a tie. No score, and nothing predicted.
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
          Pick any deal to see what Selryn has on it — or let it find the one
          that needs you first.
        </p>
      )}
    </div>
  );
}

// ── 02 · Why now ───────────────────────────────────────────────────────────

function WhyPanel({ deal, onNext }: { deal: DemoDealCard; onNext: () => void }) {
  const records = DEMO_EVIDENCE[deal.opportunityId] ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-[17px] font-medium tracking-tight text-[var(--mkt-ink)]">
          {deal.headline}
        </h3>
        <span className="text-[12.5px] text-[var(--mkt-muted)]">
          {deal.accountName} · {deal.contactName}
        </span>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--mkt-muted)]">
        {deal.because}
      </p>

      <h4 className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
        Based on
      </h4>
      <ul className="mt-2.5 space-y-2">
        {records.map((record, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              title={BASIS_HELP[record.basis]}
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.07em]",
                record.basis === "observed"
                  ? "bg-[var(--mkt-surface-2)] text-[var(--mkt-muted)]"
                  : "bg-[var(--mkt-warn)]/10 text-[var(--mkt-warn-ink)]"
              )}
            >
              {BASIS_LABEL[record.basis]}
            </span>
            <span className="min-w-0 text-[13.5px] text-[var(--mkt-ink)]">{record.label}</span>
            <span className="text-[12.5px] text-[var(--mkt-muted)]">
              {record.daysAgo}d ago · {record.source}
            </span>
          </li>
        ))}
      </ul>

      {deal.staleness && (
        <p className="mt-3 rounded-lg border border-[var(--mkt-warn)]/30 bg-[var(--mkt-warn)]/10 px-3 py-2 text-[12.5px] leading-relaxed text-[var(--mkt-warn-ink)]">
          {deal.staleness}
        </p>
      )}

      {/* The claim worth making on this page, made where it is demonstrated
          rather than asserted in a feature list. */}
      <p className="mt-4 border-t border-[var(--mkt-line)] pt-3 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
        Every line says whether it was read off a record or reasoned from
        several. Selryn never shows you the second kind dressed as the first.
      </p>

      <button
        type="button"
        onClick={onNext}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--mkt-ink)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--mkt-page)] transition-colors hover:bg-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2"
      >
        <Pencil className="size-3.5" aria-hidden />
        Draft the follow-up
      </button>
    </div>
  );
}

// ── 03 · What to send ──────────────────────────────────────────────────────

function NextPanel({ deal }: { deal: DemoDealCard }) {
  const [body, setBody] = useState(deal.draft.body);
  const [approved, setApproved] = useState(false);
  const edited = body !== deal.draft.body;
  const records = DEMO_EVIDENCE[deal.opportunityId] ?? [];

  // Reset when the visitor comes back with a different deal selected.
  const [lastDeal, setLastDeal] = useState(deal.opportunityId);
  if (lastDeal !== deal.opportunityId) {
    setLastDeal(deal.opportunityId);
    setBody(deal.draft.body);
    setApproved(false);
  }

  if (approved) {
    return (
      <div>
        <div className="flex items-center gap-2.5">
          <Selly pose="cheer" size={34} float />
          <span className="flex size-5 items-center justify-center rounded-full bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
            Step 3 of 3 · Approved
          </span>
        </div>
        <p className="mt-2.5 text-[15px] font-medium text-[var(--mkt-ink)]">
          {deal.accountName} · {deal.contactName}
        </p>
        <p className="mt-1 text-[13.5px] text-[var(--mkt-muted)]">
          {edited
            ? "Selryn drafted this, and you changed it before approving."
            : "Selryn drafted this, and you approved it unchanged."}{" "}
          Both versions are kept, which is how the product measures whether
          its drafts are any good.
        </p>
        <p className="mt-4 rounded-lg border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--mkt-muted)]">
          <span className="font-medium text-[var(--mkt-ink)]">Nothing was sent.</span>{" "}
          This is a demo on sample data, and in the product nothing reaches a
          customer until a person approves that specific draft.
        </p>
        <button
          type="button"
          onClick={() => setApproved(false)}
          className="mt-4 text-[13px] text-[var(--mkt-muted)] underline decoration-[var(--mkt-line)] underline-offset-4 transition-colors hover:text-[var(--mkt-ink)]"
        >
          Back to the draft
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-4 text-[var(--mkt-brand-deep)]" aria-hidden />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
          Step 2 of 3 · Your review
        </span>
      </div>

      <p className="mt-2.5 text-[15px] font-medium text-[var(--mkt-ink)]">
        {deal.draft.subject}
      </p>
      <p className="mt-1 text-[12.5px] text-[var(--mkt-muted)]">
        To {deal.contactName} at {deal.accountName} · written from{" "}
        {records.length} record{records.length === 1 ? "" : "s"} on this deal
      </p>

      <label htmlFor="demo-draft" className="sr-only">
        The drafted follow-up, which you can edit
      </label>
      <textarea
        id="demo-draft"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        spellCheck={false}
        className="mt-3 w-full resize-y rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-page)] p-3 font-sans text-[13.5px] leading-relaxed text-[var(--mkt-ink)] focus-visible:border-[var(--mkt-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)]/30"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setApproved(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mkt-ink)] px-4 py-2 text-[13.5px] font-medium text-[var(--mkt-page)] transition-colors hover:bg-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2"
        >
          <Check className="size-3.5" aria-hidden />
          Approve
        </button>
        <span className="text-[12.5px] text-[var(--mkt-muted)]">
          {edited ? "Edited — Selryn keeps both versions." : "Edit it freely; it is a textarea."}
        </span>
      </div>
    </div>
  );
}
