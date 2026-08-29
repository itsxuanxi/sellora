import "server-only";
import { db } from "@/lib/db";
import {
  composeDailyDigest,
  composeRiskAlerts,
  recipientsFor,
} from "@/lib/notifications/digest";
import { deliverNotification, type DeliveryOutcome } from "@/lib/notifications/send";
import { readConfig, SLACK_PROVIDER } from "@/lib/integrations/slack/oauth";

/**
 * Deciding who hears from Selryn, and when.
 *
 * Asks, for each subscriber, "is their digest due where they are, and have
 * they had it today?" — not "is it exactly their hour right now". That
 * distinction is what makes the job correct at whatever frequency the
 * deployment can actually run it:
 *
 *   - Hourly (Vercel Pro): everyone gets the digest within an hour of the
 *     time they picked. This is the intended configuration.
 *   - Daily (Vercel Hobby, the current plan): one tick, and everyone whose
 *     local time is inside their window at that moment gets it. Some people
 *     will be outside their window and get nothing — a real limitation of the
 *     plan, not something to paper over by mailing a stale digest at 11pm.
 *
 * Either way nobody gets two, because the dedupe key is the recipient's own
 * local date and the insert race in `deliverNotification` settles ties.
 */

/** The recipient's current local hour, 0-23. UTC if the zone is unusable. */
export function localHour(now: Date, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(now);
    const hour = Number.parseInt(formatted, 10);
    return Number.isNaN(hour) ? now.getUTCHours() : hour % 24;
  } catch {
    return now.getUTCHours();
  }
}

/** Local weekday, 0=Sunday. */
export function localWeekday(now: Date, timezone: string): number {
  try {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).format(now);
    const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
    return index === -1 ? now.getUTCDay() : index;
  } catch {
    return now.getUTCDay();
  }
}

export function isWeekend(now: Date, timezone: string): boolean {
  const day = localWeekday(now, timezone);
  return day === 0 || day === 6;
}

/**
 * How long after the chosen hour a digest is still worth sending.
 *
 * Bounded because "today's priorities" arriving at bedtime is not a late
 * delivery, it is the wrong message. Outside the window the tick sends
 * nothing and tomorrow's key is a fresh chance.
 */
export const DIGEST_WINDOW_HOURS = 11;

export function digestIsDue(
  now: Date,
  timezone: string,
  digestHour: number,
  windowHours = DIGEST_WINDOW_HOURS
): boolean {
  const hour = localHour(now, timezone);
  return hour >= digestHour && hour <= digestHour + windowHours;
}

export interface SchedulerReport {
  digestsConsidered: number;
  digestsSent: number;
  slackPosts: number;
  alertsSent: number;
  duplicates: number;
  rateLimited: number;
  failures: number;
  simulated: number;
}

function tally(report: SchedulerReport, outcome: DeliveryOutcome, kind: "digest" | "alert") {
  switch (outcome.status) {
    case "sent":
      if (kind === "digest") report.digestsSent++;
      else report.alertsSent++;
      if (outcome.simulated) report.simulated++;
      break;
    case "duplicate":
      report.duplicates++;
      break;
    case "rate_limited":
      report.rateLimited++;
      break;
    case "failed":
      report.failures++;
      break;
  }
}

/**
 * One scheduler tick.
 *
 * `orgId` narrows the run to a single workspace, which is what the settings
 * page's "Send me one now" uses — same code path as the cron, so a preview
 * cannot look different from the real thing.
 */
