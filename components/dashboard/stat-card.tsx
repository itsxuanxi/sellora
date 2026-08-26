import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-md hover:shadow-primary/5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent">
          <Icon className="size-4 text-accent-foreground" />
        </div>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {trend && (
          <span
            className={cn(
              "flex items-center gap-1 font-medium",
              trend.positive ? "text-emerald-600" : "text-rose-500"
            )}
          >
            {trend.positive ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {trend.value}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

export function AiScoreCard({ score }: { score: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - score / 100);
  const grade =
    score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 50 ? "Warming up" : "Getting started";

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-md hover:shadow-primary/5">
      <div className="relative">
        <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="8"
          />
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold">
          {score}
        </span>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">AI Performance Score</div>
        <div className="mt-1 text-lg font-semibold">{grade}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Blends reply rate, open rate, and follow-up discipline.
        </p>
      </div>
    </div>
  );
}
