"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { composeDailyDigest } from "@/lib/notifications/digest";
import { deliverNotification } from "@/lib/notifications/send";

/**
 * Notification preferences, owned by the person they describe.
 *
 * Every query is scoped by `userId` *and* `orgId` from the session — a
 * preference row is reachable by user id alone, and scoping by that alone
 * would let a crafted request edit a colleague's settings.
 */

const prefsSchema = z.object({
  dailyDigest: z.boolean(),
  riskAlerts: z.boolean(),
  digestHour: z.coerce.number().int().min(0).max(23),
  timezone: z.string().min(1).max(64),
  weekdaysOnly: z.boolean(),
  minAlertValue: z.coerce.number().int().min(0).max(100_000_000),
  alertCooldownHours: z.coerce.number().int().min(1).max(168),
});

export type NotificationPrefsInput = z.infer<typeof prefsSchema>;

/** Rejects a zone the scheduler could not convert, rather than storing it. */
function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateNotificationPreferences(
  input: NotificationPrefsInput
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const data = prefsSchema.parse(input);

    if (!isValidTimezone(data.timezone)) {
      return { ok: false, error: `“${data.timezone}” is not a time zone Selryn can use.` };
    }

    await db.notificationPreference.upsert({
      where: { userId: session.id },
      create: { ...data, orgId: session.orgId, userId: session.id },
      // Turning anything back on clears a previous unsubscribe: the person is
      // in the settings screen asking for mail, which is a clearer signal than
      // the footer click that turned it off.
      update: {
        ...data,
        ...(data.dailyDigest || data.riskAlerts ? { unsubscribedAt: null } : {}),
      },
    });

    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not save your notification preferences.");
  }
}

/**
 * Sends the digest to the signed-in user immediately.
 *
 * Runs the real composer and the real sender — including the rate limit and
 * the sandbox rule — so a preview cannot look different from the scheduled
 * article. Only the dedupe key differs, because a preview is explicitly a
 * second copy of something already sent today.
 */
export async function sendDigestNow(): Promise<ActionResult<string>> {
  try {
    const session = await requireSession();
    if (!session.email) {
      return { ok: false, error: "Your account has no email address to send to." };
    }

    const pref = await db.notificationPreference.findUnique({
      where: { userId: session.id },
      select: { timezone: true },
    });

    const message = await composeDailyDigest({
      orgId: session.orgId,
      timezone: pref?.timezone ?? "UTC",
    });
    if (!message) {
      return {
        ok: false,
        error:
          "There is nothing to report yet — add accounts or run an analysis, then try again.",
      };
    }

    const settings = await db.settings.findUnique({
      where: { orgId: session.orgId },
      select: { resendApiKey: true },
    });

    const outcome = await deliverNotification({
      orgId: session.orgId,
      userId: session.id,
      toAddress: session.email,
      workspaceName: session.org.name,
      orgIsSample: session.org.isSample,
      message: { ...message, dedupeKey: `preview:${Date.now()}` },
      resendApiKey: settings?.resendApiKey,
    });

    revalidatePath("/settings");

    switch (outcome.status) {
      case "sent":
        return {
          ok: true,
          data: outcome.simulated
            ? "Composed and recorded — not delivered, because this workspace simulates sending."
            : `Sent to ${session.email}.`,
        };
      case "rate_limited":
        return { ok: false, error: "You have hit today's notification limit. Try again tomorrow." };
      case "duplicate":
        return { ok: false, error: "That digest has already been sent." };
      case "failed":
        return { ok: false, error: outcome.reason };
    }
  } catch (e) {
    return actionError(e, "Could not send the digest.");
  }
}
