import { format, isToday, isYesterday } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Lightbulb,
  MessageSquare,
  Radio,
  Send,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineEvent, TimelineKind } from "@/lib/revenue/timeline";

/**
 * The closed loop, rendered as one stream.
 *
 *   Signal → Recommendation → Action → Response → Outcome
 *
 * Five tables, one column, strict reverse chronology. The alternative —
 * a panel per table — hides the only thing worth seeing: whether the
 * recommendation was followed, and whether the customer reacted. Those three
 * rows have to be adjacent or the reader has to do the join themselves.
 *
 * Events carry `causedBy` links from real foreign keys. Where a link exists
 * the row says so ("from the recommendation above"); where it does not, the
 * rows simply sit in time order. Nothing is inferred from timestamp proximity.
 */

const KIND_ICON: Record<TimelineKind, LucideIcon> = {
  signal: Radio,
  recommendation: Lightbulb,
  action: Send,
  response: MessageSquare,
  outcome: Trophy,
};

const KIND_LABEL: Record<TimelineKind, string> = {
  signal: "Signal",
  recommendation: "Recommendation",
  action: "Action",
  response: "Response",
  outcome: "Outcome",
};

function dayLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d yyyy");
}

/** The compact "where is this deal in the loop" strip. */
export function LoopStrip({
  stages,
}: {
  stages: { kind: TimelineKind; label: string; count: number; complete: boolean }[];
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {stages.map((stage, i) => {
        const Icon = KIND_ICON[stage.kind];
        return (
          <li key={stage.kind} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                stage.complete
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : "border-dashed border-border text-muted-foreground"
              )}
            >
              {stage.complete ? (
                <Icon className="size-3.5 text-primary" aria-hidden />
              ) : (
                <CircleDashed className="size-3.5" aria-hidden />
              )}
              {stage.label}
              {stage.count > 0 && (
                <span className="tabular-nums text-muted-foreground">{stage.count}</span>
              )}
            </span>
            {i < stages.length - 1 && (
              <ArrowRight className="size-3 shrink-0 text-muted-foreground/50" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function LoopTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Nothing recorded on this deal yet. Signals arrive from your connected
        sources; recommendations appear once Selryn has scored the
        opportunity.
      </p>
    );
  }

  // Group by day so the reader scans dates, not forty individual timestamps.
  const groups = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const key = dayLabel(e.at);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const byId = new Map(events.map((e) => [e.id, e]));

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([day, dayEvents]) => (
        <div key={day}>
          <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {day}
          </h3>
          <ol className="relative space-y-3 border-l border-border/70 pl-6">
            {dayEvents.map((event) => (
              <TimelineRow key={event.id} event={event} byId={byId} />
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function TimelineRow({
  event,
  byId,
}: {
  event: TimelineEvent;
  byId: Map<string, TimelineEvent>;
}) {
  const Icon = KIND_ICON[event.kind];
  const cause = event.causedBy?.map((id) => byId.get(id)).find(Boolean);

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[31px] flex size-5 items-center justify-center rounded-full border bg-background",
          event.tone === "positive"
            ? "border-emerald-300 text-emerald-600"
            : event.tone === "negative"
              ? "border-rose-300 text-rose-600"
              : "border-border text-muted-foreground"
        )}
        aria-hidden
      >
        <Icon className="size-3" />
      </span>

      <div className="rounded-xl border border-border/60 bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {KIND_LABEL[event.kind]}
          </span>
          <span className="text-sm font-medium">{event.label}</span>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
            {format(event.at, "HH:mm")}
          </span>
        </div>

        {event.title !== event.label && (
          <p className="mt-1.5 text-sm text-foreground/90">{event.title}</p>
        )}
        {event.detail && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {event.detail}
          </p>
        )}
        {event.evidence && (
          <p className="mt-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs text-foreground/80">
            {event.evidence}
          </p>
        )}

        {/* The causal link, shown only where a real foreign key backs it. */}
        {cause && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ArrowRight className="size-3 shrink-0" aria-hidden />
            Follows {KIND_LABEL[cause.kind].toLowerCase()}: {cause.label}
          </p>
        )}

        <MetaRow meta={event.meta} />
      </div>
    </li>
  );
}

/** Renders only the meta keys that actually have a value on this row. */
function MetaRow({ meta }: { meta?: Record<string, string | number | null> }) {
  if (!meta) return null;
  const entries = Object.entries(meta).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  if (entries.length === 0) return null;

  return (
    <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-1 text-[11px]">
          <dt className="text-muted-foreground">{humanKey(key)}</dt>
          <dd className="font-medium tabular-nums">{formatValue(key, value!)}</dd>
        </div>
      ))}
    </dl>
  );
}

function humanKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatValue(key: string, value: string | number): string {
  if (key === "hoursToRespond") return `${value}h`;
  if (key === "expectedValue" || key === "revenue") {
    return typeof value === "number" ? value.toLocaleString() : String(value);
  }
  if (key === "salesCycleDays") return `${value} days`;
  if (typeof value === "string") return value.replace(/_/g, " ");
  return String(value);
}

/** Status pill for an action's execution state, reused by the controls. */
export function ExecutionBadge({ status }: { status: string }) {
  const tone =
    status === "EXECUTED"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : status === "FAILED" || status === "REJECTED"
        ? "border-rose-300 bg-rose-50 text-rose-700"
        : "border-border bg-muted text-muted-foreground";
  const Icon =
    status === "EXECUTED" ? CheckCircle2 : status === "FAILED" ? XCircle : CircleDashed;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone
      )}
    >
      <Icon className="size-3" aria-hidden />
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}
