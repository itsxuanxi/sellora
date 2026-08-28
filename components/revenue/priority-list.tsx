import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/revenue/money";
import type { EnrichedOpportunity } from "@/lib/revenue/queries";
import { OpportunityScore } from "@/components/revenue/score";
import { UrgencyPill } from "@/components/revenue/leak-card";
import type { Urgency } from "@/lib/revenue/config";

/**
 * "Today's Revenue Opportunities" (§6) — the answer to *who should I contact
 * today?*, ranked so the rep never has to ask.
 *
 * Numbered, because the ordering is the recommendation. A rep who works this
 * list top-down is allocating their attention optimally by expected value,
 * which is the entire product thesis (§17).
 */
export function PriorityList({
  opportunities,
}: {
  opportunities: EnrichedOpportunity[];
}) {
  if (opportunities.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing needs chasing today. Selryn will surface the moment that changes.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-border/60">
      {opportunities.map((opp, i) => (
        <li key={opp.id}>
          <Link
            href={`/opportunities/${opp.id}`}
            className="group flex gap-4 py-4 transition-colors hover:bg-muted/30"
          >
            <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-medium tabular-nums text-muted-foreground">
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-medium group-hover:text-primary">
                  {opp.account.name}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatMoney(opp.expectedValue, opp.currency)}
                </span>
                <span className="text-xs text-muted-foreground">
                  expected · {formatMoney(opp.dealValue, opp.currency)} deal
                </span>
              </div>

              {/* Why now — the single most important line in the product. */}
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Why now: </span>
                {opp.primaryLeak?.summary ?? opp.whyNow[0]?.replace(/^[+−-]\s*/, "") ?? "Steady engagement."}
              </p>

              <p className="mt-1 text-sm">
                <span className="text-muted-foreground">Next: </span>
                {opp.nextAction.headline}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <OpportunityScore score={opp.score} band={opp.scoreBand} />
              <UrgencyPill urgency={opp.nextAction.urgency as Urgency} />
            </div>

            <ArrowRight className="mt-1 size-4 shrink-0 self-start text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
