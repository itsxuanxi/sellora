import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/revenue/money";
import { getImpactSummary, getRevenueOverview } from "@/lib/revenue/queries";

export const metadata = { title: "Impact" };

/**
 * Revenue Attribution (§12) — what Sellora actually did for the business.
 *
 * Every figure traces to a RevenueAttribution row written when a human acted
 * on a recommendation. Nothing is inferred at read time and nothing is
 * modelled: if a rep never used a recommendation, this page says so rather
 * than claiming credit for the pipeline moving on its own. That honesty is
 * the point — a number a VP can disprove is worth less than no number.
 */
export default async function AnalyticsPage() {
  const session = await requireSession();

  const [impact, overview, recent] = await Promise.all([
    getImpactSummary(session.orgId),
    getRevenueOverview(session.orgId),
    db.revenueAttribution.findMany({
      where: { orgId: session.orgId },
      orderBy: { occurredAt: "desc" },
      take: 15,
      include: {
        opportunity: { select: { id: true, account: { select: { name: true } } } },
      },
    }),
  ]);

  const currency = overview.currency;

  if (!impact.hasData) {
    return (
      <>
        <PageHeader title="Impact" description="What Sellora has done for your revenue." />
        <EmptyState
          icon={BarChart3}
          title="No impact recorded yet"
          description="Sellora records impact when you act on a recommendation — not before. Work a recommendation from the Overview or Recover page and it will show up here with the revenue attached to it."
        >
          <Button asChild>
            <Link href="/recover">Open the recovery queue</Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Impact"
        description={`What Sellora has done for your revenue — ${impact.monthLabel}.`}
      />

      {/* ── The four numbers that justify the subscription ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BigStat
          label="Revenue recovered"
          value={formatMoney(impact.revenueRecovered, currency)}
          note="from deals Sellora flagged and you rescued"
          tone="positive"
        />
        <BigStat
          label="Pipeline influenced"
          value={formatMoney(impact.pipelineInfluenced, currency)}
          note="expected revenue on deals Sellora touched"
        />
        <BigStat
          label="Opportunities saved"
          value={String(impact.opportunitiesSaved)}
          note="leaking deals brought back"
        />
        <BigStat
          label="Meetings generated"
          value={String(impact.meetingsGenerated)}
          note="booked off a recommendation"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="text-sm font-semibold">Recommendation performance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How much of what Sellora surfaced actually got worked.
          </p>

          <dl className="mt-4 space-y-3">
            <StatRow
              label="Recommendations shown"
              value={String(impact.recommendationsShown)}
            />
            <StatRow
              label="Acted on"
              value={String(impact.recommendationsActedOn)}
            />
            <StatRow
              label="Follow-up coverage"
              value={`${impact.followUpCoverage}%`}
              bar={impact.followUpCoverage}
            />
            <StatRow
              label="Average response time"
              value={
                impact.avgResponseDays != null
                  ? `${impact.avgResponseDays} day${impact.avgResponseDays === 1 ? "" : "s"}`
                  : "—"
              }
            />
          </dl>

          {impact.recommendationsShown > 0 && impact.recommendationsActedOn === 0 && (
            <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Sellora has surfaced {impact.recommendationsShown} recommendation
              {impact.recommendationsShown === 1 ? "" : "s"} that nobody has marked
              complete. Impact stays at zero until recommendations get worked —
              this page only counts real actions.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="text-sm font-semibold">Pipeline position</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Where the money currently sits.
          </p>

          <dl className="mt-4 space-y-3">
            <StatRow
              label="Open pipeline"
              value={formatMoney(overview.totalOpenPipeline, currency)}
            />
            <StatRow
              label="Currently at risk"
              value={formatMoney(overview.revenueAtRisk, currency)}
              tone={overview.revenueAtRisk > 0 ? "critical" : undefined}
            />
            <StatRow label="Deals won this month" value={String(impact.dealsWon)} />
            <StatRow
              label="Won value"
              value={formatMoney(impact.wonValue, currency)}
              tone={impact.wonValue > 0 ? "positive" : undefined}
            />
          </dl>
        </section>
      </div>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">Attribution log</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Every entry was written when someone acted — this is the audit trail
            behind the numbers above.
          </p>
          <ul className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-card">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`/opportunities/${a.opportunity.id}`}
                      className="text-sm font-medium hover:text-primary hover:underline"
                    >
                      {a.opportunity.account.name}
                    </Link>
                    <span className="rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {a.kind}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{a.reason}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular-nums">
                    {formatMoney(a.amount, currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.occurredAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function BigStat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "critical";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "critical"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${toneClass}`}>
        {value}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

function StatRow({
  label,
  value,
  bar,
  tone,
}: {
  label: string;
  value: string;
  bar?: number;
  tone?: "positive" | "critical";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "critical"
        ? "text-rose-600 dark:text-rose-400"
        : "";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className={`text-sm font-medium tabular-nums ${toneClass}`}>{value}</dd>
      </div>
      {bar != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(0, Math.min(100, bar))}%` }}
          />
        </div>
      )}
    </div>
  );
}
