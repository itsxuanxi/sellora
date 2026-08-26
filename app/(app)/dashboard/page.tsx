import Link from "next/link";
import { ArrowRight, Radar, Target } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney, formatMoneyCompact } from "@/lib/revenue/money";
import {
  getLeakFeed,
  getRevenueOverview,
  getTodaysPriorities,
} from "@/lib/revenue/queries";
import { RevenueAtRisk, StatTile } from "@/components/revenue/money";
import { LeakCard } from "@/components/revenue/leak-card";
import { PriorityList } from "@/components/revenue/priority-list";
import { RefreshIntelligenceButton } from "@/components/revenue/recommendation-actions";
import { refreshRevenueIntelligence } from "@/app/(app)/opportunities/actions";

export const metadata = { title: "Overview" };

/**
 * The Revenue Leak Dashboard (§3).
 *
 * Every element answers the one question §19 sets for every screen: where is
 * money being lost, and what should I do about it? There is no "emails sent"
 * tile, no activity chart, no engagement vanity metric — those describe
 * effort, and this page is about outcomes.
 */
export default async function OverviewPage() {
  const session = await requireSession();

  const [overview, feed, priorities, icp] = await Promise.all([
    getRevenueOverview(session.orgId),
    getLeakFeed(session.orgId, 6),
    getTodaysPriorities(session.orgId),
    db.icpProfile.findUnique({
      where: { orgId: session.orgId },
      select: { completed: true },
    }),
  ]);

  // Recommendation rows let the feed's controls write to the ledger.
  const recs = await db.recommendation.findMany({
    where: { orgId: session.orgId, status: "OPEN" },
    select: { id: true, opportunityId: true },
  });
  const recByOpp = new Map(recs.map((r) => [r.opportunityId, r.id]));

  const firstName = (session.name ?? "there").split(/\s+/)[0];

  if (!overview.hasData) {
    return (
      <>
        <PageHeader
          title="Revenue Overview"
          description="Sellora finds the revenue your pipeline is leaking — and tells you what to do about it."
        />
        <EmptyState
          icon={Radar}
          title="No opportunities to analyze yet"
          description="Sellora builds opportunities from your accounts and contacts, estimates what each deal is worth, then watches for the moments revenue starts leaking. Run the first analysis to see your pipeline in money terms."
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <RefreshIntelligenceButton
              action={refreshRevenueIntelligence}
              label="Run first analysis"
            />
            <Button asChild variant="ghost">
              <Link href="/accounts">Add accounts first</Link>
            </Button>
          </div>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Revenue Overview`}
        description={`${firstName}, here is where your pipeline is losing money right now.`}
      >
        <RefreshIntelligenceButton action={refreshRevenueIntelligence} />
      </PageHeader>

      {!icp?.completed && (
        <Link
          href="/icp"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-accent/40 px-4 py-3 transition-colors hover:bg-accent/60"
        >
          <div className="flex items-center gap-3">
            <Target className="size-4 shrink-0 text-primary" />
            <div className="text-sm">
              <span className="font-medium">Define your ICP</span>
              <span className="text-muted-foreground">
                {" "}
                — customer fit is being scored neutrally until you do
              </span>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-primary" />
        </Link>
      )}

      {/* ── The headline number ── */}
      <RevenueAtRisk
        amount={overview.revenueAtRisk}
        currency={overview.currency}
        opportunityCount={overview.opportunitiesAtRisk}
      />

      {/* ── Supporting money metrics (§3) ── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Recovered"
          value={formatMoneyCompact(overview.revenueRecoveredThisMonth, overview.currency)}
          sublabel="this month"
          tone={overview.revenueRecoveredThisMonth > 0 ? "positive" : "neutral"}
          href="/analytics"
        />
        <StatTile
          label="High intent"
          value={String(overview.highIntentCount)}
          sublabel={`prospect${overview.highIntentCount === 1 ? "" : "s"} scoring 70+`}
          href="/opportunities?filter=high-intent"
        />
        <StatTile
          label="Deals at risk"
          value={String(overview.dealsAtRiskCount)}
          sublabel="need attention"
          tone={overview.dealsAtRiskCount > 0 ? "critical" : "neutral"}
          href="/recover"
        />
        <StatTile
          label="Follow-ups overdue"
          value={String(overview.followUpsOverdue)}
          sublabel="opportunities"
          tone={overview.followUpsOverdue > 0 ? "warning" : "neutral"}
          href="/recover"
        />
        <StatTile
          label="Pipeline influenced"
          value={formatMoneyCompact(overview.pipelineInfluenced, overview.currency)}
          sublabel="by Sellora"
          href="/analytics"
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* ── Revenue Leak Feed (§4) ── */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Revenue Leak Feed</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Deals losing money for reasons you can fix.
              </p>
            </div>
            {feed.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/recover">View all</Link>
              </Button>
            )}
          </div>

          {feed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 px-5 py-12 text-center">
              <p className="text-sm font-medium">No leaks detected</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every open deal has been touched recently and has a next step.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feed.map((opp) => (
                <LeakCard
                  key={opp.id}
                  opportunity={opp}
                  recommendationId={recByOpp.get(opp.id) ?? null}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Today's Revenue Opportunities (§6) ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Today&rsquo;s opportunities</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Who to contact, in order.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card px-5">
            <PriorityList opportunities={priorities} />
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Open pipeline
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
              {formatMoney(overview.totalOpenPipeline, overview.currency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              across {overview.openCount} open opportunit
              {overview.openCount === 1 ? "y" : "ies"}
            </p>
            <Button variant="ghost" size="sm" asChild className="mt-3 -ml-2">
              <Link href="/opportunities">
                All opportunities
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
