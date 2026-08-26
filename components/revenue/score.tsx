import { cn } from "@/lib/utils";
import {
  DIMENSION_LABELS,
  DIMENSION_MAX,
  type ScoreDimension,
} from "@/lib/revenue/config";
import { scoreHeadline } from "@/lib/revenue/opportunity-score";

/**
 * Score display. §5 is explicit: never show an unexplained AI score. So the
 * badge is never rendered alone in a detail context — it always sits next to
 * either the why-now reasons or the full dimension breakdown.
 */

const BAND_STYLES: Record<string, string> = {
  hot: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20",
  warm: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/20",
  cold: "bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20",
};

export function OpportunityScore({
  score,
  band,
  size = "sm",
  showLabel = false,
}: {
  score: number | null;
  band: string | null;
  size?: "sm" | "lg";
  showLabel?: boolean;
}) {
  if (score === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        Not scored
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{score}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <div
          className={cn(
            "mt-1.5 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
            BAND_STYLES[band ?? "cold"]
          )}
        >
          {scoreHeadline(score)}
        </div>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset tabular-nums",
        BAND_STYLES[band ?? "cold"]
      )}
    >
      {score}
      {showLabel && <span className="font-normal">{scoreHeadline(score)}</span>}
    </span>
  );
}

export function ConfidenceNote({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const style =
    confidence === "high"
      ? "text-emerald-700 dark:text-emerald-400"
      : confidence === "medium"
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <span className={cn("text-[11px] font-medium uppercase tracking-wide", style)}>
      {confidence} confidence
    </span>
  );
}

/**
 * The signed reason list. Positives and negatives are visually distinct
 * because "no follow-up in 3 days" is the actionable half of the score.
 */
export function WhyNow({
  reasons,
  className,
}: {
  reasons: string[];
  className?: string;
}) {
  if (reasons.length === 0) return null;
  return (
    <ul className={cn("space-y-1", className)}>
      {reasons.map((r, i) => {
        const negative = r.startsWith("−") || r.startsWith("-");
        const text = r.replace(/^[+−-]\s*/, "");
        return (
          <li key={i} className="flex gap-2 text-sm">
            <span
              className={cn(
                "select-none font-medium tabular-nums",
                negative
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
              aria-hidden
            >
              {negative ? "−" : "+"}
            </span>
            <span className="text-muted-foreground">{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Full breakdown by the five dimensions of §5, with a bar per dimension
 * showing how much of its available budget the deal earned.
 */
export function ScoreBreakdown({
  factors,
}: {
  factors: {
    dimension: string;
    ruleKey: string;
    label: string;
    points: number;
    reason: string;
  }[];
}) {
  const dimensions = Object.keys(DIMENSION_MAX) as ScoreDimension[];

  return (
    <div className="space-y-5">
      {dimensions.map((dim) => {
        const rows = factors.filter((f) => f.dimension === dim);
        if (rows.length === 0) return null;

        const subtotal = rows.reduce((s, f) => s + f.points, 0);
        const max = DIMENSION_MAX[dim];
        const pct = Math.max(0, Math.min(100, (subtotal / max) * 100));
        const negative = subtotal < 0;

        return (
          <div key={dim}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{DIMENSION_LABELS[dim]}</span>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  negative
                    ? "font-semibold text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground"
                )}
              >
                {subtotal > 0 ? "+" : ""}
                {subtotal}
                <span className="text-muted-foreground"> / {max}</span>
              </span>
            </div>

            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  negative ? "bg-rose-500" : "bg-primary"
                )}
                style={{ width: `${negative ? 100 : pct}%` }}
              />
            </div>

            <ul className="mt-2 space-y-1">
              {rows.map((f, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "shrink-0 font-medium tabular-nums",
                      f.points < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : f.points > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {f.points > 0 ? "+" : ""}
                    {f.points}
                  </span>
                  <span>{f.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
