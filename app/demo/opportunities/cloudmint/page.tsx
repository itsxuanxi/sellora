"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { useCountUp } from "@/components/marketing/home/use-count-up";
import { useCompleteStep, useDemo } from "@/components/demo/demo-store";
import { DemoDataBadge } from "@/components/demo/demo-chrome";
import { DEMO_ROUTES } from "@/lib/demo/steps";
import {
  ADVANCED_EXPECTED,
  ANALYSIS_BEATS,
  DEMO_ACCOUNT,
  DEMO_CONTACT,
  DEMO_DRAFT,
  DEMO_OPPORTUNITY,
  DEMO_RECOMMENDATION,
  DEMO_RESPONSE,
  DEMO_RESPONSE_EFFECTS,
  DEMO_SCORES,
  DEMO_SEND_NOTE,
  DEMO_SIGNALS,
  EXPECTED_UPLIFT,
  INITIAL_EXPECTED,
  formatUsd,
} from "@/lib/demo/fixture";

/**
 * Steps 2–8: the opportunity, worked.
 *
 * Every panel below is gated on real demo state, so the page a visitor sees
 * genuinely reflects what they have done — the signals list is empty until
 * they expand it, the scores do not exist until they run the analysis, and
 * nothing is sent until they approve it. Skipping the tour and clicking
 * through by hand produces exactly the same progression.
 *
 * Nothing here reaches the network. The "send" is a state transition and a
 * timestamp; the label under the button says so.
 */
export default function DemoOpportunityPage() {
  const completeStep = useCompleteStep();
  const router = useRouter();
  const [reduced, setReduced] = useState(false);

  useEffect(() => setReduced(prefersReducedMotion()), []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <button
        type="button"
        onClick={() => router.push(DEMO_ROUTES.workspace)}
        className="text-[12px] text-[var(--mkt-muted)] underline decoration-[var(--mkt-line)] underline-offset-4 transition-colors hover:text-[var(--mkt-ink)]"
      >
        ← Back to workspace
      </button>

      <Header />

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <SignalsPanel reduced={reduced} onExpand={() => completeStep("signalsExpanded")} />
          <AnalysisPanel reduced={reduced} onDone={() => completeStep("analysisCompleted")} />
          <RecommendationPanel
            onGenerate={() => completeStep("recommendationGenerated")}
            onOpenDraft={() => completeStep("draftOpened")}
            onApprove={() => completeStep("actionApproved")}
          />
          <ResponsePanel
            reduced={reduced}
            onView={() => completeStep("buyerResponseReceived")}
            onUpdate={() => {
              completeStep("opportunityUpdated");
              // The outcome lives on the analytics page; go there once the
              // numbers have visibly moved.
              setTimeout(() => router.push(DEMO_ROUTES.analytics), 1400);
            }}
          />
        </div>

        <aside className="space-y-5">
          <DealPanel />
          <AccountPanel />
        </aside>
      </div>
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────

function Header() {
  const { state } = useDemo();
  return (
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--mkt-muted)]">
          Opportunity
        </p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-[28px]">
          {DEMO_OPPORTUNITY.name}
        </h1>
        <p className="mt-2 text-[13.5px] text-[var(--mkt-muted)]">
          {DEMO_ACCOUNT.industry} · {DEMO_ACCOUNT.employees} employees ·{" "}
          {DEMO_ACCOUNT.region} · Owner {DEMO_OPPORTUNITY.owner}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors",
            state.opportunityUpdated
              ? "bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]"
              : "bg-[var(--mkt-surface-2)] text-[var(--mkt-muted)]"
          )}
        >
          {state.stage}
        </span>
        <DemoDataBadge />
      </div>
    </div>
  );
}

// ── Panel shell ────────────────────────────────────────────────────────────

