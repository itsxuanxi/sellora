import { cn } from "@/lib/utils";
import { scoreBand } from "@/lib/intent/scoring";

const BAND_STYLES: Record<"hot" | "warm" | "cold", string> = {
  hot: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warm: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  cold: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function IntentScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        Not scored
      </span>
    );
  }
  const band = scoreBand(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        BAND_STYLES[band]
      )}
    >
      {score} Intent
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const style =
    confidence === "high"
      ? "text-emerald-700 dark:text-emerald-300"
      : confidence === "medium"
        ? "text-amber-700 dark:text-amber-300"
        : "text-muted-foreground";
  return (
    <span className={cn("text-[11px] font-medium uppercase tracking-wide", style)}>
      {confidence} confidence
    </span>
  );
}
