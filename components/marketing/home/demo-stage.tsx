"use client";

import { ArrowUp, Check, CircleDashed, Pencil, Radio, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/revenue/money";
import { useCountUp } from "@/components/marketing/home/use-count-up";
import {
  DEMO_DEALS,
  type DemoStep,
  type HeroScenario,
} from "@/components/marketing/home/demo-data";

/**
 * One executing scenario.
 *
 * Every step is mounted from the start and revealed by opacity and a small
 * translate — never by mounting. That is the whole reason the page does not
 * jump: the panel is as tall as its finished state from the first frame, so a
 * six-step scenario and a five-step one both hold their height while the
 * carousel swaps between them.
 *
 * Rendering is driven off each step's `action`, so a new step is a data edit
 * in demo-data.ts rather than another branch of animation code here.
 */
/**
 * True when a later revealed step of the same kind replaces this one.
 *
 * Applies only to the kinds that represent a single mutating surface - a
 * re-sorting table, an approval control - not to signals or outcomes, which
 * genuinely accumulate.
 */
const REPLACING_KINDS = new Set(["rank", "approve"]);

function supersededBy(
  steps: HeroScenario["steps"],
  index: number,
  revealed: number
): boolean {
  const kind = steps[index].action;
  if (!REPLACING_KINDS.has(kind)) return false;
  return steps.some((s, j) => j > index && j < revealed && s.action === kind);
}

export function DemoStage({
  scenario,
  revealed,
  reduced,
  live,
}: {
  scenario: HeroScenario;
  /** How many steps have landed. */
  revealed: number;
  reduced: boolean;
  /** False for panels that are mounted but not the active tab. */
  live: boolean;
}) {
  const complete = revealed >= scenario.steps.length;
  // The footer reports the newest landed step, so it reads as a running
  // commentary rather than a label that was written in advance.
  const status = scenario.steps
    .slice(0, revealed)
    .reverse()
    .find((s) => s.status)?.status;

  return (
    <div className="flex h-full flex-col">
      <StageHeader scenario={scenario} live={live} />

      {/* overflow-hidden is a guard, not the layout: a step list that outgrows
          its track would otherwise paint straight over the footer beneath it
          rather than being contained. The panel height is sized so this never
          fires, and clipping is the safe failure if content ever grows. */}
      <ol className="mt-4 min-h-0 flex-1 space-y-2.5 overflow-hidden">
        {scenario.steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            shown={i < revealed}
            // A ranked table is replaced by the next one rather than stacked
            // beneath it: the panel shows one list re-sorting, and two tables
            // would muddle the claim. Same for the approval control, which
            // goes from awaiting to approved in place.
            //
            // Replaced steps leave the layout entirely rather than being made
            // transparent - a hidden-but-present table still occupied its full
            // height and pushed the panel's footer out of the bottom. Safe to
            // collapse because the replacement occupies the same space.
            collapsed={supersededBy(scenario.steps, i, revealed)}
            // Only the newest landed step counts as "working"; earlier ones
            // settle into a completed state.
            current={i === revealed - 1 && !complete}
            reduced={reduced}
            live={live}
          />
        ))}
      </ol>

      <StageFooter
        status={status}
        closing={scenario.closing}
        complete={complete}
      />
    </div>
  );
}

function StageHeader({ scenario, live }: { scenario: HeroScenario; live: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--mkt-line)] pb-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[15px] font-medium text-[var(--mkt-ink)]">
          {scenario.subject.company}
        </span>
        {scenario.subject.dealValue > 0 && (
          <>
            <span className="text-[15px] font-medium tabular-nums text-[var(--mkt-ink)]">
              {formatMoney(scenario.subject.dealValue, "USD")}
            </span>
            <span className="rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-2 py-0.5 text-[11px] text-[var(--mkt-muted)]">
              {scenario.subject.stage}
            </span>
          </>
        )}
      </div>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
        <span
          className={cn(
            "size-1.5 rounded-full bg-[var(--mkt-success)]",
            // The pulse is the only ambient motion in the panel, and it stops
            // on inactive tabs so four of them never animate at once.
            live && "motion-safe:animate-[ping-ring_2s_ease-out_infinite]"
          )}
          aria-hidden
        />
        Live
      </span>
    </div>
  );
}

