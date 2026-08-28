import "server-only";
import { db } from "@/lib/db";
import { OPEN_STAGES, STAGE_LABELS, URGENCY_LABELS } from "@/lib/revenue/config";
import type { OpportunityStage, Urgency } from "@/lib/revenue/config";
import { formatMoney } from "@/lib/revenue/money";
import {
  getRevenueOverview,
  loadEnrichedOpportunities,
  type EnrichedOpportunity,
} from "@/lib/revenue/queries";
import type { NotificationMessage, NotifiedDeal } from "@/lib/notifications/types";

/**
 * Composing notifications from the same read models the screens use.
 *
 * Nothing here re-derives a score, a leak or a next action — it calls
 * `loadEnrichedOpportunities` exactly as `/dashboard` does. That is the point:
 * a digest that disagreed with the screen it links to would be worse than no
 * digest, and the only way to guarantee it cannot is to have one source.
 */

/** How many deals a digest lists before it stops being readable. */
const DIGEST_DEALS = 5;

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function toNotifiedDeal(opp: EnrichedOpportunity): NotifiedDeal {
  return {
    opportunityId: opp.id,
    company: opp.account.name,
    stage: STAGE_LABELS[opp.stage as OpportunityStage] ?? opp.stage,
    dealValue: opp.dealValue,
    winProbability: opp.winProbability,
    expectedValue: opp.expectedValue,
    currency: opp.currency,
    reason:
      opp.primaryLeak?.summary ??
      opp.whyNow[0]?.replace(/^[+−-]\s*/, "") ??
      "Steady engagement.",
    nextAction: opp.nextAction.headline,
    urgency: URGENCY_LABELS[opp.nextAction.urgency as Urgency] ?? opp.nextAction.urgency,
    atRisk: opp.atRisk,
    url: `${appUrl()}/opportunities/${opp.id}`,
  };
}

/** The calendar day a digest covers, in the recipient's own zone. */
export function localDayKey(now: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // An invalid zone must not stop the digest; UTC is a safe fallback.
    return now.toISOString().slice(0, 10);
  }
}

/**
 * The morning digest: the ranked pipeline, and what is leaking.
 *
 * Returns null when there is nothing worth an email. An empty digest every
 * morning is how a useful notification becomes one people filter away.
 */
export async function composeDailyDigest(opts: {
  orgId: string;
  timezone: string;
  now?: Date;
}): Promise<NotificationMessage | null> {
  const now = opts.now ?? new Date();
  const [overview, opportunities] = await Promise.all([
    getRevenueOverview(opts.orgId),
    loadEnrichedOpportunities(opts.orgId, { stages: [...OPEN_STAGES] }),
  ]);

  if (!overview.hasData || opportunities.length === 0) return null;

  const ranked = [...opportunities].sort((a, b) => b.expectedValue - a.expectedValue);
  const deals = ranked.slice(0, DIGEST_DEALS).map(toNotifiedDeal);

  const leaking = ranked.filter((o) => o.primaryLeak !== null).length;
  const headline =
    leaking > 0
      ? `${formatMoney(overview.revenueAtRisk, overview.currency)} at risk across ${leaking} deal${leaking === 1 ? "" : "s"}.`
      : `Nothing is leaking. ${formatMoney(overview.totalOpenPipeline, overview.currency)} of open pipeline.`;

  return {
    kind: "daily_digest",
    // One per user per local day: a retried cron cannot send a second copy.
    dedupeKey: `daily_digest:${localDayKey(now, opts.timezone)}`,
    subject:
      leaking > 0
        ? `${formatMoney(overview.revenueAtRisk, overview.currency)} at risk — today's priorities`
        : "Today's priorities",
    headline,
    deals,
    summary: {
      revenueAtRisk: formatMoney(overview.revenueAtRisk, overview.currency),
      openPipeline: formatMoney(overview.totalOpenPipeline, overview.currency),
      openCount: overview.openCount,
    },
    primaryUrl: `${appUrl()}/dashboard`,
    primaryLabel: "Open today's priorities",
  };
}

/**
 * Deals that started leaking and are worth interrupting someone about.
 *
 * One message per deal, not a batch: an alert is a claim that this specific
 * deal needs attention now, and bundling three of them into one mail makes it
 * a digest that happens to arrive at a bad time.
 */
export async function composeRiskAlerts(opts: {
  orgId: string;
  minAlertValue: number;
  cooldownHours: number;
  now?: Date;
}): Promise<NotificationMessage[]> {
  const now = opts.now ?? new Date();
  const opportunities = await loadEnrichedOpportunities(opts.orgId, {
    stages: [...OPEN_STAGES],
  });

  const atRisk = opportunities
    .filter((o) => o.primaryLeak !== null)
    .filter((o) => o.expectedValue >= opts.minAlertValue)
    .sort((a, b) => b.atRisk - a.atRisk);

  if (atRisk.length === 0) return [];

  // The cooldown is expressed in the dedupe key rather than checked against
  // history, so the uniqueness constraint enforces it. A key that only
  // changes once per cooldown window cannot produce a second send inside it.
  const window = Math.floor(now.getTime() / (opts.cooldownHours * 3_600_000));

  return atRisk.map((opp) => {
    const deal = toNotifiedDeal(opp);
    return {
      kind: "risk_alert" as const,
      dedupeKey: `risk_alert:${opp.id}:${window}`,
      subject: `${deal.company} — ${formatMoney(opp.atRisk, opp.currency)} at risk`,
      headline: `${deal.company} is leaking ${formatMoney(opp.atRisk, opp.currency)} of expected revenue.`,
      deals: [deal],
      summary: {
        revenueAtRisk: formatMoney(opp.atRisk, opp.currency),
        openPipeline: formatMoney(opp.dealValue, opp.currency),
        openCount: 1,
      },
      primaryUrl: deal.url,
      primaryLabel: `Open ${deal.company}`,
    };
  });
}

/** Recipients who have asked for a given kind of notification. */
export async function recipientsFor(kind: "daily_digest" | "risk_alerts") {
  const field = kind === "daily_digest" ? "dailyDigest" : "riskAlerts";
  return db.notificationPreference.findMany({
    where: {
      unsubscribedAt: null,
      [field]: true,
      user: { email: { not: null } },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      org: { select: { id: true, name: true, isSample: true } },
    },
  });
}
