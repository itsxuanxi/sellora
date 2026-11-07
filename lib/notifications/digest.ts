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
import { getFollowUps, type FollowUpListItem } from "@/lib/followup/queries";
import { BASIS_LABEL, RISK_LABEL } from "@/lib/risk/kinds";
import type { NotificationMessage, NotifiedDeal } from "@/lib/notifications/types";

/**
 * Composing notifications from the same read models the screens use.
 *
 * Nothing here re-derives a score, a risk or a next action — it calls
 * `loadEnrichedOpportunities` exactly as `/dashboard` does. That is the point:
 * a digest that disagreed with the screen it links to would be worse than no
 * digest, and the only way to guarantee it cannot is to have one source.
 *
 * Which the ordering did not honour. This file read the same data as Today
 * and then sorted it by `expectedValue` — deal value times an uncalibrated
 * stage baseline — while the screen it links to ("Open today's priorities")
 * ordered by what was overdue. So the email named a different deal first
 * than the page it opened, and the renderers printed "deal value x win
 * probability" underneath as if that were the method. The order now comes
 * from `getFollowUps`, which is the ranking Today itself uses.
 */

/** How many deals a digest lists before it stops being readable. */
const DIGEST_DEALS = 5;

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function toNotifiedDeal(
  opp: EnrichedOpportunity,
  followUp?: FollowUpListItem
): NotifiedDeal {
  return {
    opportunityId: opp.id,
    company: opp.account.name,
    stage: STAGE_LABELS[opp.stage as OpportunityStage] ?? opp.stage,
    dealValue: opp.dealValue,
    currency: opp.currency,
    // Today's own wording for this deal when it is on today's list, so the
    // mail and the card cannot describe the same deal differently.
    reason:
      followUp?.because ??
      opp.primaryLeak?.summary ??
      opp.whyNow[0]?.replace(/^[+−-]\s*/, "") ??
      "Steady engagement.",
    risk: followUp ? RISK_LABEL[followUp.risk] : null,
    basis: followUp ? BASIS_LABEL[followUp.basis] : null,
    daysOverdue: followUp?.daysOverdue ?? null,
    nextAction: followUp?.action ?? opp.nextAction.headline,
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
  const [overview, opportunities, followUps] = await Promise.all([
    getRevenueOverview(opts.orgId),
    loadEnrichedOpportunities(opts.orgId, { stages: [...OPEN_STAGES] }),
    getFollowUps(opts.orgId, now),
  ]);

  if (!overview.hasData || opportunities.length === 0) return null;

  // Today's order, not a second opinion about it. Deals that are not on the
  // list follow, largest first, so a quiet morning still sends something
  // rather than an empty mail.
  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const followUpById = new Map(followUps.map((f) => [f.opportunityId, f]));
  const onToday = followUps
    .map((f) => byId.get(f.opportunityId))
    .filter((o): o is EnrichedOpportunity => Boolean(o));
  const rest = opportunities
    .filter((o) => !followUpById.has(o.id))
    .sort((a, b) => b.dealValue - a.dealValue);

  const ranked = [...onToday, ...rest];
  const deals = ranked
    .slice(0, DIGEST_DEALS)
    .map((o) => toNotifiedDeal(o, followUpById.get(o.id)));

  const needing = onToday.length;
  const headline =
    needing > 0
      ? `${needing} deal${needing === 1 ? "" : "s"} need a follow-up today.`
      : `Nothing is overdue. ${formatMoney(overview.totalOpenPipeline, overview.currency)} of open pipeline.`;

  return {
    kind: "daily_digest",
    // One per user per local day: a retried cron cannot send a second copy.
    dedupeKey: `daily_digest:${localDayKey(now, opts.timezone)}`,
    subject:
      needing > 0
        ? `${needing} follow-up${needing === 1 ? "" : "s"} due — today's priorities`
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
  const [opportunities, followUps] = await Promise.all([
    loadEnrichedOpportunities(opts.orgId, { stages: [...OPEN_STAGES] }),
    getFollowUps(opts.orgId, now),
  ]);
  const followUpById = new Map(followUps.map((f) => [f.opportunityId, f]));

  // `minAlertValue` stays a threshold on estimated expected value: it is a
  // volume control on how often Selryn interrupts someone, not a claim about
  // the deal, and moving it to deal value would quietly raise everyone's
  // alert rate. It remains one of the uncalibrated numbers in the product.
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
    const deal = toNotifiedDeal(opp, followUpById.get(opp.id));
    return {
      kind: "risk_alert" as const,
      dedupeKey: `risk_alert:${opp.id}:${window}`,
      subject: `${deal.company} — ${deal.risk ?? "needs attention"}`,
      headline: `${deal.company}: ${deal.reason}`,
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

/**
 * An escalation: one deal, raised to whoever can unblock it.
 *
 * Composed here beside the digest so it reads from the same enriched
 * opportunity and cannot drift from what the screen says. Deliberately not a
 * digest of everything — an escalation that arrives as a list is a report,
 * and a manager reading a report does not know they have been asked for
 * something.
 */
export async function composeEscalation(opts: {
  orgId: string;
  opportunityId: string;
  raisedBy: string;
  note: string;
}): Promise<NotificationMessage | null> {
  const [opp] = await loadEnrichedOpportunities(opts.orgId).then((all) =>
    all.filter((o) => o.id === opts.opportunityId)
  );
  if (!opp) return null;

  const deal = toNotifiedDeal(opp);

  return {
    kind: "escalation",
    // One per deal per raiser per day: a second escalation on the same deal
    // the same day is the same request, not a new one.
    dedupeKey: `escalation:${opts.opportunityId}:${opts.raisedBy}:${localDayKey(new Date(), "UTC")}`,
    subject: `Escalation — ${deal.company} (${formatMoney(opp.expectedValue, opp.currency)} expected)`,
    headline: `${opts.raisedBy} has escalated ${deal.company}.`,
    deals: [deal],
    summary: {
      revenueAtRisk: formatMoney(opp.atRisk, opp.currency),
      openPipeline: formatMoney(opp.dealValue, opp.currency),
      openCount: 1,
    },
    primaryUrl: deal.url,
    primaryLabel: `Open ${deal.company}`,
  };
}
