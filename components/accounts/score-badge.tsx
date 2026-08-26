import { cn } from "@/lib/utils";

function tone(score: number) {
  if (score >= 70) return "bg-emerald-50 text-emerald-700";
  if (score >= 40) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export function ScoreBadge({
  label,
  score,
}: {
  label: "Fit" | "Intent";
  score: number | null;
}) {
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        {label} —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone(score)
      )}
    >
      {label} {score}
    </span>
  );
}
