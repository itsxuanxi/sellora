import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Briefcase } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import { OPEN_STAGES, STAGE_LABELS, type OpportunityStage } from "@/lib/revenue/config";
import { formatMoney, formatMoneyCompact } from "@/lib/revenue/money";
import { loadEnrichedOpportunities } from "@/lib/revenue/queries";
import { OpportunityScore } from "@/components/revenue/score";
import { RefreshIntelligenceButton } from "@/components/revenue/recommendation-actions";
import { refreshRevenueIntelligence } from "@/app/(app)/opportunities/actions";

export const metadata = { title: "Opportunities" };

type Filter = "all" | "open" | "high-intent" | "at-risk" | "closed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "high-intent", label: "High intent" },
  { key: "at-risk", label: "At risk" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

/**
 * Every opportunity, ranked by expected revenue rather than by date or
 * alphabet. The sort order is the point: the top of this list is where the
 * next hour of selling time is worth the most.
 */
export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireSession();
  const { filter: rawFilter } = await searchParams;
  const filter = (FILTERS.find((f) => f.key === rawFilter)?.key ?? "open") as Filter;

  const all = await loadEnrichedOpportunities(session.orgId);

  const filtered = all
    .filter((o) => {
      const open = (OPEN_STAGES as string[]).includes(o.stage);
      switch (filter) {
        case "open":
          return open;
        case "high-intent":
          return open && (o.score ?? 0) >= 70;
        case "at-risk":
          return open && o.primaryLeak !== null;
        case "closed":
          return !open;
        default:
          return true;
      }
    })
    .sort((a, b) => b.expectedValue - a.expectedValue);

  const totalExpected = filtered.reduce((s, o) => s + o.expectedValue, 0);
  const totalValue = filtered.reduce((s, o) => s + o.dealValue, 0);
  const currency = all[0]?.currency ?? "USD";

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Every open deal, ranked by expected revenue — deal value × likelihood of closing."
      >
        <RefreshIntelligenceButton action={refreshRevenueIntelligence} />
      </PageHeader>

      {all.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No opportunities yet"
          description="Sellora creates an opportunity for each account that has contacts, estimates its value from your ICP, and starts scoring it against buying signals."
        >
          <RefreshIntelligenceButton
            action={refreshRevenueIntelligence}
            label="Build opportunities from my accounts"
          />
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`/opportunities?filter=${f.key}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  filter === f.key
                    ? "border-primary/30 bg-accent font-medium text-accent-foreground"
                    : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-border/70 bg-card px-5 py-4">
            <Metric label="Opportunities" value={String(filtered.length)} />
            <Metric label="Total deal value" value={formatMoney(totalValue, currency)} />
            <Metric
              label="Expected revenue"
              value={formatMoney(totalExpected, currency)}
              emphasis
            />
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              No opportunities match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left">
                    <Th>Opportunity</Th>
                    <Th>Stage</Th>
                    <Th align="right">Deal value</Th>
                    <Th align="right">Likelihood</Th>
                    <Th align="right">Expected</Th>
                    <Th align="right">Score</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((opp) => (
                    <tr key={opp.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/opportunities/${opp.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {opp.account.name}
                        </Link>
                        {opp.contact && (
                          <div className="text-xs text-muted-foreground">
                            {opp.contact.name}
                            {opp.contact.position && ` · ${opp.contact.position}`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StagePill stage={opp.stage} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoneyCompact(opp.dealValue, opp.currency)}
                        {opp.dealValueBasis !== "user_entered" && (
                          <span className="ml-1 text-xs text-muted-foreground">est.</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {opp.winProbability}%
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatMoneyCompact(opp.expectedValue, opp.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <OpportunityScore score={opp.score} band={opp.scoreBand} />
                      </td>
                      <td className="px-4 py-3">
                        {opp.primaryLeak ? (
                          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                            {opp.primaryLeak.category}
                          </span>
                        ) : opp.lastInteractionAt ? (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(opp.lastInteractionAt, { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No contact yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground",
        align === "right" && "text-right"
      )}
    >
      {children}
    </th>
  );
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 tabular-nums",
          emphasis ? "text-xl font-semibold tracking-tight" : "text-lg font-medium"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function StagePill({ stage }: { stage: string }) {
  const style: Record<string, string> = {
    NEW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    QUALIFYING: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    MEETING: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    PROPOSAL: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    NEGOTIATION: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    WON: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    LOST: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        style[stage] ?? style.NEW
      )}
    >
      {STAGE_LABELS[stage as OpportunityStage] ?? stage}
    </span>
  );
}
