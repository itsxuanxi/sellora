import Link from "next/link";
import { ArrowRight, Radar, Target } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/revenue/money";
import {
  DAILY_PRIORITY_COUNT,
  OPEN_STAGES,
  STAGE_LABELS,
  type OpportunityStage,
} from "@/lib/revenue/config";
import {
  getRevenueOverview,
  loadEnrichedOpportunities,
  type EnrichedOpportunity,
} from "@/lib/revenue/queries";
import type { PriorityRow } from "@/lib/revenue/priority-row";
import { PipelineSummary, PriorityTable } from "@/components/revenue/priority-table";
import { RefreshIntelligenceButton } from "@/components/revenue/recommendation-actions";
import { refreshRevenueIntelligence } from "@/app/(app)/opportunities/actions";

export const metadata = { title: "Today" };

/**
 * Today's priorities — the same screen the guided demo teaches.
 *
 * One question, answered in one table: where is the next hour of selling time
 * worth the most? The rows are sorted by expected revenue and the arithmetic
 * behind that sort is a visible column, so the ranking can be checked rather
 * than trusted. There is no "emails sent" tile, no activity chart, no
 * engagement metric — those describe effort, and this page is about outcomes.
 */
export default async function TodayPage() {
  const session = await requireSession();

  const [overview, opportunities, icp] = await Promise.all([
    getRevenueOverview(session.orgId),
    loadEnrichedOpportunities(session.orgId, { stages: [...OPEN_STAGES] }),
    db.icpProfile.findUnique({
      where: { orgId: session.orgId },
      select: { completed: true },
    }),
  ]);

  const header = (
    <PageHeader
      title="Today's priorities"
      description="Ranked by expected revenue — deal value multiplied by win probability — not by deal size or recency."
    >
      <RefreshIntelligenceButton action={refreshRevenueIntelligence} />
    </PageHeader>
  );

  if (!overview.hasData || opportunities.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Radar}
          title="No opportunities to rank yet"
          description="Selryn builds opportunities from your accounts and contacts, estimates what each deal is worth, then ranks them by expected revenue. Run the first analysis to see your pipeline in money terms."
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <RefreshIntelligenceButton
              action={refreshRevenueIntelligence}
              label="Run first analysis"
            />
            <Link
              href="/accounts"
              className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Add accounts first
            </Link>
          </div>
        </EmptyState>
      </>
    );
  }

  const ranked = [...opportunities].sort((a, b) => b.expectedValue - a.expectedValue);
  const rows = ranked.slice(0, DAILY_PRIORITY_COUNT).map(toRow);

  return (
    <>
      {header}

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

      <PriorityTable rows={rows} />

      <PipelineSummary
        items={[
          {
            label: "Revenue at risk",
            value: formatMoney(overview.revenueAtRisk, overview.currency),
            tone: overview.revenueAtRisk > 0 ? "critical" : "neutral",
            href: "/recover",
          },
          {
            label: "Open pipeline",
            value: formatMoney(overview.totalOpenPipeline, overview.currency),
            href: "/opportunities",
          },
          {
            label: "Open opportunities",
            value: String(overview.openCount),
            href: "/opportunities",
          },
        ]}
      />

      <p className="mt-4 text-[12px] text-muted-foreground">
        {ranked.length > DAILY_PRIORITY_COUNT
          ? `Showing the top ${DAILY_PRIORITY_COUNT} of ${ranked.length} open opportunities.`
          : `Showing all ${ranked.length} open opportunit${ranked.length === 1 ? "y" : "ies"}.`}{" "}
        <Link href="/opportunities" className="text-primary hover:underline">
          All opportunities
        </Link>
      </p>
    </>
  );
}

/**
 * One enriched opportunity, flattened into the row shape the demo also
 * produces. The "why now" line prefers the detected leak, because a deal that
 * is leaking has a more useful thing to say than its stage does.
 */
function toRow(opp: EnrichedOpportunity): PriorityRow {
  return {
    id: opp.id,
    company: opp.account.name,
    stage: STAGE_LABELS[opp.stage as OpportunityStage] ?? opp.stage,
    note:
      opp.primaryLeak?.summary ??
      opp.whyNow[0]?.replace(/^[+−-]\s*/, "") ??
      opp.nextAction.headline,
    dealValue: opp.dealValue,
    winProbability: opp.winProbability,
    expected: opp.expectedValue,
    lastActivity: opp.lastInteractionAt
      ? formatDistanceToNow(opp.lastInteractionAt, { addSuffix: true })
      : "No contact yet",
    needsAttention: opp.primaryLeak !== null,
    currency: opp.currency,
    href: `/opportunities/${opp.id}`,
  };
}
