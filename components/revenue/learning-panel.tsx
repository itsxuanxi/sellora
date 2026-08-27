import { AlertCircle, GraduationCap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LEARNING_CAVEAT,
  type ActionEffectiveness,
  type LearningInsight,
  type LoopFunnel,
  type Measured,
  type SignalWinRate,
} from "@/lib/revenue/learning";

/**
 * What this workspace's own history shows — and, just as often, what it does
 * not yet show.
 *
 * The `Measured<T>` union means an under-sampled statistic arrives here with
 * no number attached, so "Insufficient data" is the only thing this component
 * *can* render for it. That is deliberate: a percentage computed from four
 * deals looks exactly as authoritative as one computed from four hundred, and
 * the difference is invisible once it is on screen.
 *
 * Every finding is phrased as co-occurrence. Reps choose which advice to act
 * on, so acted-on deals are a self-selected sample and no arrangement of
 * these numbers can establish cause.
 */

export function InsufficientData({
  have,
  need,
  what,
}: {
  have: number;
  need: number;
  what: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <p className="text-sm font-medium">Insufficient data</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {what} needs at least {need} records to say anything meaningful. You
          have {have}. Sellora will start reporting this once the loop has run
          enough times.
        </p>
      </div>
    </div>
  );
}

export function LoopFunnelPanel({ funnel }: { funnel: Measured<LoopFunnel> }) {
  if (!funnel.ok) {
    return (
      <InsufficientData
        have={funnel.have}
        need={funnel.need}
        what="Loop performance"
      />
    );
  }

  const rows = [
    { label: "Recommendations made", value: funnel.recommended, suffix: "" },
    { label: "Acted on", value: funnel.acceptanceRate, suffix: "%" },
    { label: "Actually executed", value: funnel.executionRate, suffix: "%" },
    { label: "Drew a customer reaction", value: funnel.responseRate, suffix: "%" },
    { label: "Deal moved forward", value: funnel.advanceRate, suffix: "%" },
    { label: "Draft rewritten before sending", value: funnel.editRate, suffix: "%" },
  ];

  return (
    <div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-border/70 bg-card p-4">
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {row.label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {row.value}
              {row.suffix}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{LEARNING_CAVEAT}</p>
    </div>
  );
}

export function InsightsList({ insights }: { insights: LearningInsight[] }) {
  if (insights.length === 0) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border bg-muted/30 p-4">
        <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-sm font-medium">No findings yet</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Findings appear once enough recommendations have been acted on and
            enough deals have closed for a pattern to be distinguishable from
            noise. Sellora will not guess before then.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {insights.map((insight) => (
        <li key={insight.id} className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-start gap-2.5">
            <TrendingUp className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium">{insight.headline}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {insight.detail}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Based on {insight.sample} records in your workspace.
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SignalWinRatePanel({
  data,
}: {
  data: Measured<{ baselineWinRate: number; closedDeals: number; rows: SignalWinRate[] }>;
}) {
  if (!data.ok) {
    return (
      <InsufficientData
        have={data.have}
        need={data.need}
        what="Signal-to-win-rate comparison"
      />
    );
  }

  if (data.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No individual signal appears on enough closed deals yet to compare
        against your {data.baselineWinRate}% baseline.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Baseline across all {data.closedDeals} closed deals:{" "}
        <span className="font-medium text-foreground">{data.baselineWinRate}%</span>
      </p>
      <ul className="divide-y divide-border/60">
        {data.rows.map((row) => {
          const delta = row.winRate - row.baselineWinRate;
          return (
            <li key={row.signalType} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm">{row.label}</div>
                <div className="text-xs text-muted-foreground">
                  {row.won} of {row.deals} closed deals won
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums">{row.winRate}%</div>
                <div
                  className={cn(
                    "text-xs tabular-nums",
                    delta > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : delta < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground"
                  )}
                >
                  {delta > 0 ? "+" : ""}
                  {delta} pts vs baseline
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{LEARNING_CAVEAT}</p>
    </div>
  );
}

export function ActionEffectivenessPanel({ rows }: { rows: ActionEffectiveness[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No action type has been executed enough times yet to report a reliable
        rate.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {rows.map((row) => (
        <li key={row.actionType} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm">{row.label}</div>
            <div className="text-xs text-muted-foreground">
              {row.positive} of {row.attempts} drew a reaction
            </div>
          </div>
          <div className="shrink-0 text-sm font-semibold tabular-nums">
            {row.positiveRate}%
          </div>
        </li>
      ))}
    </ul>
  );
}
