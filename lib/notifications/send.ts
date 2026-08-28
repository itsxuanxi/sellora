import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { isSimulated, simulatedId } from "@/lib/sandbox";
import { recordAudit } from "@/lib/security/audit";
import { renderNotificationEmail } from "@/lib/notifications/email-template";
import { unsubscribeUrl } from "@/lib/notifications/unsubscribe";
import { appUrl } from "@/lib/notifications/digest";
import type { NotificationMessage } from "@/lib/notifications/types";

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
  toAddress: string;
  workspaceName: string;
  orgIsSample: boolean;
  message: NotificationMessage;
  resendApiKey?: string | null;
  now?: Date;
}): Promise<DeliveryOutcome> {
  const now = opts.now ?? new Date();
  const sandbox = isSimulated({ orgIsSample: opts.orgIsSample });

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
        channel: "email",
        dedupeKey: opts.message.dedupeKey,
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
