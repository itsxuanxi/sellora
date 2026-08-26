import { cn } from "@/lib/utils";

/**
 * Product-interface primitives for the marketing page.
 *
 * These render the real product's visual language in static DOM — window
 * chrome, hairline-divided rows, tabular figures, risk dots — rather than a
 * marketing illustration. Everything is real text, so it stays sharp at any
 * zoom, reflows on mobile, and is readable by a screen reader.
 *
 * The data these render lives in demo-data.ts, which is the single source of
 * truth for every figure on the marketing page.
 */

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
