import { cn } from "@/lib/utils";
import {
  DIMENSION_LABELS,
  DIMENSION_MAX,
  type ScoreDimension,
} from "@/lib/revenue/config";
import { reconcileScore, scoreHeadline } from "@/lib/revenue/opportunity-score";

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
 * Full breakdown by the five dimensions, with a bar per dimension showing how
 * much of its available budget the deal earned.
 *
 * This component does no arithmetic. It used to: it re-summed the factor rows
 * and printed that sum against the dimension's cap, so a dimension whose
 * rules fired for more than its budget rendered as "29 / 25" — a figure that
 * cannot be true by the definition printed beside it — and the five
 * dimensions on screen did not add up to the headline score, because the
 * score was built from capped values and the breakdown from uncapped ones.
 *
 * Both numbers are real and both are now shown: what the rules found, and
 * what the cap allowed to count. The reader can see the score is bounded
 * rather than being handed a figure that quietly contradicts its own scale.
 */
export function ScoreBreakdown({
  factors,
  /** The stored score, when there is one, so the sum can be checked on screen. */
  total,
}: {
  factors: { dimension: string; ruleKey: string; label: string; points: number; reason: string }[];
  total?: number | null;
}) {
  const r = reconcileScore(factors);

  return (
    <div className="space-y-5">
      {r.dimensions.map((d) => {
        // A dimension with no rules fired is shown, not hidden. Dropping it
        // left a breakdown whose visible rows could not reach the total, and
        // gave a reader no way to tell "assessed, scored nothing" from "never
        // assessed" — the difference between a weak deal and an unknown one.
        const pct =
          d.max > 0 ? Math.max(0, Math.min(100, (d.contributed / d.max) * 100)) : 0;
        const negative = d.contributed < 0;

        return (
          <div key={d.dimension}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{d.label}</span>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  negative
                    ? "font-semibold text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground"
                )}
              >
                {d.contributed > 0 ? "+" : ""}
                {d.contributed}
                <span className="text-muted-foreground"> / {d.max}</span>
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

            {d.noEvidence ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No evidence recorded for this dimension yet — it contributes nothing
                rather than counting against the deal.
              </p>
            ) : (
              <>
                <ul className="mt-2 space-y-1">
                  {d.factors.map((f, i) => (
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

                {d.cappedBy > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    The rules above add to {d.raw}. {d.label} contributes at most{" "}
                    {d.max}, so {d.cappedBy} point{d.cappedBy === 1 ? "" : "s"} did not
                    count.
                  </p>
                )}
                {d.flooredBy > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    The penalties above add to {d.raw}. This dimension cannot fall
                    below {d.min}, so {d.flooredBy} point
                    {d.flooredBy === 1 ? "" : "s"} did not count.
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}

      {r.unknown.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">Other</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {r.unknown.reduce((r2, f) => r2 + f.points, 0)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Scored by a rule group this version no longer uses. Kept so the total
            still adds up; it will disappear when the deal is next rescored.
          </p>
        </div>
      )}

      {/* The sum, stated. A breakdown that does not visibly add up to the
          headline is a breakdown nobody can check. */}
      <div className="border-t border-border/70 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Total</span>
          <span className="text-sm font-semibold tabular-nums">
            {r.total}
            <span className="font-normal text-muted-foreground"> / 100</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The five contributions above add to {r.total}.
          {r.clampedBy !== 0 &&
            ` The components sum to ${r.subtotal}; the score is held within 0–100.`}
        </p>
        {total != null && total !== r.total && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            The stored score is {total}, which no longer matches these components —
            the deal has changed since it was last scored. Refresh to recompute.
          </p>
        )}
      </div>
    </div>
  );
}
