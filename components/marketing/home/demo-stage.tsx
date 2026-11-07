"use client";

import {
  ArrowUp,
  Check,
  CircleDashed,
  Pencil,
  Radio,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/revenue/money";
import { useCountUp } from "@/components/marketing/home/use-count-up";
import {
  DEMO_DEALS,
  railProgress,
  type DemoStep,
  type HeroScenario,
  type ScenarioRail,
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
      <StageHeader scenario={scenario} />

      {/* Two zones, and this is the whole difference between a product shot
          and a process diagram: the left column is Selryn doing the work, the
          right is the record that work lands in. A feed on its own reads as a
          list of sentences no matter how good the sentences are — software is
          recognisable by having a structured side where named fields resolve.

          grid-rows-[minmax(0,1fr)] is load-bearing: the implicit row would
          otherwise size to content and let the feed push the footer out of the
          bottom of the fixed-height panel.

          The rail is desktop-only. At phone widths there is not enough room
          for two columns, and stacking it below the feed would double the
          panel height for a secondary surface. */}
      <div className="mt-3.5 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-x-5 lg:grid-cols-[minmax(0,1fr)_206px]">
        {/* overflow-hidden is a guard, not the layout: a step list that outgrows
            its track would otherwise paint straight over the footer beneath it
            rather than being contained. The panel height is sized so this never
            fires, and clipping is the safe failure if content ever grows. */}
        <ol className="min-h-0 space-y-2 overflow-hidden">
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

        <RecordRail rail={scenario.rail} revealed={revealed} reduced={reduced} />
      </div>

      <StageFooter
        status={status}
        closing={scenario.closing}
        complete={complete}
      />
    </div>
  );
}

/**
 * The record header.
 *
 * Account name and owner on the left, the money on the right at display size.
 * That asymmetry is what a record view looks like in every CRM ever shipped,
 * and it is the fastest way for a visitor scanning a screenshot to work out
 * that they are looking at one deal rather than a marketing panel: the figure
 * is the largest thing in the frame and it is attached to a name.
 */
function StageHeader({ scenario }: { scenario: HeroScenario }) {
  const { company, dealValue, stage, owner, amountLabel } = scenario.subject;
  const amount = dealValue > 0 ? formatMoney(dealValue, "USD") : amountLabel;

  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--mkt-line)] pb-3">
      <div className="min-w-0">
        <h3 className="truncate text-[19px] font-medium leading-tight tracking-[-0.01em] text-[var(--mkt-ink)]">
          {company}
        </h3>
        <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
          {owner ?? "Unassigned"}
          <span className="mx-1.5 text-[var(--mkt-line)]" aria-hidden>
            ·
          </span>
          {stage}
        </p>
      </div>

      {amount && (
        <div className="shrink-0 text-right">
          <p className="text-[22px] font-medium leading-none tabular-nums tracking-[-0.01em] text-[var(--mkt-ink)]">
            {amount}
          </p>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
            {dealValue > 0 ? "Deal value" : "Open value"}
          </p>
        </div>
      )}
      {/* No second Live badge: the panel's status bar above already carries
          one, and two of them a centimetre apart read as a rendering bug. */}
    </div>
  );
}

/**
 * The structured half of the panel: named fields resolving one at a time, and
 * a completeness figure underneath.
 *
 * Rows are keyed by the product's own machine field names — `deal_value`,
 * `win_probability` — rather than sentence-case labels. A reader recognises
 * those instantly as data a system holds rather than copy a designer wrote,
 * which is the entire job of this column.
 *
 * A field that has not resolved yet is a dashed outline holding its space, so
 * the rail never grows or reflows as the scenario runs: the record is visibly
 * the same shape from the first frame, filling in.
 */
