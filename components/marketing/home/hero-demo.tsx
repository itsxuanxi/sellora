"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/revenue/money";
import { useAutoRotate } from "@/components/marketing/home/use-auto-rotate";
import { StackedPanels, TabStrip } from "@/components/marketing/home/tab-strip";
import {
  COMMAND,
  DEMO_DATA_NOTE,
  DEMO_DEALS,
  DEMO_STAGES,
  MONITORING,
  NEXT_ACTION,
  PRIORITIZATION,
  STAGE_DURATION_MS,
} from "@/components/marketing/home/demo-data";

/**
 * Screen 1's product surface: four stages of one continuous piece of work on
 * one deal — Cloudmint is detected, ranked, acted on, then rolled up — so the
 * hero shows Sellora working rather than four unrelated screenshots.
 *
 * All rotation behaviour (single timer, hover/visibility/viewport pause,
 * keyboard, reduced motion) lives in useAutoRotate. This file is only the
 * layout and the four panel bodies.
 */

const TONE_TEXT = {
  high: "text-violet-300",
  rising: "text-sky-300",
  risk: "text-rose-300",
} as const;

const TONE_DOT = {
  high: "bg-violet-400",
  rising: "bg-sky-400",
  risk: "bg-rose-400",
} as const;

const PRIORITY_STYLE = {
  urgent: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  warn: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  watch: "border-white/[0.12] bg-white/[0.04] text-neutral-300",
} as const;

const IDS = DEMO_STAGES.map((s) => s.id);
const LABELS = DEMO_STAGES.map((s) => s.tabLabel);

export function HeroDemo() {
  const rotate = useAutoRotate(DEMO_STAGES.length, STAGE_DURATION_MS);
  const baseId = useId();

  return (
    <div ref={rotate.containerRef} {...rotate.hoverProps} className="w-full">
      <TabStrip
        rotate={rotate}
        labels={LABELS}
        ids={IDS}
        baseId={baseId}
        ariaLabel="Sellora product walkthrough"
      />

      <StackedPanels
        ids={IDS}
        baseId={baseId}
        active={rotate.active}
        className="overflow-hidden rounded-xl border border-white/[0.10] bg-[#101014] shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)]"
        render={(id, i, selected) => (
          <PanelChrome label={DEMO_STAGES[i].panelLabel} live={id === "monitoring"}>
            {id === "monitoring" && <MonitoringPanel active={selected} />}
            {id === "prioritization" && <PrioritizationPanel />}
            {id === "action" && <ActionPanel />}
            {id === "command" && <CommandPanel />}
          </PanelChrome>
        )}
      />
    </div>
  );
}

// ── Shared chrome ──────────────────────────────────────────────────────────

function PanelChrome({
  label,
  live,
  children,
}: {
  label: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </span>
        <span className="truncate text-[11px] font-medium tracking-[0.05em] text-neutral-300">
          {label}
        </span>
        {live && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-neutral-300">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400/70 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-violet-400" />
            </span>
            Live
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-3.5 sm:px-5">{children}</div>

      <div className="border-t border-white/[0.08] px-4 py-2 sm:px-5">
        <span className="text-[10px] text-neutral-400">{DEMO_DATA_NOTE}</span>
      </div>
    </div>
  );
}

function StatusLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.11em] text-neutral-400">
      {children}
    </p>
  );
}

// ── Stage 1 ────────────────────────────────────────────────────────────────

