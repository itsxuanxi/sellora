import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyCompact } from "@/lib/revenue/money";

/**
 * Money-first display primitives. §3 asks the dashboard to lead with money,
 * opportunities, urgency and actions — never vanity metrics — so every tile
 * here pairs a number with the thing a person would do about it.
 */

/**
 * The headline number. Deliberately the only element on the page at this
 * size: if a VP reads one thing, it should be what they are about to lose.
 */
export function RevenueAtRisk({
  amount,
  currency,
  opportunityCount,
  href = "/recover",
}: {
  amount: number;
  currency: string;
  opportunityCount: number;
  href?: string;
}) {
  const nothingAtRisk = amount === 0 || opportunityCount === 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 md:p-8">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            nothingAtRisk ? "bg-emerald-500" : "bg-rose-500"
          )}
          aria-hidden
        />
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Revenue at risk
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span
          className={cn(
            "text-4xl font-semibold tracking-tight tabular-nums md:text-5xl",
            nothingAtRisk ? "text-foreground" : "text-rose-600 dark:text-rose-400"
          )}
        >
          {formatMoney(amount, currency)}
        </span>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {nothingAtRisk ? (
          <>Nothing is leaking right now. Every open deal has been touched recently.</>
        ) : (
          <>
            {opportunityCount} opportunit{opportunityCount === 1 ? "y needs" : "ies need"}{" "}
            attention before they go cold.
          </>
        )}
      </p>

      {!nothingAtRisk && (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Open the recovery queue
          <ArrowUpRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

/** A compact metric tile. `tone` carries meaning, not decoration. */
export function StatTile({
  label,
  value,
  sublabel,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sublabel?: string;
  href?: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
}) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    critical: "text-rose-600 dark:text-rose-400",
  }[tone];

  const body = (
    <>
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", toneClass)}>
        {value}
      </div>
      {sublabel && (
        <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
      )}
    </>
  );

  const base = "rounded-xl border border-border/70 bg-card p-4";
  if (!href) return <div className={base}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(base, "block transition-colors hover:border-border hover:bg-muted/30")}
    >
      {body}
    </Link>
  );
}

/**
 * Inline money with an explicit expected-value breakdown. Used everywhere a
 * ranking is by expected revenue, so the ordering is never mysterious.
 */
export function ExpectedValue({
  dealValue,
  winProbability,
  expectedValue,
  currency,
  compact = false,
}: {
  dealValue: number;
  winProbability: number;
  expectedValue: number;
  currency: string;
  compact?: boolean;
}) {
  const fmt = compact ? formatMoneyCompact : formatMoney;
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="font-semibold tabular-nums">{fmt(expectedValue, currency)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {fmt(dealValue, currency)} × {winProbability}%
      </span>
    </span>
  );
}

/** Labels an estimated figure so a guess is never mistaken for a quote. */
export function EstimateNote({ basis }: { basis: string }) {
  if (basis === "user_entered") return null;
  return (
    <span className="text-[11px] text-muted-foreground">
      Estimated value — set it on the deal for accurate forecasting
    </span>
  );
}
