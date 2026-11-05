import Link from "next/link";
import { BarChart3 } from "lucide-react";
import {
  ActionEffectivenessPanel,
  InsightsList,
  LoopFunnelPanel,
  SignalWinRatePanel,
} from "@/components/revenue/learning-panel";
import {
  getActionEffectiveness,
  getInfluencedTotals,
  getLearningInsights,
  getLoopFunnel,
  getSignalWinRates,
} from "@/lib/revenue/learning";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ATTRIBUTION_CAVEAT, REVENUE_VOCABULARY } from "@/lib/revenue/vocabulary";
import { formatMoney } from "@/lib/revenue/money";
import { getImpactSummary, getRevenueOverview } from "@/lib/revenue/queries";
import { FollowUpStats } from "@/components/followup/follow-up-stats";
import { statLines, summarize } from "@/lib/followup/tracking";

/**
 * Revenue Attribution (§12) — what Selryn actually did for the business.
 *
 * Every figure traces to a RevenueAttribution row written when a human acted
 * on a recommendation. Nothing is inferred at read time and nothing is
 * modelled: if a rep never used a recommendation, this page says so rather
 * than claiming credit for the pipeline moving on its own. That honesty is
 * the point — a number a VP can disprove is worth less than no number.
 */
/**
 * What actually moved: responses to our actions, and opportunity progress.
 *
 * This was /impact, titled "Impact", and it headlined a figure called
 * "Revenue recovered" that was manufactured — see lib/revenue/vocabulary.ts.
 * It is now the second half of Outcomes and reports realized closed-won value,
 * pipeline as pipeline, and everything else as counts of things that happened.
 */