function Panel({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {eyebrow && (
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-brand-deep)]">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-0.5 text-[15px] font-medium tracking-tight">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  target,
  icon: Icon,
  variant = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  target?: string;
  icon?: typeof Check;
  variant?: "primary" | "outline";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-demo-target={target}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-surface)] disabled:opacity-50",
        variant === "primary"
          ? "bg-[var(--mkt-brand)] text-white hover:bg-[var(--mkt-brand-deep)]"
          : "border border-[var(--mkt-line)] text-[var(--mkt-ink)] hover:border-[var(--mkt-brand)] hover:text-[var(--mkt-brand-deep)]"
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

// ── Step 2: signals ────────────────────────────────────────────────────────

function SignalsPanel({ reduced, onExpand }: { reduced: boolean; onExpand: () => void }) {
  const { state } = useDemo();

  return (
    <Panel
      eyebrow="Detect"
      title="Signal timeline"
      action={
        !state.signalsExpanded ? (
          <ActionButton target="view-signals" onClick={onExpand} icon={ChevronDown}>
            View signals
          </ActionButton>
        ) : (
          <span className="text-[12px] tabular-nums text-[var(--mkt-muted)]">
            {DEMO_SIGNALS.length} signals
          </span>
        )
      }
    >
      {!state.signalsExpanded ? (
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--mkt-muted)]">
          Selryn has been collecting proposal activity, stakeholder changes,
          website intent and CRM history against this opportunity.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {DEMO_SIGNALS.map((s, i) => (
            <li
              key={s.id}
              className={cn("flex items-start gap-3", !reduced && "animate-fade-up")}
              style={reduced ? undefined : { animationDelay: `${i * 70}ms` }}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  s.tone === "risk"
                    ? "border-[var(--mkt-warn)]/40 bg-[var(--mkt-warn)]/10 text-[var(--mkt-warn-ink)]"
                    : "border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]"
                )}
                aria-hidden
              >
                <Radio className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13.5px] font-medium">{s.label}</p>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--mkt-muted)]">
                    {s.at}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--mkt-muted)]">
                  {s.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

// ── Step 3: analysis ───────────────────────────────────────────────────────

function AnalysisPanel({ reduced, onDone }: { reduced: boolean; onDone: () => void }) {
  const { state } = useDemo();
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);

  const intent = useCountUp(state.analysisCompleted ? DEMO_SCORES.intent : 0, { reduced });
  const risk = useCountUp(state.analysisCompleted ? DEMO_SCORES.risk : 0, { reduced });

  function analyze() {
    if (reduced) {
      onDone();
      return;
    }
    setRunning(true);
    setBeat(0);
    // Four short beats — long enough to read, short enough not to be a stall.
    ANALYSIS_BEATS.forEach((_, i) => {
      if (i === 0) return;
      setTimeout(() => setBeat(i), i * 420);
    });
    setTimeout(() => {
      setRunning(false);
      onDone();
    }, ANALYSIS_BEATS.length * 420);
  }

  if (!state.signalsExpanded) return null;

  return (
    <Panel
      eyebrow="Decide"
      title="Opportunity analysis"
      action={
        !state.analysisCompleted && !running ? (
          <ActionButton target="analyze" onClick={analyze} icon={Sparkles}>
            Analyze opportunity
          </ActionButton>
        ) : null
      }
    >
      {running && (
        <div className="mt-4 flex items-center gap-2.5" aria-live="polite">
          <Loader2 className="size-4 animate-spin text-[var(--mkt-brand)]" aria-hidden />
          <span className="text-[13.5px] text-[var(--mkt-muted)]">
            {ANALYSIS_BEATS[beat]}…
          </span>
        </div>
      )}

      {!running && !state.analysisCompleted && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--mkt-muted)]">
          Six signals recorded. Run the analysis to score intent, weigh the risk
          from four days of silence, and put a number on what is exposed.
        </p>
      )}

      {state.analysisCompleted && !running && (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Intent score" value={String(intent)} tone="good" />
            <Metric label="Risk score" value={String(risk)} tone="risk" />
            <Metric label="Status" value={DEMO_SCORES.status} tone="risk" />
            <Metric
              label="Revenue at risk"
              value={formatUsd(DEMO_SCORES.revenueAtRisk)}
              tone="risk"
            />
          </dl>
          <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--mkt-muted)]">
            Intent is high and the buying committee has grown — but the deal has
            been silent for four days, which is what puts{" "}
            {formatUsd(INITIAL_EXPECTED)} of expected revenue at risk.
          </p>
        </>
      )}
    </Panel>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "risk";
}) {
  return (
    <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-3 py-2.5">
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-[18px] font-medium tabular-nums leading-none tracking-tight",
          tone === "risk" ? "text-[var(--mkt-warn-ink)]" : "text-[var(--mkt-success)]"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ── Steps 4–6: recommendation, draft, approval ─────────────────────────────

function RecommendationPanel({
  onGenerate,
  onOpenDraft,
  onApprove,
}: {
  onGenerate: () => void;
  onOpenDraft: () => void;
  onApprove: () => void;
}) {
  const { state } = useDemo();
  const [body, setBody] = useState<string>(DEMO_DRAFT.body);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);

  function approve() {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSentAt(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
      onApprove();
    }, 900);
  }

  if (!state.analysisCompleted) return null;

  return (
    <Panel
      eyebrow="Act"
      title="Next best action"
      action={
        !state.recommendationGenerated ? (
          <ActionButton target="recommend" onClick={onGenerate} icon={Sparkles}>
            Generate next best action
          </ActionButton>
        ) : null
      }
    >
      {!state.recommendationGenerated ? (
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--mkt-muted)]">
          Selryn recommends one action, not a menu of five — with the evidence
          it rests on attached.
        </p>
      ) : (
        <div className="mt-4">
          <div className="rounded-xl border border-[var(--mkt-brand)]/30 bg-[var(--mkt-brand-wash)] p-4">
            <p className="text-[15px] font-medium leading-snug">
              {DEMO_RECOMMENDATION.headline}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--mkt-muted)]">
              {DEMO_RECOMMENDATION.reason}
            </p>

            <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--mkt-brand-deep)]">
              Supporting signals
            </p>
            <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
              {DEMO_RECOMMENDATION.supporting.map((s) => (
                <li key={s} className="flex items-start gap-1.5 text-[12.5px] leading-snug">
                  <Check
                    className="mt-[3px] size-3 shrink-0 text-[var(--mkt-brand)]"
                    strokeWidth={3}
                    aria-hidden
                  />
                  {s}
                </li>
              ))}
            </ul>

            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--mkt-brand)]/20 pt-3 text-[12px]">
              <Inline label="Confidence" value={DEMO_RECOMMENDATION.confidence} />
              <Inline label="Deal at stake" value={formatUsd(DEMO_OPPORTUNITY.dealValue)} />
              <Inline label="Expected revenue" value={formatUsd(INITIAL_EXPECTED)} />
            </dl>
          </div>

          {!state.draftOpened ? (
            <div className="mt-4">
              <ActionButton target="review-draft" onClick={onOpenDraft} icon={Mail}>
                Review draft
              </ActionButton>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
                  Draft · to {DEMO_DRAFT.to}
                </p>
                <StatusPill
                  state={
                    state.actionApproved ? "sent" : sending ? "sending" : "draft"
                  }
                  sentAt={sentAt}
                />
              </div>

              <p className="mt-2.5 text-[13.5px] font-medium">{DEMO_DRAFT.subject}</p>

              {/* Really editable — an "editable draft" the visitor cannot type
                  into would undercut the point of the whole step. */}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={state.actionApproved || sending}
                rows={5}
                aria-label="Email body"
                className="mt-2 w-full resize-none rounded-lg border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-3 text-[13px] leading-relaxed text-[var(--mkt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] disabled:opacity-70"
              />

              {!state.actionApproved ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      target="approve-send"
                      onClick={approve}
                      icon={Check}
                      disabled={sending}
                    >
                      {sending ? "Sending…" : "Approve and send"}
                    </ActionButton>
                    <ActionButton onClick={() => {}} variant="outline" disabled>
                      Reject
                    </ActionButton>
                    <ActionButton onClick={() => {}} variant="outline" disabled>
                      Snooze
                    </ActionButton>
                  </div>
                  <p className="mt-2.5 text-[11.5px] text-[var(--mkt-muted)]">
                    {DEMO_SEND_NOTE}
                  </p>
                </>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-[var(--mkt-success)]">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  Demo message sent{sentAt ? ` at ${sentAt}` : ""} — recorded with
                  the reasoning and your approval.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function Inline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[var(--mkt-muted)]">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function StatusPill({
  state,
  sentAt,
}: {
  state: "draft" | "sending" | "sent";
  sentAt: string | null;
}) {
  const map = {
    draft: { label: "Draft", cls: "bg-[var(--mkt-surface)] text-[var(--mkt-muted)]" },
    sending: { label: "Approved", cls: "bg-[var(--mkt-brand-wash)] text-[var(--mkt-brand-deep)]" },
    sent: {
      label: sentAt ? `Sent · ${sentAt}` : "Sent",
      cls: "bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]",
    },
  } as const;
  const s = map[state];
  return (
    <span
      className={cn(
        "rounded-full border border-[var(--mkt-line)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
        s.cls
      )}
    >
      {s.label}
    </span>
  );
}

// ── Steps 7–8: response and outcome ────────────────────────────────────────

function ResponsePanel({
  reduced,
  onView,
  onUpdate,
}: {
  reduced: boolean;
  onView: () => void;
  onUpdate: () => void;
}) {
  const { state } = useDemo();
  const [effects, setEffects] = useState(0);

  // The four consequences land one at a time — a reply, a meeting, a new
  // stakeholder, a scheduled review are separate facts and arrive as such.
  useEffect(() => {
    if (!state.buyerResponseReceived) return;
    if (reduced) {
      setEffects(DEMO_RESPONSE_EFFECTS.length);
      return;
    }
    const timers = DEMO_RESPONSE_EFFECTS.map((_, i) =>
      setTimeout(() => setEffects(i + 1), 400 + i * 520)
    );
    return () => timers.forEach(clearTimeout);
  }, [state.buyerResponseReceived, reduced]);

  if (!state.actionApproved) return null;

  return (
    <Panel
      eyebrow="Learn"
      title="Buyer response"
      action={
        !state.buyerResponseReceived ? (
          <ActionButton target="view-response" onClick={onView} icon={Mail}>
            View response
          </ActionButton>
        ) : null
      }
    >
      {!state.buyerResponseReceived ? (
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--mkt-muted)]">
          Selryn keeps watching after the action goes out. A reply, a booked
          meeting or continued silence are all results worth recording.
        </p>
      ) : (
        <div className="mt-4">
          <blockquote className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] p-4">
            <p className="text-[14px] italic leading-relaxed">
              &ldquo;{DEMO_RESPONSE.quote}&rdquo;
            </p>
            <footer className="mt-2 text-[12px] text-[var(--mkt-muted)]">
              {DEMO_RESPONSE.from} · {DEMO_CONTACT.role} · {DEMO_RESPONSE.at}
            </footer>
          </blockquote>

          <ul className="mt-4 space-y-2" aria-live="polite">
            {DEMO_RESPONSE_EFFECTS.map((e, i) => (
              <li
                key={e.id}
                className={cn(
                  "flex items-start gap-2.5 transition-[opacity,transform] duration-[420ms] ease-out",
                  i < effects
                    ? "opacity-100 [transform:translateY(0)]"
                    : "opacity-0 [transform:translateY(6px)]"
                )}
                aria-hidden={i >= effects}
              >
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]"
                  aria-hidden
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <div>
                  <p className="text-[13.5px] font-medium">{e.label}</p>
                  <p className="text-[12.5px] text-[var(--mkt-muted)]">{e.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          {effects >= DEMO_RESPONSE_EFFECTS.length && !state.opportunityUpdated && (
            <div className="mt-4">
              <ActionButton target="update-opportunity" onClick={onUpdate} icon={TrendingUp}>
                Update opportunity
              </ActionButton>
            </div>
          )}

          {state.opportunityUpdated && (
            <div className="mt-4 rounded-xl border border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/[0.06] p-4">
              <p className="text-[13.5px] font-medium">Opportunity advanced</p>
              <dl className="mt-2 space-y-1 text-[13px]">
                <Change
                  label="Stage"
                  from={DEMO_OPPORTUNITY.initialStage}
                  to={DEMO_OPPORTUNITY.advancedStage}
                />
                <Change
                  label="Win probability"
                  from={`${DEMO_OPPORTUNITY.initialWinProbability}%`}
                  to={`${DEMO_OPPORTUNITY.advancedWinProbability}%`}
                />
                <Change
                  label="Expected revenue"
                  from={formatUsd(INITIAL_EXPECTED)}
                  to={formatUsd(ADVANCED_EXPECTED)}
                />
              </dl>
              <p className="mt-2.5 text-[12.5px] text-[var(--mkt-success)]">
                +{formatUsd(EXPECTED_UPLIFT)} expected revenue. The deal has moved
                forward — it has not been won.
              </p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function Change({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-[var(--mkt-muted)]">{label}</dt>
      <dd className="flex items-center gap-1.5 tabular-nums">
        <span className="text-[var(--mkt-muted)] line-through decoration-[var(--mkt-line)]">
          {from}
        </span>
        <ArrowRight className="size-3 text-[var(--mkt-muted)]" aria-hidden />
        <span className="font-medium">{to}</span>
      </dd>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

function DealPanel() {
  const { state } = useDemo();
  return (
    <Panel title="Deal">
      <dl className="mt-3 space-y-2.5 text-[13px]">
        <Row label="Deal value" value={formatUsd(DEMO_OPPORTUNITY.dealValue)} />
        <Row label="Stage" value={state.stage} />
        <Row label="Win probability" value={`${state.winProbability}%`} />
        <Row
          label="Expected revenue"
          value={formatUsd(state.expectedRevenue)}
          strong
        />
        <Row label="Owner" value={DEMO_OPPORTUNITY.owner} />
      </dl>
      <p className="mt-3 border-t border-[var(--mkt-line)] pt-2.5 text-[11.5px] leading-snug text-[var(--mkt-muted)]">
        Expected revenue is deal value × win probability. It is an estimate, not
        a forecast or a commitment.
      </p>
    </Panel>
  );
}

function AccountPanel() {
  return (
    <Panel title="Account">
      <dl className="mt-3 space-y-2.5 text-[13px]">
        <Row label="Company" value={DEMO_ACCOUNT.company} />
        <Row label="Industry" value={DEMO_ACCOUNT.industry} />
        <Row label="Employees" value={String(DEMO_ACCOUNT.employees)} />
        <Row label="Region" value={DEMO_ACCOUNT.region} />
        <Row label="ICP fit" value={DEMO_ACCOUNT.icpFit} />
      </dl>
      <div className="mt-4 flex items-center gap-2.5 border-t border-[var(--mkt-line)] pt-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--mkt-brand-wash)] text-[11px] font-medium text-[var(--mkt-brand-deep)]">
          {DEMO_CONTACT.initials}
        </span>
        <div>
          <p className="text-[13px] font-medium">{DEMO_CONTACT.name}</p>
          <p className="text-[11.5px] text-[var(--mkt-muted)]">
            {DEMO_CONTACT.role} · {DEMO_CONTACT.decisionRole}
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-snug text-[var(--mkt-muted)]">
        <ShieldCheck className="mt-[1px] size-3.5 shrink-0" aria-hidden />
        Fictional account. Nothing in this demo touches a real CRM or inbox.
      </p>
    </Panel>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--mkt-muted)]">{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-medium")}>{value}</dd>
    </div>
  );
}
