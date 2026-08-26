import { cn } from "@/lib/utils";

/**
 * Product-interface primitives for the marketing page.
 *
 * These render the real product's visual language in static DOM — window
 * chrome, hairline-divided rows, tabular figures, risk dots — rather than a
 * marketing illustration. Everything is real text, so it stays sharp at any
 * zoom, reflows on mobile, and is readable by a screen reader.
 *
 * All figures are illustrative sample data representing a fictional pipeline.
 * `DATA_NOTE` below is rendered wherever these appear so a visitor is never
 * led to believe they are looking at a customer's real numbers.
 */

export const DATA_NOTE = "Sample data shown for illustration";

/** Window chrome. `label` is the app-bar title, `meta` the right-hand slot. */
export function Panel({
  label,
  meta,
  children,
  className,
}: {
  label: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.10] bg-[#0B0B0F]",
        "shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)]",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </span>
        <span className="text-[11px] font-medium tracking-[0.06em] text-neutral-300">
          {label}
        </span>
        {meta && <span className="ml-auto">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

/** "Live" indicator — a slow pulse, pure CSS, stilled by reduced motion. */
export function LiveDot({ label = "Live" }: { label?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
      <span className="relative flex size-1.5" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400/70 motion-reduce:hidden" />
        <span className="relative inline-flex size-1.5 rounded-full bg-violet-400" />
      </span>
      {label}
    </span>
  );
}

export function RiskDot({ level }: { level: "high" | "medium" | "watch" }) {
  const style = {
    high: "bg-rose-400",
    medium: "bg-amber-400",
    watch: "bg-neutral-500",
  }[level];
  return <span className={cn("size-1.5 shrink-0 rounded-full", style)} aria-hidden />;
}

export function RiskLabel({ level }: { level: "high" | "medium" | "watch" }) {
  const map = {
    high: { text: "High risk", cls: "text-rose-300" },
    medium: { text: "Medium", cls: "text-amber-300" },
    watch: { text: "Watch", cls: "text-neutral-400" },
  }[level];
  return (
    <span className={cn("flex items-center gap-1.5 text-[11px]", map.cls)}>
      <RiskDot level={level} />
      {map.text}
    </span>
  );
}

/** A headline figure with its label. Used across the mock interfaces. */
export function MetricCell({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "risk" | "accent";
  hint?: string;
}) {
  const toneCls = {
    default: "text-white",
    risk: "text-rose-300",
    accent: "text-violet-300",
  }[tone];
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.11em] text-neutral-400">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-medium tabular-nums tracking-tight sm:text-2xl",
          toneCls
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

/** A signal chip — the evidence behind a recommendation. */
export function SignalChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-neutral-300">
      {children}
    </span>
  );
}

/**
 * The recommended-action strip. Visually distinct from evidence, because the
 * product's whole promise is that exactly one action follows from the data.
 */
export function ActionRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-violet-400/20 bg-violet-400/[0.06] px-2.5 py-2">
      <svg
        viewBox="0 0 16 16"
        className="mt-0.5 size-3 shrink-0 text-violet-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden
      >
        <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[12px] leading-snug text-violet-100">{children}</span>
    </div>
  );
}

// ── Sample pipeline ────────────────────────────────────────────────────────

export interface SampleDeal {
  rank: string;
  company: string;
  expected: string;
  dealValue: string;
  probability: string;
  risk: "high" | "medium" | "watch";
  signals: string[];
  silence: string;
  action: string;
  stage: string;
}

