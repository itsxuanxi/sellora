import "server-only";
import { db } from "@/lib/db";
import {
  composeDailyDigest,
  composeRiskAlerts,
  recipientsFor,
} from "@/lib/notifications/digest";
import { deliverNotification, type DeliveryOutcome } from "@/lib/notifications/send";

/**
 * Deciding who hears from Selryn, and when.
 *
 * Runs hourly and asks, for each subscriber, "is it their digest hour where
 * they are?". The alternative — one nightly job that mails everyone at once —
 * would deliver a "today's priorities" email at 3am to half the users.
 *
 * Firing hourly means the job sees each person up to 24 times a day, so it
 * must be safe to run when there is nothing to do. It is: the digest's dedupe
 * key is the recipient's own local date, so the twenty-three ticks that are
 * not their hour compose nothing, and a tick that double-fires loses the
 * insert race in `deliverNotification`.
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

export interface SchedulerReport {
  digestsConsidered: number;
  digestsSent: number;
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
      if (localHour(now, pref.timezone) !== pref.digestHour) continue;
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
