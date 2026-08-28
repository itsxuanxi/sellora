"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/revenue/money";
import type { PriorityRow } from "@/lib/revenue/priority-row";

/**
 * Today's priorities — the one screen this product is about.
 *
 * The ranking is the recommendation: work this list top-down and the next
 * hour of selling time is spent where it is worth the most. The arithmetic
 * behind that ranking is shown as a column rather than asserted, because a
 * rank a rep cannot check is a rank they will not trust.
 *
 * The live workspace and the guided demo both render this component, so what
 * a visitor learns in the demo is literally the screen they get after signing
 * in. Any change to the design happens here, once.
 */
export function PriorityTable({
  rows,
  onSelect,
  interactiveIds,
}: {
  rows: PriorityRow[];
  /** Demo only: rows are buttons driving local state instead of links. */
  onSelect?: (id: string) => void;
  /** Demo only: the subset of rows that can be opened. */
  interactiveIds?: string[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="hidden grid-cols-[2.2fr_1fr_1fr_1.2fr_1fr] gap-3 border-b border-border/70 bg-muted/40 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid">
        <span>Opportunity</span>
        <span className="text-right">Deal value</span>
        <span className="text-right">Win prob.</span>
        <span className="text-right">Expected revenue</span>
        <span className="text-right">Last activity</span>
      </div>

      <ul>
        {rows.map((row, i) => {
          const openable = interactiveIds
            ? interactiveIds.includes(row.id)
            : Boolean(row.href);

          const body = <RowBody row={row} rank={i + 1} />;

          const shared = cn(
            "block w-full border-b border-border/60 px-5 py-4 text-left transition-colors last:border-b-0",
            openable
              ? "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              : "cursor-not-allowed opacity-55"
          );

          return (
            <li key={row.id}>
              {openable && row.href ? (
                <Link
                  href={row.href}
                  data-demo-target={row.demoTarget}
                  className={shared}
                >
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  data-demo-target={row.demoTarget}
                  disabled={!openable}
                  onClick={openable ? () => onSelect?.(row.id) : undefined}
                  aria-label={
                    openable
                      ? `Open ${row.company} — ${formatMoney(row.dealValue, row.currency)}`
                      : `${row.company} cannot be opened here`
                  }
                  className={shared}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RowBody({ row, rank }: { row: PriorityRow; rank: number }) {
  return (
    <div className="grid gap-2 md:grid-cols-[2.2fr_1fr_1fr_1.2fr_1fr] md:items-center md:gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-[12px] tabular-nums text-muted-foreground">
          {String(rank).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium">{row.company}</span>
            {row.needsAttention && (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-rose-600 dark:text-rose-400">
                Needs attention
              </span>
            )}
          </div>
          {/* Why now — the single most important line in the product. */}
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
            {row.stage} · {row.note}
          </p>
        </div>
      </div>

      <Cell label="Deal value" value={formatMoney(row.dealValue, row.currency)} />
      <Cell label="Win prob." value={`${row.winProbability}%`} />
      <Cell
        label="Expected revenue"
        value={formatMoney(row.expected, row.currency)}
        strong
      />
      <Cell label="Last activity" value={row.lastActivity} muted />
    </div>
  );
}

function Cell({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 md:block md:text-right">
      <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground md:hidden">
        {label}
      </span>
      <span
        className={cn(
          "text-[14px] tabular-nums",
          strong ? "font-medium text-foreground" : muted ? "text-muted-foreground" : ""
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The one line of context under the table: what is leaking, and how big the
 * board is. Everything a stat-tile grid used to say, in a sentence — because
 * five tiles compete with the ranking for the reader's first glance and the
 * ranking is what they came for.
 */
export function PipelineSummary({
  items,
}: {
  items: {
    label: string;
    value: string;
    tone?: "critical" | "neutral";
    href?: string;
  }[];
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-border/70 bg-card px-5 py-4">
      {items.map((item) => {
        const value = (
          <span
            className={cn(
              "mt-0.5 block text-[17px] font-medium tabular-nums",
              item.tone === "critical" ? "text-rose-600 dark:text-rose-400" : ""
            )}
          >
            {item.value}
          </span>
        );
        const label = (
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {item.label}
          </span>
        );

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="group rounded-md transition-opacity hover:opacity-80"
          >
            {label}
            {value}
          </Link>
        ) : (
          <div key={item.label}>
            {label}
            {value}
          </div>
        );
      })}
    </div>
  );
}
