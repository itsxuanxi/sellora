import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { isSimulated, simulatedId } from "@/lib/sandbox";
import { recordAudit } from "@/lib/security/audit";
import { renderNotificationEmail } from "@/lib/notifications/email-template";
import { unsubscribeUrl } from "@/lib/notifications/unsubscribe";
import { appUrl } from "@/lib/notifications/digest";
import type { NotificationChannel, NotificationMessage } from "@/lib/notifications/types";
import { renderSlackMessage } from "@/lib/notifications/slack-message";
import { postMessage } from "@/lib/integrations/slack/client";
import { readConfig, SLACK_PROVIDER } from "@/lib/integrations/slack/oauth";

/**
 * Sending a notification, exactly once.
 *
 * Three things protect the recipient, in this order:
 *
 *  1. **Idempotency.** The `Notification` row is written *before* the send and
 *     carries a unique (orgId, dedupeKey). A retried cron, a double-fired
 *     scheduler or a concurrent worker loses the insert race and returns
 *     "duplicate" instead of sending a second copy. Recording after the send
 *     would leave a window where a crash means the recipient gets two.
 *  2. **A per-person daily ceiling.** Composition already limits what is worth
 *     saying; this limits how often we may say it, whatever the composer
 *     thinks. A product that can wake someone thirty times in a morning will
 *     eventually do it.
 *  3. **The sandbox rule.** A sample workspace records the whole lifecycle and
 *     sends nothing.
 */

/**
 * Posts to the workspace's chosen Slack channel.
 *
 * Returns the same shape as an email send so the caller records delivery
 * identically. A missing channel is a configuration state, not an error to
 * swallow: the integration is connected but has nowhere to post, and the
 * settings screen says so.
 */
async function postToSlack(
  orgId: string,
  message: NotificationMessage,
  workspaceName: string
): Promise<{ id: string; simulated: boolean; sandbox: boolean }> {
  const connection = await db.integrationConnection.findUnique({
    where: { orgId_provider: { orgId, provider: SLACK_PROVIDER } },
    select: { config: true },
  });
  const target = readConfig(connection?.config).channelId;
  if (!target) {
    throw new Error("Slack is connected but no channel has been chosen yet.");
  }

  const { text, blocks } = renderSlackMessage(message, {
    workspaceName,
    simulated: false,
  });
  const posted = await postMessage({ orgId, channel: target, text, blocks });
  // Slack's message timestamp is its identity within a channel.
  return { id: `slack_${target}_${posted.ts}`, simulated: false, sandbox: false };
}

/** Hard ceiling per person per rolling day, across every kind. */
export const MAX_NOTIFICATIONS_PER_DAY = 12;

/** Prisma's unique-constraint code. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

export type DeliveryOutcome =
  | { status: "sent"; notificationId: string; simulated: boolean }
  | { status: "duplicate" }
  | { status: "rate_limited" }
  | { status: "failed"; reason: string };

export async function deliverNotification(opts: {
  orgId: string;
  userId: string;
  /** Where it goes. Email is per-user; Slack is one workspace channel. */
  channel?: NotificationChannel;
  toAddress: string;
  workspaceName: string;
  orgIsSample: boolean;
  message: NotificationMessage;
  resendApiKey?: string | null;
  now?: Date;
}): Promise<DeliveryOutcome> {
  const now = opts.now ?? new Date();
  const sandbox = isSimulated({ orgIsSample: opts.orgIsSample });

  const channel: NotificationChannel = opts.channel ?? "email";
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const recent = await db.notification.count({
    where: { orgId: opts.orgId, userId: opts.userId, createdAt: { gte: dayAgo } },
  });
  if (recent >= MAX_NOTIFICATIONS_PER_DAY) return { status: "rate_limited" };

  // Claim the send. A unique-constraint failure here is the success case for
  // idempotency: somebody else already owns this notification.
  let notification;
  try {
    notification = await db.notification.create({
      data: {
        orgId: opts.orgId,
        userId: opts.userId,
        kind: opts.message.kind,
        channel,
        // Scoped per channel, so the same digest can reach both an inbox and
        // a Slack channel without either suppressing the other.
        dedupeKey: `${channel}:${opts.message.dedupeKey}`,
        toAddress: opts.toAddress,
        subject: opts.message.subject,
        payload: JSON.stringify(opts.message),
        status: "PENDING",
        scheduledFor: now,
      },
    });
  } catch (err) {
    // Only a unique-constraint violation means "someone else already owns
    // this". Reporting every insert failure as a duplicate would turn a
    // database outage into a silent decision not to notify anyone.
    if (isUniqueViolation(err)) return { status: "duplicate" };
    const reason = err instanceof Error ? err.message : "Could not record the notification";
    return { status: "failed", reason };
  }

  const { html, text } = renderNotificationEmail(opts.message, {
    unsubscribeUrl: unsubscribeUrl(appUrl(), opts.userId),
    workspaceName: opts.workspaceName,
    simulated: sandbox,
  });

  try {
    const result = sandbox
      ? { id: simulatedId(), simulated: true, sandbox: true }
      : channel === "slack"
        ? await postToSlack(opts.orgId, opts.message, opts.workspaceName)
        : await sendEmail({
            to: opts.toAddress,
            subject: opts.message.subject,
            body: text,
            html,
            orgApiKey: opts.resendApiKey,
          });

    await db.notification.update({
      where: { id: notification.id },
      data: {
        status: result.sandbox ? "SIMULATED" : "SENT",
        providerMessageId: result.id,
        simulated: result.simulated,
        sentAt: now,
      },
    });

    await recordAudit({
      orgId: opts.orgId,
      actorId: opts.userId,
      action: "notification.sent",
      actorType: "system",
      targetType: "notification",
      targetId: notification.id,
      metadata: {
        kind: opts.message.kind,
        to: opts.toAddress,
        delivery: result.sandbox
          ? "simulated_sandbox"
          : result.simulated
            ? "simulated_no_key"
            : "resend",
      },
    });

    return {
      status: "sent",
      notificationId: notification.id,
      simulated: result.simulated,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown send failure";
    // The row stays, marked FAILED: a notification that could not be sent is
    // a fact worth keeping, and the dedupe key stops a retry loop hammering
    // a recipient whose address is permanently broken.
    await db.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED", failureReason: reason.slice(0, 500) },
    });
    await recordAudit({
      orgId: opts.orgId,
      actorId: opts.userId,
      action: "notification.failed",
      actorType: "system",
      targetType: "notification",
      targetId: notification.id,
      metadata: { kind: opts.message.kind, to: opts.toAddress, reason: reason.slice(0, 500) },
    });
    return { status: "failed", reason };
  }
}