function StepRow({
  step,
  shown,
  current,
  reduced,
  live,
  collapsed = false,
}: {
  step: DemoStep;
  shown: boolean;
  current: boolean;
  reduced: boolean;
  live: boolean;
  collapsed?: boolean;
}) {
  if (collapsed) return null;

  return (
    <li
      className={cn(
        "transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        shown
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2"
      )}
      // Steps that have not landed are not announced, so a screen reader
      // hears the sequence in the order it happens.
      aria-hidden={!shown}
    >
      <StepBody step={step} shown={shown} current={current} reduced={reduced} live={live} />
    </li>
  );
}

function StepBody({
  step,
  shown,
  current,
  reduced,
  live,
}: {
  step: DemoStep;
  shown: boolean;
  current: boolean;
  reduced: boolean;
  live: boolean;
}) {
  switch (step.action) {
    case "signal":
      return (
        <Row
          icon={<Radio className="size-3" />}
          tone={step.payload.tone === "risk" ? "risk" : "good"}
          title={step.payload.label}
          detail={step.payload.detail}
          meta={step.payload.at}
        />
      );

    case "analyze":
      return (
        <Row
          icon={
            current && live && !reduced ? (
              <CircleDashed className="size-3 motion-safe:animate-spin [animation-duration:1.6s]" />
            ) : (
              <Sparkles className="size-3" />
            )
          }
          tone="accent"
          title={step.payload.label}
        />
      );

    case "score":
      return (
        <MetricRow
          label={step.payload.metric}
          from={step.payload.from}
          to={step.payload.to}
          shown={shown}
          reduced={reduced}
          suffix={step.payload.suffix}
          verdict={step.payload.verdict}
          tone={step.payload.tone === "risk" ? "risk" : "good"}
        />
      );

    case "rank":
      return <RankTable payload={step.payload} reduced={reduced} />;

    case "approve": {
      const approved = step.payload.state === "approved";
      return (
        <div
          className={cn(
            "rounded-xl border p-3.5 transition-colors duration-300",
            approved
              ? "border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/[0.06]"
              : "border-[var(--mkt-line)] bg-[var(--mkt-surface-2)]"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  approved
                    ? "border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]"
                    : "border-[var(--mkt-line)] bg-[var(--mkt-surface)] text-[var(--mkt-muted)]"
                )}
                aria-hidden
              >
                {approved ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <CircleDashed className="size-3.5" />
                )}
              </span>
              <div>
                <p className="text-[14.5px] font-medium leading-snug text-[var(--mkt-ink)]">
                  {step.payload.label}
                </p>
                {step.payload.note && (
                  <p className="mt-1 text-[13px] leading-snug text-[var(--mkt-muted)]">
                    {step.payload.note}
                  </p>
                )}
              </div>
            </div>

            {/* Inert by design: this is a picture of the control, not the
                control. The working approval flow is the guided demo. */}
            {!approved && (
              <div className="flex shrink-0 gap-2" aria-hidden>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--mkt-brand)] px-3.5 text-[12.5px] font-medium text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                  Approve
                </span>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-3.5 text-[12.5px] font-medium text-[var(--mkt-ink)]">
                  <Pencil className="size-3" />
                  Edit
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }

    case "recommend":
      return (
        <div className="rounded-xl border border-[var(--mkt-brand)]/30 bg-[var(--mkt-brand-wash)] p-3.5">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-[var(--mkt-brand-deep)]">
            Next best action
          </p>
          <p className="mt-1.5 text-[15px] font-medium leading-snug text-[var(--mkt-ink)]">
            {step.payload.headline}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-snug text-[var(--mkt-muted)]">
            {step.payload.why}
          </p>
          <ul className="mt-2 space-y-0.5">
            {step.payload.evidence.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-[13px] leading-snug text-[var(--mkt-muted)]"
              >
                <Check
                  className="mt-[3px] size-2.5 shrink-0 text-[var(--mkt-brand)]"
                  strokeWidth={3}
                  aria-hidden
                />
                {line}
              </li>
            ))}
          </ul>
          {step.payload.atStake != null && (
            <p className="mt-2.5 border-t border-[var(--mkt-brand)]/20 pt-2.5 text-[13px] font-medium text-[var(--mkt-ink)]">
              {formatMoney(step.payload.atStake, "USD")} of expected revenue at stake
            </p>
          )}
        </div>
      );

    case "execute": {
      const sent = step.payload.state === "sent";
      const approved = step.payload.state === "approved";
      return (
        <Row
          icon={
            approved || sent ? (
              <Check className="size-3" strokeWidth={3} />
            ) : (
              <CircleDashed className="size-3" />
            )
          }
          tone={approved || sent ? "good" : "neutral"}
          title={step.payload.label}
          detail={
            step.payload.state === "awaiting"
              ? "Nothing sends without a human"
              : undefined
          }
        />
      );
    }

    case "response":
      return (
        <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] p-4">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
            {step.payload.who ?? "Customer"} replied
          </p>
          {step.payload.quote && (
            <p className="mt-2 text-[15px] italic leading-snug text-[var(--mkt-ink)]">
              &ldquo;{step.payload.quote}&rdquo;
            </p>
          )}
        </div>
      );

    case "outcome":
      if (step.payload.stageFrom && step.payload.stageTo) {
        return (
          <Row
            icon={<Check className="size-3" strokeWidth={3} />}
            tone="good"
            title={step.payload.label}
            detail={`${step.payload.stageFrom} → ${step.payload.stageTo}`}
          />
        );
      }
      if (step.payload.metric && step.payload.from != null && step.payload.to != null) {
        return (
          <MetricRow
            label={step.payload.metric}
            from={step.payload.from}
            to={step.payload.to}
            shown={shown}
            reduced={reduced}
            prefix={step.payload.prefix}
            tone="good"
          />
        );
      }
      return (
        <Row
          icon={<Check className="size-3" strokeWidth={3} />}
          tone="good"
          title={step.payload.label}
        />
      );
  }
}