function RecordRail({
  rail,
  revealed,
  reduced,
}: {
  rail: ScenarioRail;
  revealed: number;
  reduced: boolean;
}) {
  const progress = railProgress(rail, revealed);
  const metered = revealed >= rail.meter.after;

  return (
    <aside className="hidden min-h-0 flex-col border-l border-[var(--mkt-line)] pl-5 lg:flex">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
          {rail.label}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums tracking-[0.06em] text-[var(--mkt-ink)]">
          {progress.label}
        </span>
      </div>

      <ul className="mt-2.5 min-h-0 flex-1 space-y-1 overflow-hidden">
        {rail.fields.map((field) => {
          const done = revealed >= field.after;
          return (
            <li
              key={field.key}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1",
                !reduced && "transition-colors duration-500",
                done
                  ? "border-[var(--mkt-line)] bg-[var(--mkt-surface)]"
                  : "border-dashed border-[var(--mkt-line)] bg-transparent"
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  !done
                    ? "bg-[var(--mkt-line)]"
                    : field.tone === "risk"
                      ? "bg-[var(--mkt-warn)]"
                      : field.tone === "pending"
                        ? "bg-[var(--mkt-line)]"
                        : "bg-[var(--mkt-success)]"
                )}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[9.5px] lowercase tracking-[0.06em] text-[var(--mkt-muted)]">
                  {field.key}
                </p>
                <p
                  className={cn(
                    "truncate text-[12px] font-medium leading-tight",
                    done ? "text-[var(--mkt-ink)]" : "text-transparent"
                  )}
                >
                  {/* The value is rendered even while unresolved, in
                      transparent ink. That reserves its exact height, so a row
                      resolving cannot nudge the six rows below it. */}
                  {field.value}
                </p>
              </div>

              {/* A resolved field is not automatically a good one. A green
                  tick beside "last_reply · 4 days ago" says the silence is
                  fine, which is the exact opposite of why the row is there. */}
              <span
                className={cn(
                  "shrink-0",
                  !done
                    ? "text-[var(--mkt-line)]"
                    : field.tone === "risk"
                      ? "text-[var(--mkt-warn-ink)]"
                      : field.tone === "pending"
                        ? "text-[var(--mkt-line)]"
                        : "text-[var(--mkt-success)]"
                )}
                aria-hidden
              >
                {!done || field.tone === "pending" ? (
                  <span className="block size-2.5 rounded-full border border-current" />
                ) : field.tone === "risk" ? (
                  <TriangleAlert className="size-3" strokeWidth={2.5} />
                ) : (
                  <Check className="size-3" strokeWidth={3} />
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/* The completeness figure. Every product surface a buyer has ever used
          has one, and it is what turns a list of fields into a thing that is
          partway done. */}
      <div className="mt-3 border-t border-[var(--mkt-line)] pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.11em] text-[var(--mkt-muted)]">
            {rail.meter.label}
          </span>
          <span
            className={cn(
              "shrink-0 text-[15px] font-medium tabular-nums leading-none",
              metered ? "text-[var(--mkt-ink)]" : "text-[var(--mkt-muted)]/40"
            )}
          >
            {metered ? rail.meter.value : 0}%
          </span>
        </div>

        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--mkt-line)]"
          aria-hidden
        >
          <div
            className={cn(
              "h-full rounded-full",
              !reduced && "transition-[width] duration-[900ms] ease-out",
              rail.meter.tone === "risk"
                ? "bg-[var(--mkt-warn)]"
                : "bg-[var(--mkt-brand)]"
            )}
            style={{ width: `${metered ? rail.meter.value : 0}%` }}
          />
        </div>

        {/* Hidden rather than removed until the meter fills: "up from 64"
            printed beside a bar reading 0% is a sentence arguing with the
            number next to it. Opacity keeps the two lines of space reserved
            so the rail does not resize when it appears. */}
        <p
          className={cn(
            "mt-2 text-[10.5px] leading-snug text-[var(--mkt-muted)]",
            !reduced && "transition-opacity duration-500",
            metered ? "opacity-100" : "opacity-0"
          )}
        >
          {rail.meter.note}
        </p>
      </div>
    </aside>
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
            "rounded-xl border p-3 transition-colors duration-300",
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
                <p className="text-[13.5px] font-medium leading-snug text-[var(--mkt-ink)]">
                  {step.payload.label}
                </p>
                {step.payload.note && (
                  <p className="mt-0.5 text-[12px] leading-snug text-[var(--mkt-muted)]">
                    {step.payload.note}
                  </p>
                )}
              </div>
            </div>

            {/* Inert by design: this is a picture of the control, not the
                control. The working approval flow is the guided demo.

                Dropped on phones, where the pair wraps onto its own line and
                costs the panel ~36px it does not have. The card still says
                what it is waiting for, which is the part that carries the
                promise; the chips only illustrate it. */}
            {!approved && (
              <div className="hidden shrink-0 gap-2 sm:flex" aria-hidden>
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--mkt-brand)] px-3 text-[11.5px] font-medium text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                  Approve
                </span>
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-3 text-[11.5px] font-medium text-[var(--mkt-ink)]">
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
        <div className="rounded-xl border border-[var(--mkt-brand)]/30 bg-[var(--mkt-brand-wash)] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mkt-brand-deep)]">
            Recommended action
          </p>
          <p className="mt-1.5 text-[14px] font-medium leading-snug text-[var(--mkt-ink)]">
            {step.payload.headline}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-[var(--mkt-muted)]">
            {step.payload.why}
          </p>
          {/* On desktop the rail beside this card already lists the evidence,
              weighted and keyed — printing it twice a hand's width apart is
              the clearest possible way to look like filler. Below lg there is
              no rail, so the card carries it. */}
          <ul className="mt-2 space-y-0.5 lg:hidden">
            {step.payload.evidence.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-[12px] leading-snug text-[var(--mkt-muted)]"
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
          {/* The drafted message, shown as text a person edits rather than
              behind an Edit button that would not do anything here. */}
          {step.payload.draft && (
            <div className="mt-2.5 rounded-lg border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
                  Draft · editable before approval
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] font-medium text-[var(--mkt-ink)]">
                {step.payload.draft.subject}
              </p>
              <p className="mt-1 text-[12.5px] leading-snug text-[var(--mkt-muted)]">
                {step.payload.draft.body}
                {/* A caret, so the block reads as a text field mid-edit. */}
                <span
                  className="ml-0.5 inline-block h-[13px] w-px translate-y-[2px] bg-[var(--mkt-brand)] motion-safe:animate-pulse"
                  aria-hidden
                />
              </p>
            </div>
          )}
          {step.payload.atStake != null && (
            <p className="mt-2.5 border-t border-[var(--mkt-brand)]/20 pt-2.5 text-[13px] font-medium text-[var(--mkt-ink)]">
              {formatMoney(step.payload.atStake, "USD")} deal value, per your CRM
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
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
            {step.payload.who ?? "Customer"} replied
          </p>
          {step.payload.quote && (
            <p className="mt-1.5 text-[14px] italic leading-snug text-[var(--mkt-ink)]">
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
 * Shows deal value beside how long the buyer has been waiting and what the
 * risk is, so the reordering claim is checkable rather than asserted:
 * Brightcart is visibly the larger deal and visibly ranks below Cloudmint.
 *
 * The two columns this replaced were "Win" (a bare percentage) and
 * "Expected" (deal value times that percentage). They made the panel's
 * argument arithmetically, which was the problem — the percentage was an
 * uncalibrated stage baseline, so the money derived from it was an estimate
 * squared, and the table invited the reader to check the multiplication
 * rather than the premise. Days waiting and a named risk are both records.
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
        <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.11em] text-[var(--mkt-muted)]">
          {payload.caption}
        </p>
      )}

      <div className="grid grid-cols-[1.5fr_0.9fr_0.6fr_1fr] gap-2 px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--mkt-muted)] sm:grid-cols-[1.5fr_0.9fr_0.6fr_1fr_0.9fr]">
        <span>Opportunity</span>
        <span className="text-right">Deal value</span>
        <span className="text-right">Waiting</span>
        <span className="text-right">Reason</span>
        {/* The action is what makes a rank useful rather than merely sorted,
            but it is the first thing to drop when the panel gets narrow. */}
        <span className="hidden text-right sm:block">Do</span>
      </div>

      <ul>
        {rows.map((d, i) => {
          const lead = d.company === payload.highlight;
          return (
            <li
              key={d.company}
              className={cn(
                "grid grid-cols-[1.5fr_0.9fr_0.6fr_1fr] items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] tabular-nums sm:grid-cols-[1.5fr_0.9fr_0.6fr_1fr_0.9fr]",
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
              <span className="text-right">
                {d.waitingDays}d
              </span>
              <span
                className={cn(
                  "truncate text-right text-[11.5px]",
                  lead && "font-medium text-[var(--mkt-brand-deep)]"
                )}
              >
                {d.riskLabel}
              </span>
              <span
                className={cn(
                  "hidden text-right text-[11.5px] font-medium sm:block",
                  d.priorityTone === "urgent"
                    ? "text-[var(--mkt-danger)]"
                    : d.priorityTone === "warn"
                      ? "text-[var(--mkt-warn-ink)]"
                      : "text-[var(--mkt-muted)]"
                )}
              >
                {d.priority}
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
          <p className="text-[13.5px] leading-snug text-[var(--mkt-ink)]">{title}</p>
          {meta && (
            <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--mkt-muted)]">
              {meta}
            </span>
          )}
        </div>
        {detail && (
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--mkt-muted)]">
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-3.5 py-3">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
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
      <span className="shrink-0 text-[26px] font-medium tabular-nums leading-none tracking-tight text-[var(--mkt-ink)]">
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