export async function OutcomeSummary() {
  const session = await requireSession();

  const [
    impact,
    overview,
    recent,
    funnel,
    insights,
    signalWins,
    effectiveness,
    influenced,
    followUps,
  ] = await Promise.all([
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
    getLoopFunnel(session.orgId),
    getLearningInsights(session.orgId),
    getSignalWinRates(session.orgId),
    getActionEffectiveness(session.orgId),
    getInfluencedTotals(session.orgId),
    db.dealFollowUp.findMany({
      where: { orgId: session.orgId },
      select: {
        id: true,
        status: true,
        sentAt: true,
        repliedAt: true,
        edited: true,
      },
    }),
  ]);

  const currency = overview.currency;

  if (!impact.hasData) {
    return (
      <>
        <EmptyState
          icon={BarChart3}
          title="Nothing has been worked yet"
          description="Outcomes fills in when you act on a follow-up — not before. Work one from Today and it appears here with the deal it was on, what came back, and whether the deal moved."
        >
          <Button asChild>
            <Link href="/dashboard">Open Today</Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        What Selryn flagged, what you worked, and what closed — {impact.monthLabel}.
      </p>

      {/* ── The four headline numbers.
             Each one is either realized money or a count of something that
             happened. None of them is an estimate, and none of them turns an
             event into revenue — the previous version's "Revenue recovered"
             did exactly that, summing deal value × an uncalibrated win
             probability the instant a recommendation was marked complete. ── */}
      <div data-tour="impact" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BigStat
          label="Closed-won value"
          value={formatMoney(impact.closedWonValue, currency)}
          note={`${impact.dealsWon} deal${impact.dealsWon === 1 ? "" : "s"} closed won this month`}
          tone={impact.closedWonValue > 0 ? "positive" : undefined}
        />
        <BigStat
          label="…on deals Selryn flagged"
          value={formatMoney(impact.closedWonValueFlagged, currency)}
          note={`${impact.dealsWonFlagged} of those ${impact.dealsWonFlagged === 1 ? "deal was" : "deals were"} flagged here — overlap, not credit`}
        />
        <BigStat
          label="Open pipeline worked"
          value={formatMoney(impact.openPipelineWorked, currency)}
          note={`CRM deal value on ${impact.dealsWorked} open deal${impact.dealsWorked === 1 ? "" : "s"} you acted on`}
        />
        <BigStat
          label="Recommendations worked"
          value={String(impact.recommendationsActedOn)}
          note={`of ${impact.recommendationsShown} surfaced · ${impact.meetingsBooked} meeting${impact.meetingsBooked === 1 ? "" : "s"} booked`}
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{ATTRIBUTION_CAVEAT}</p>

      {/* ── Influenced pipeline and revenue ──
             "Influenced" is a factual claim about contact: a Selryn-prompted
             action was executed on these deals while they were open. It is
             not a claim that they closed because of it, and the note says so. ── */}
      <section className="mt-8 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="text-sm font-semibold">Influenced pipeline and revenue</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deals where a recommendation led to an action that actually went out.
          Contact is what is being measured here, not credit.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat
            label="Influenced pipeline"
            value={formatMoney(influenced.influencedPipeline, currency)}
          />
          <MiniStat
            label="Influenced revenue"
            value={formatMoney(influenced.influencedRevenue, currency)}
          />
          <MiniStat label="Deals touched" value={String(influenced.influencedDeals)} />
          <MiniStat
            label="Avg. sales cycle"
            value={
              influenced.averageSalesCycleDays == null
                ? "Not enough data"
                : `${influenced.averageSalesCycleDays} days`
            }
          />
        </dl>
      </section>

      {/* ── Learning Insights (§7) ── */}
      <section className="mt-6 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="text-sm font-semibold">Learning insights</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Patterns in your own pipeline. Nothing here is shared with, or
          learned from, any other workspace.
        </p>
        <div className="mt-4">
          <InsightsList insights={insights} />
        </div>
      </section>

      <FollowUpStats
        lines={statLines(
          summarize(
            followUps.map((f) => ({
              ...f,
              // Not yet attributed to an individual follow-up — null keeps
              // the figure honest rather than reporting an unchecked zero.
              meetingAt: null,
              stageChangedAt: null,
            }))
          )
        )}
      />

      <section className="mt-6 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="text-sm font-semibold">Loop performance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Signal → recommendation → action → response, end to end.
        </p>
        <div className="mt-4">
          <LoopFunnelPanel funnel={funnel} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="text-sm font-semibold">Signals and win rate</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How often closed deals carrying each signal were won.
          </p>
          <div className="mt-4">
            <SignalWinRatePanel data={signalWins} />
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="text-sm font-semibold">Which actions draw a reaction</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Positive-response rate per action type, across executed actions.
          </p>
          <div className="mt-4">
            <ActionEffectivenessPanel rows={effectiveness} />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="text-sm font-semibold">Recommendation performance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How much of what Selryn surfaced actually got worked.
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
              Selryn has surfaced {impact.recommendationsShown} recommendation
              {impact.recommendationsShown === 1 ? "" : "s"} that nobody has marked
              complete. Impact stays at zero until recommendations get worked —
              this page only counts real actions.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="text-sm font-semibold">Pipeline position</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Where the money currently sits. Open pipeline and closed-won value are
            CRM deal values; value at risk is an estimate.
          </p>

          <dl className="mt-4 space-y-3">
            <StatRow
              label="Open pipeline"
              value={formatMoney(overview.totalOpenPipeline, currency)}
            />
            <StatRow
              label={REVENUE_VOCABULARY.value_at_risk.label}
              value={formatMoney(overview.revenueAtRisk, currency)}
              tone={overview.revenueAtRisk > 0 ? "critical" : undefined}
            />
            <StatRow label="Deals won this month" value={String(impact.dealsWon)} />
            <StatRow
              label={REVENUE_VOCABULARY.closed_won_value.label}
              value={formatMoney(impact.closedWonValue, currency)}
              tone={impact.closedWonValue > 0 ? "positive" : undefined}
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

/** Compact stat for the influenced-revenue row. */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{value}</dd>
    </div>
  );
}
