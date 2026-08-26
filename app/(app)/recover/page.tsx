import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/revenue/money";
import { getRecoveryQueue } from "@/lib/revenue/queries";
import { LeakCard } from "@/components/revenue/leak-card";
import { RefreshIntelligenceButton } from "@/components/revenue/recommendation-actions";
import { refreshRevenueIntelligence } from "@/app/(app)/opportunities/actions";

export const metadata = { title: "Recover" };

/**
 * The Revenue Recovery Queue (§8): opportunities Sellora believes are being
 * lost unnecessarily, grouped by *why* and sorted by expected recoverable
 * revenue.
 *
 * Each deal appears under one category only — its primary leak — so the
 * recoverable total at the top is a real sum and not double-counted.
 */
export default async function RecoverPage() {
  const session = await requireSession();

  const [{ categories, totalRecoverable, count }, recs] = await Promise.all([
    getRecoveryQueue(session.orgId),
    db.recommendation.findMany({
      where: { orgId: session.orgId, status: "OPEN" },
      select: { id: true, opportunityId: true },
    }),
  ]);
  const recByOpp = new Map(recs.map((r) => [r.opportunityId, r.id]));
  const currency = categories[0]?.opportunities[0]?.currency ?? "USD";

  return (
    <>
      <PageHeader
        title="Recover"
        description="Opportunities you are losing for reasons that have nothing to do with whether they want to buy."
      >
        <RefreshIntelligenceButton action={refreshRevenueIntelligence} />
      </PageHeader>

      {count === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Nothing to recover"
          description="No open deal is overdue, silent, or sitting on an unanswered proposal. This is the state you want — Sellora will fill this page the moment something starts slipping."
        >
          <Button asChild variant="outline">
            <Link href="/opportunities">Review open opportunities</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="mb-8 rounded-2xl border border-border/70 bg-card p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Expected recoverable revenue
            </div>
            <div className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
              {formatMoney(totalRecoverable, currency)}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Across {count} opportunit{count === 1 ? "y" : "ies"} in{" "}
              {categories.length} categor{categories.length === 1 ? "y" : "ies"}. Each
              figure is deal value × likelihood of closing, discounted by how
              severe the leak is — not the full deal value.
            </p>
          </div>

          <div className="space-y-10">
            {categories.map((cat) => (
              <section key={cat.type}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        cat.severity === "critical"
                          ? "bg-rose-500"
                          : cat.severity === "warning"
                            ? "bg-amber-500"
                            : "bg-slate-400"
                      )}
                      aria-hidden
                    />
                    <h2 className="text-base font-semibold tracking-tight">{cat.title}</h2>
                    <span className="text-sm text-muted-foreground">
                      {cat.opportunities.length}
                    </span>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {formatMoney(cat.totalRecoverable, currency)}
                  </div>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">{cat.detects}</p>

                <div className="space-y-3">
                  {cat.opportunities.map((opp) => (
                    <LeakCard
                      key={opp.id}
                      opportunity={opp}
                      recommendationId={recByOpp.get(opp.id) ?? null}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