function MonitoringPanel({ active }: { active: boolean }) {
  return (
    <div>
      <StatusLine>{MONITORING.status}</StatusLine>

      {/* Keyed on `active` so the stagger replays each time the stage comes
          round. `fade-up` animates opacity and translate only — never height —
          so replaying it cannot disturb the panel's size. */}
      <ul key={active ? "on" : "off"} className="space-y-2">
        {DEMO_DEALS.map((d, i) => (
          <li
            key={d.company}
            className={cn(
              "rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5",
              active && "animate-fade-up"
            )}
            style={active ? { animationDelay: `${i * 110}ms` } : undefined}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-white">{d.company}</span>
              <span className={cn("flex items-center gap-1.5 text-[11px]", TONE_TEXT[d.readoutTone])}>
                <span className={cn("size-1.5 rounded-full", TONE_DOT[d.readoutTone])} aria-hidden />
                {d.readoutLabel}: {d.readoutValue}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {d.signals.map((s) => (
                <span
                  key={s}
                  className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-neutral-300"
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-400">{d.status}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Stage 2 ────────────────────────────────────────────────────────────────

function PrioritizationPanel() {
  return (
    <div>
      <StatusLine>{PRIORITIZATION.status}</StatusLine>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-b border-white/[0.08] text-left">
              {["", "Account", "Deal value", "Close", "Expected", "Priority"].map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className={cn(
                    "pb-2 text-[10px] font-medium uppercase tracking-[0.09em] text-neutral-400",
                    i >= 2 && i <= 4 && "text-right"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {DEMO_DEALS.map((d) => (
              <tr key={d.company}>
                <td className="py-2.5 pr-2 text-[11px] tabular-nums text-neutral-400">
                  {d.rank}
                </td>
                <td className="py-2.5 pr-2 text-[13px] font-medium text-white">
                  {d.company}
                </td>
                <td className="py-2.5 pr-2 text-right text-[12px] tabular-nums text-neutral-200">
                  {formatMoney(d.dealValue)}
                </td>
                <td className="py-2.5 pr-2 text-right text-[12px] tabular-nums text-neutral-300">
                  {d.probability}%
                </td>
                <td className="py-2.5 pr-2 text-right text-[13px] font-medium tabular-nums text-violet-200">
                  {formatMoney(d.expected)}
                </td>
                <td className="py-2.5 text-right">
                  <span
                    className={cn(
                      "inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]",
                      PRIORITY_STYLE[d.priorityTone]
                    )}
                  >
                    {d.priority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 border-t border-white/[0.08] pt-2.5 text-[11px] text-neutral-400">
        {PRIORITIZATION.formula}
      </p>
    </div>
  );
}

// ── Stage 3 ────────────────────────────────────────────────────────────────

function ActionPanel() {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-white">{NEXT_ACTION.company}</span>
        <span className="text-[12px] text-neutral-400">
          Expected revenue{" "}
          <span className="font-medium tabular-nums text-violet-200">
            {formatMoney(NEXT_ACTION.expected)}
          </span>
        </span>
      </div>

      <div className="mt-3">
        <StatusLine>Why now</StatusLine>
        <ul className="space-y-1">
          {NEXT_ACTION.whyNow.map((r) => (
            <li key={r} className="flex gap-2 text-[12px] leading-snug text-neutral-200">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-violet-400" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-md border border-violet-400/20 bg-violet-400/[0.06] px-2.5 py-2">
        <span className="text-[12px] font-medium leading-snug text-violet-100">
          {NEXT_ACTION.action}
        </span>
      </div>

      {/* Draft awaiting approval — never shown as sent. */}
      <div className="mt-3 rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5">
        <div className="text-[10px] uppercase tracking-[0.09em] text-neutral-400">
          Draft · awaiting your approval
        </div>
        <p className="mt-1 truncate text-[12px] font-medium text-neutral-100">
          {NEXT_ACTION.draft.subject}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-neutral-300">
          {NEXT_ACTION.draft.body}
        </p>
      </div>

      {/* Rendered as non-focusable spans: this is a picture of the product,
          not a live control, so it must not enter the tab order. */}
      <div className="mt-3 flex flex-wrap items-center gap-2" aria-hidden>
        <span className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-neutral-200">
          Review message
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-black">
          Approve and send
        </span>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">{NEXT_ACTION.approvalNote}</p>
    </div>
  );
}

// ── Stage 4 ────────────────────────────────────────────────────────────────

function CommandPanel() {
  const max = Math.max(...COMMAND.trend);
  const pts = COMMAND.trend
    .map((v, i) => {
      const x = (i / (COMMAND.trend.length - 1)) * 100;
      const y = 30 - (v / max) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {COMMAND.metrics.map((m) => (
          <div key={m.label}>
            <div className="text-[10px] font-medium uppercase tracking-[0.09em] text-neutral-400">
              {m.label}
            </div>
            <div
              className={cn(
                "mt-0.5 text-lg font-medium tabular-nums tracking-tight",
                m.tone === "risk"
                  ? "text-rose-300"
                  : m.tone === "accent"
                    ? "text-violet-200"
                    : "text-white"
              )}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 border-t border-white/[0.08] pt-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.09em] text-neutral-400">
          Expected revenue trend
        </div>
        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          className="mt-1.5 h-9 w-full"
          role="img"
          aria-label="Expected revenue trending upward over the last twelve weeks"
        >
          <polyline
            points={pts}
            fill="none"
            stroke="rgb(167 139 250)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <dl className="mt-2 grid grid-cols-3 gap-3 border-t border-white/[0.08] pt-2.5">
        {COMMAND.breakdown.map((b) => (
          <div key={b.label}>
            <dt className="text-[10px] leading-tight text-neutral-400">{b.label}</dt>
            <dd
              className={cn(
                "mt-0.5 text-[15px] font-medium tabular-nums",
                b.tone === "up"
                  ? "text-emerald-300"
                  : b.tone === "down"
                    ? "text-rose-300"
                    : "text-neutral-100"
              )}
            >
              {b.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 rounded-md border border-violet-400/20 bg-violet-400/[0.06] px-2.5 py-2 text-[12px] leading-snug text-violet-100">
        {COMMAND.insight}
      </p>
    </div>
  );
}
