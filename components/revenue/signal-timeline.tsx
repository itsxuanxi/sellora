import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Chronological buying-signal timeline (§9).
 *
 * Grouped by day with behavioural signals visually distinguished from
 * firmographic ones — "they opened your proposal" and "they raised a Series
 * A" are both evidence, but only one of them is about a person choosing to
 * engage with you, and reps read them differently.
 */

export interface TimelineSignal {
  id: string;
  label: string;
  title: string;
  description?: string | null;
  evidence?: string | null;
  occurredAt: Date;
  family: "behavioural" | "firmographic";
  confidence?: string;
  sourceKind?: string | null;
}

function dayLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

export function SignalTimeline({
  signals,
  interpretation,
}: {
  signals: TimelineSignal[];
  /** Sellora's read on what the signals mean together. */
  interpretation?: string | null;
}) {
  if (signals.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No active buying signals. Connect a source under Integrations, or import
        signals, and they will appear here as they are detected.
      </p>
    );
  }

  const groups = new Map<string, TimelineSignal[]>();
  for (const s of signals) {
    const key = dayLabel(s.occurredAt);
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  return (
    <div>
      {interpretation && (
        <div className="mb-5 rounded-xl border border-primary/20 bg-accent/40 p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Sellora&rsquo;s interpretation
          </div>
          <p className="mt-1.5 text-sm font-medium">{interpretation}</p>
        </div>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([day, items]) => (
          <div key={day}>
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {day}
            </div>
            <ul className="mt-2.5 space-y-2.5 border-l border-border/70 pl-4">
              {items.map((s) => (
                <li key={s.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[21px] top-1.5 size-2 rounded-full ring-2 ring-background",
                      s.family === "behavioural" ? "bg-primary" : "bg-muted-foreground/50"
                    )}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format(s.occurredAt, "h:mm a")}
                    </span>
                    {s.sourceKind === "mock" && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        demo data
                      </span>
                    )}
                  </div>
                  {s.title && s.title !== s.label && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{s.title}</p>
                  )}
                  {s.evidence && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.evidence}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Turns a set of signals into one plain-English read. Rule-based, not
 * generated — so it can never assert something the evidence does not support.
 */
export function interpretSignals(
  signals: { family: string; occurredAt: Date; label: string }[],
  score: number | null
): string | null {
  if (signals.length === 0) return null;

  const now = Date.now();
  const recentBehavioural = signals.filter(
    (s) =>
      s.family === "behavioural" &&
      (now - s.occurredAt.getTime()) / (1000 * 60 * 60 * 24) <= 7
  );

  if (recentBehavioural.length >= 3)
    return "Strong purchase intent detected. Multiple buying actions in the last week — contact within 24 hours.";
  if (recentBehavioural.length === 2)
    return "Active evaluation underway. Two buying actions this week — worth a personal follow-up.";
  if (recentBehavioural.length === 1)
    return "Early interest. One buying action this week — keep the conversation warm.";
  if ((score ?? 0) >= 60)
    return "Company-level conditions look favourable, but nobody has engaged recently. Outreach is a cold start.";
  return "No recent buying activity. Signals here are company-level context, not intent.";
}
