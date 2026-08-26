import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { InsightCard } from "@/components/insights/insight-card";
import { RefreshInsightsButton } from "@/components/insights/refresh-button";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildInsightsContext } from "@/lib/insights";

export const metadata = { title: "AI Insights" };

export default async function InsightsPage() {
  const session = await requireSession();
  const [insights, context] = await Promise.all([
    db.insight.findMany({
      where: { orgId: session.orgId, dismissed: false },
      orderBy: { createdAt: "desc" },
    }),
    buildInsightsContext(session.orgId),
  ]);

  const summary = [
    { label: "Emails sent", value: context.totals.emailsSent },
    { label: "Opened", value: context.totals.opened },
    { label: "Replied", value: context.totals.replied },
    { label: "Reply rate (7d)", value: `${context.replyRateThisWeek}%` },
    { label: "Hot prospects", value: context.hotProspects.length },
    { label: "Going cold", value: context.staleProspects.length },
  ];

  return (
    <>
      <PageHeader
        title="AI Insights"
        description="GPT reads your live outreach and pipeline data, then tells you exactly what to do next."
      >
        <RefreshInsightsButton hasInsights={insights.length > 0} />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border/70 bg-card px-4 py-3"
          >
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className="mt-0.5 text-xl font-semibold tracking-tight">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {insights.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No insights yet"
          description="Generate insights and the AI will surface your hottest prospects, who needs a follow-up, and how your reply rate is trending."
        >
          <RefreshInsightsButton hasInsights={false} />
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </>
  );
}
