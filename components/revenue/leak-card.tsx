import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ACTION_LABELS, URGENCY_LABELS, type ActionType, type Urgency } from "@/lib/revenue/config";
import { formatMoney } from "@/lib/revenue/money";
import type { EnrichedOpportunity } from "@/lib/revenue/queries";
import { OpportunityScore } from "@/components/revenue/score";
import { RecommendationActions } from "@/components/revenue/recommendation-actions";

/**
 * One item in the Revenue Leak Feed (§4).
 *
 * The information order is fixed and deliberate, because §4 requires a
 * reader to answer four questions in seconds:
 *   money at stake → what is happening → why it matters → what to do.
 * Everything else (score, signals, timing) is secondary and sits below.
 */

const SEVERITY: Record<string, { dot: string; text: string; ring: string; label: string }> = {
  critical: {
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/20",
    label: "Critical",
  },
  warning: {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
    label: "Warning",
  },
  watch: {
    dot: "bg-slate-400",
    text: "text-muted-foreground",
    ring: "ring-slate-400/20",
    label: "Watch",
  },
};

export function LeakCard({
  opportunity,
  recommendationId,
}: {
  opportunity: EnrichedOpportunity;
  recommendationId?: string | null;
}) {
  const leak = opportunity.primaryLeak;
  const action = opportunity.nextAction;
  const sev = SEVERITY[leak?.severity ?? "watch"];
  const who = opportunity.contact?.name ?? opportunity.account.name;

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-border">
      {/* ── Money + what is happening ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", sev.dot)} aria-hidden />
            <span className={cn("text-lg font-semibold tabular-nums", sev.text)}>
              {formatMoney(opportunity.atRisk || opportunity.expectedValue, opportunity.currency)}
            </span>
            <span className="text-sm text-muted-foreground">
              {leak ? "at risk" : "expected"}
            </span>
            {leak && (
              <span className="text-xs text-muted-foreground">· {leak.category}</span>
            )}
          </div>

          <h3 className="mt-2 text-sm font-medium">
            <Link
              href={`/opportunities/${opportunity.id}`}
              className="hover:text-primary hover:underline"
            >
              {opportunity.account.name}
            </Link>
            {opportunity.contact && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {opportunity.contact.name}
                {opportunity.contact.position && `, ${opportunity.contact.position}`}
              </span>
            )}
          </h3>

          {/* ── Why it matters ── */}
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {leak ? leak.summary : action.rationale}
          </p>

          {leak && leak.evidence.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {leak.evidence.map((e, i) => (
                <span key={i} className="rounded-md bg-muted/60 px-2 py-0.5">
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <OpportunityScore score={opportunity.score} band={opportunity.scoreBand} />
        </div>
      </div>

      {/* ── What to do ── */}
      <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Recommended action
          </span>
          <UrgencyPill urgency={action.urgency as Urgency} />
        </div>
        <p className="mt-1.5 text-sm font-medium">{action.headline}</p>
      </div>

      {/* ── Footer: context + controls ── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{ACTION_LABELS[action.actionType as ActionType]}</span>
          {opportunity.lastInteractionAt && (
            <span>
              Last contact{" "}
              {formatDistanceToNow(opportunity.lastInteractionAt, { addSuffix: true })}
            </span>
          )}
          <span>
            {formatMoney(opportunity.dealValue, opportunity.currency)} ·{" "}
            {opportunity.winProbability}% likely
          </span>
        </div>

        <div className="flex items-center gap-2">
          <RecommendationActions
            recommendationId={recommendationId ?? null}
            opportunityId={opportunity.id}
            compact
          />
          <Button asChild size="sm">
            <Link href={`/opportunities/${opportunity.id}`}>
              Take action
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <span className="sr-only">
        {sev.label} severity. Contact {who}.
      </span>
    </article>
  );
}

export function UrgencyPill({ urgency }: { urgency: Urgency }) {
  const style: Record<Urgency, string> = {
    now: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/60 dark:text-rose-300",
    today: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300",
    this_week: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/60 dark:text-sky-300",
    monitor: "bg-muted text-muted-foreground ring-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset",
        style[urgency]
      )}
    >
      {URGENCY_LABELS[urgency]}
    </span>
  );
}