export async function runNotificationTick(opts: {
  now?: Date;
  orgId?: string;
  /** Ignore the clock — used by the manual preview. */
  force?: boolean;
} = {}): Promise<SchedulerReport> {
  const now = opts.now ?? new Date();
  const report: SchedulerReport = {
    digestsConsidered: 0,
    digestsSent: 0,
    slackPosts: 0,
    alertsSent: 0,
    duplicates: 0,
    rateLimited: 0,
    failures: 0,
    simulated: 0,
  };

  // ── Daily digests ──
  for (const pref of await recipientsFor("daily_digest")) {
    if (opts.orgId && pref.orgId !== opts.orgId) continue;
    report.digestsConsidered++;

    if (!opts.force) {
      if (!digestIsDue(now, pref.timezone, pref.digestHour)) continue;
      if (pref.weekdaysOnly && isWeekend(now, pref.timezone)) continue;
    }
    if (!pref.user.email) continue;

    const message = await composeDailyDigest({
      orgId: pref.orgId,
      timezone: pref.timezone,
      now,
    });
    // Nothing to report is a reason not to send, not a reason to send an
    // empty email.
    if (!message) continue;

    const settings = await db.settings.findUnique({
      where: { orgId: pref.orgId },
      select: { resendApiKey: true },
    });

    tally(
      report,
      await deliverNotification({
        orgId: pref.orgId,
        userId: pref.userId,
        toAddress: pref.user.email,
        workspaceName: pref.org.name,
        orgIsSample: pref.org.isSample,
        message,
        resendApiKey: settings?.resendApiKey,
        now,
      }),
      "digest"
    );
  }

  // ── Slack: one post per workspace, not one per subscriber ──
  //
  // A channel is a shared surface, so the digest belongs to the workspace
  // rather than to each person who happens to have email turned on. Posting
  // per subscriber would put the same message in the same channel five
  // times, which is how a useful channel becomes a muted one.
  for (const org of await workspacesWithSlack(opts.orgId)) {
    const message = await composeDailyDigest({
      orgId: org.id,
      timezone: org.timezone,
      now,
    });
    if (!message) continue;
    if (!opts.force && !digestIsDue(now, org.timezone, org.digestHour)) continue;
    if (!opts.force && org.weekdaysOnly && isWeekend(now, org.timezone)) continue;

    const outcome = await deliverNotification({
      orgId: org.id,
      userId: org.notifyUserId,
      channel: "slack",
      toAddress: "slack",
      workspaceName: org.name,
      orgIsSample: org.isSample,
      message,
      now,
    });
    if (outcome.status === "sent") report.slackPosts++;
    else if (outcome.status === "duplicate") report.duplicates++;
    else if (outcome.status === "failed") report.failures++;
  }

  // ── Risk alerts ──
  for (const pref of await recipientsFor("risk_alerts")) {
    if (opts.orgId && pref.orgId !== opts.orgId) continue;
    if (!pref.user.email) continue;

    const messages = await composeRiskAlerts({
      orgId: pref.orgId,
      minAlertValue: pref.minAlertValue,
      cooldownHours: pref.alertCooldownHours,
      now,
    });

    const settings = await db.settings.findUnique({
      where: { orgId: pref.orgId },
      select: { resendApiKey: true },
    });

    for (const message of messages) {
      const outcome = await deliverNotification({
        orgId: pref.orgId,
        userId: pref.userId,
        toAddress: pref.user.email,
        workspaceName: pref.org.name,
        orgIsSample: pref.org.isSample,
        message,
        resendApiKey: settings?.resendApiKey,
        now,
      });
      tally(report, outcome, "alert");
      // Once the ceiling is hit, stop composing for this person rather than
      // grinding through the remaining deals to be refused each time.
      if (outcome.status === "rate_limited") break;
    }
  }

  return report;
}

/**
 * Workspaces with a Slack channel actually chosen.
 *
 * The digest's timing follows the workspace owner's preference, because a
 * channel has no timezone of its own and someone has to decide. Orgs with no
 * preference row at all are skipped rather than defaulted into posting.
 */
async function workspacesWithSlack(orgId?: string) {
  const connections = await db.integrationConnection.findMany({
    where: {
      provider: SLACK_PROVIDER,
      status: "CONNECTED",
      ...(orgId ? { orgId } : {}),
    },
    select: {
      orgId: true,
      config: true,
      org: { select: { id: true, name: true, isSample: true } },
    },
  });

  const usable = [];
  for (const connection of connections) {
    if (!readConfig(connection.config).channelId) continue;

    const pref = await db.notificationPreference.findFirst({
      where: { orgId: connection.orgId, dailyDigest: true, unsubscribedAt: null },
      orderBy: { createdAt: "asc" },
      select: { userId: true, timezone: true, digestHour: true, weekdaysOnly: true },
    });
    if (!pref) continue;

    usable.push({
      id: connection.org.id,
      name: connection.org.name,
      isSample: connection.org.isSample,
      notifyUserId: pref.userId,
      timezone: pref.timezone,
      digestHour: pref.digestHour,
      weekdaysOnly: pref.weekdaysOnly,
    });
  }
  return usable;
}