/**
 * The ranked pipeline, as a table.
 *
 * Shows deal value, win probability and expected revenue side by side so the
 * reordering claim is checkable rather than asserted: Brightcart is visibly
 * the larger deal and visibly ranks below Cloudmint.
 */
function RankTable({
  payload,
  reduced,
}: {
  payload: { order: string[]; highlight?: string; caption?: string };
  reduced: boolean;
}) {
  const rows = payload.order
    .map((company) => DEMO_DEALS.find((d) => d.company === company))
    .filter((d): d is (typeof DEMO_DEALS)[number] => Boolean(d));

  return (
    <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-1">
      {payload.caption && (
        <p className="px-3 pb-1 pt-2 text-[11.5px] font-medium uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
          {payload.caption}
        </p>
      )}

      <div className="grid grid-cols-[1.6fr_1fr_0.8fr_1.1fr] gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mkt-muted)]">
        <span>Opportunity</span>
        <span className="text-right">Deal value</span>
        <span className="text-right">Win</span>
        <span className="text-right">Expected</span>
      </div>

      <ul>
        {rows.map((d, i) => {
          const lead = d.company === payload.highlight;
          return (
            <li
              key={d.company}
              className={cn(
                "grid grid-cols-[1.6fr_1fr_0.8fr_1.1fr] items-center gap-2 rounded-lg px-3 py-2.5 text-[13.5px] tabular-nums",
                // Rows re-key on their position so a reorder re-runs the
                // entrance; movement is opacity only, never height.
                !reduced && "animate-fade-up",
                lead
                  ? "bg-[var(--mkt-brand-wash)] font-medium text-[var(--mkt-ink)]"
                  : "text-[var(--mkt-muted)]"
              )}
              style={reduced ? undefined : { animationDelay: `${i * 60}ms` }}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="font-mono text-[11.5px] text-[var(--mkt-muted)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate text-[var(--mkt-ink)]">{d.company}</span>
                {lead && (
                  <ArrowUp
                    className="size-3.5 shrink-0 text-[var(--mkt-brand)]"
                    aria-hidden
                  />
                )}
              </span>
              <span className="text-right">{formatMoney(d.dealValue, "USD")}</span>
              <span className="text-right">{d.probability}%</span>
              <span
                className={cn(
                  "text-right",
                  lead && "font-medium text-[var(--mkt-brand-deep)]"
                )}
              >
                {formatMoney(d.expected, "USD")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const TONE_MARK = {
  good: "border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]",
  risk: "border-[var(--mkt-warn)]/30 bg-[var(--mkt-warn)]/10 text-[var(--mkt-warn-ink)]",
  accent: "border-[var(--mkt-brand)]/30 bg-[var(--mkt-brand)]/10 text-[var(--mkt-brand-deep)]",
  neutral: "border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-muted)]",
} as const;

function Row({
  icon,
  tone,
  title,
  detail,
  meta,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONE_MARK;
  title: string;
  detail?: string;
  meta?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-[1px] flex size-6 shrink-0 items-center justify-center rounded-full border",
          TONE_MARK[tone]
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[14.5px] leading-snug text-[var(--mkt-ink)]">{title}</p>
          {meta && (
            <span className="shrink-0 text-[12.5px] tabular-nums text-[var(--mkt-muted)]">
              {meta}
            </span>
          )}
        </div>
        {detail && (
          <p className="mt-1 text-[13px] leading-snug text-[var(--mkt-muted)]">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A number moving. The count-up only starts once the step has landed, so the
 * old value is visible first and the change reads as a recalculation rather
 * than a figure that was always there.
 */
function MetricRow({
  label,
  from,
  to,
  shown,
  reduced,
  prefix,
  suffix,
  verdict,
  tone,
}: {
  label: string;
  from: number;
  to: number;
  shown: boolean;
  reduced: boolean;
  prefix?: string;
  suffix?: string;
  verdict?: string;
  tone: "good" | "risk";
}) {
  const value = useCountUp(shown ? to : from, { reduced });
  const display = prefix === "$" ? formatMoney(value, "USD") : `${value}${suffix ?? ""}`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
          {label}
        </p>
        {verdict && shown && (
          <p
            className={cn(
              "mt-1 text-[13px] font-medium",
              tone === "risk" ? "text-[var(--mkt-warn-ink)]" : "text-[var(--mkt-success)]"
            )}
          >
            {verdict}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[30px] font-medium tabular-nums leading-none tracking-tight text-[var(--mkt-ink)]">
        {display}
      </span>
    </div>
  );
}

/**
 * The running commentary. Fixed height so the closing line replacing the
 * status line cannot shift the panel by a row.
 */
function StageFooter({
  status,
  closing,
  complete,
}: {
  status?: string;
  closing: string;
  complete: boolean;
}) {
  return (
    <div className="mt-3 flex min-h-[30px] items-center border-t border-[var(--mkt-line)] pt-2.5">
      <p
        aria-live="polite"
        className={cn(
          "text-[13px] leading-snug transition-colors duration-300",
          complete
            ? "font-medium text-[var(--mkt-ink)]"
            : "text-[var(--mkt-muted)]"
        )}
      >
        {complete ? closing : (status ?? "Monitoring…")}
      </p>
    </div>
  );
}