export const SAMPLE_DEALS: SampleDeal[] = [
  {
    rank: "01",
    company: "Cloudmint",
    expected: "$42,800",
    dealValue: "$61,000",
    probability: "70%",
    risk: "high",
    signals: ["Proposal opened twice", "New stakeholder joined"],
    silence: "No reply for 4 days",
    action: "Send a stakeholder-specific follow-up today",
    stage: "Proposal",
  },
  {
    rank: "02",
    company: "Brightcart",
    expected: "$31,200",
    dealValue: "$48,000",
    probability: "65%",
    risk: "medium",
    signals: ["Pricing page revisited", "Security document downloaded"],
    silence: "No reply for 2 days",
    action: "Schedule technical validation",
    stage: "Negotiation",
  },
  {
    rank: "03",
    company: "Northwind Labs",
    expected: "$28,400",
    dealValue: "$52,000",
    probability: "55%",
    risk: "medium",
    signals: ["Demo completed", "No next step scheduled"],
    silence: "Quiet for 6 days",
    action: "Get the next meeting on the calendar",
    stage: "Meeting",
  },
  {
    rank: "04",
    company: "Halcyon Data",
    expected: "$19,600",
    dealValue: "$34,000",
    probability: "58%",
    risk: "watch",
    signals: ["Replied to outreach", "Champion identified"],
    silence: "Contacted yesterday",
    action: "Wait — contacted recently, no new signals",
    stage: "Qualifying",
  },
];

/**
 * The Revenue Command Center — the hero's product surface.
 *
 * Information order mirrors the real app: money at stake first, then the
 * ranked list, then the evidence and the single recommended action for the
 * deal currently in focus.
 */
export function CommandCenterMock({ className }: { className?: string }) {
  const focus = SAMPLE_DEALS[0];

  return (
    <Panel
      label="Revenue Command Center"
      meta={<LiveDot />}
      className={className}
    >
      {/* ── Money bar ── */}
      <div className="grid grid-cols-3 gap-4 border-b border-white/[0.08] px-4 py-4 sm:px-5">
        <MetricCell label="Pipeline at risk" value="$184,200" tone="risk" />
        <MetricCell label="Expected revenue" value="$427,500" />
        <MetricCell label="Need attention" value="12" hint="opportunities" />
      </div>

      {/* ── Ranked list ── */}
      <div className="flex items-center justify-between px-4 pt-3 sm:px-5">
        <span className="text-[10px] font-medium uppercase tracking-[0.11em] text-neutral-400">
          Ranked by expected revenue
        </span>
        <span className="text-[10px] text-neutral-400">Deal value × probability</span>
      </div>

      <ul className="mt-1.5 divide-y divide-white/[0.06]">
        {SAMPLE_DEALS.map((deal, i) => {
          const expanded = i === 0;
          return (
            <li
              key={deal.company}
              className={cn("px-4 py-3 sm:px-5", expanded && "bg-white/[0.02]")}
            >
              <div className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-[11px] tabular-nums text-neutral-400">
                  {deal.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
                  {deal.company}
                </span>
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-white">
                  {deal.expected}
                </span>
                <span className="hidden w-20 shrink-0 justify-end sm:flex">
                  <RiskLabel level={deal.risk} />
                </span>
              </div>

              {/* Evidence line — always visible, this is the "why now" */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8">
                {deal.signals.map((s) => (
                  <SignalChip key={s}>{s}</SignalChip>
                ))}
                <span className="text-[11px] text-neutral-400">· {deal.silence}</span>
              </div>

              {/* ── Expanded detail for the focused deal ── */}
              {expanded && (
                <div className="mt-3 space-y-2.5 pl-8">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-neutral-400">
                    <span>
                      Deal value{" "}
                      <span className="tabular-nums text-neutral-200">
                        {focus.dealValue}
                      </span>
                    </span>
                    <span>
                      Probability{" "}
                      <span className="tabular-nums text-neutral-200">
                        {focus.probability}
                      </span>
                    </span>
                    <span>
                      Stage <span className="text-neutral-200">{focus.stage}</span>
                    </span>
                  </div>
                  <ActionRow>{focus.action}</ActionRow>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-white/[0.08] px-4 py-2 sm:px-5">
        <span className="text-[10px] text-neutral-400">{DATA_NOTE}</span>
      </div>
    </Panel>
  );
}
