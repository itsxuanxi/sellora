import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  RESEND_EVENT_STATUS,
  shouldAdvance,
  verifyResendSignature,
} from "@/lib/notifications/resend-webhook";

/**
 * Delivery events from Resend.
 *
 * Always answers 200 once the signature verifies, even for an event about a
 * message we do not recognise. A webhook endpoint that returns errors for
 * uninteresting events teaches the provider to retry them, and eventually to
 * disable the endpoint entirely.
 */

export const dynamic = "force-dynamic";

const TIMESTAMP_FIELD: Record<string, string> = {
  DELIVERED: "deliveredAt",
  OPENED: "openedAt",
  CLICKED: "clickedAt",
  BOUNCED: "bouncedAt",
};

export async function POST(req: Request) {
  // The signature is over the exact bytes; parse only after it verifies.
  const rawBody = await req.text();

  const verdict = verifyResendSignature({
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    rawBody,
  });
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: verdict.status });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const status = event.type ? RESEND_EVENT_STATUS[event.type] : undefined;
  const messageId = event.data?.email_id;
  if (!status || !messageId) {
    return NextResponse.json({ ok: true, ignored: event.type ?? "unknown" });
  }

  const notification = await db.notification.findUnique({
    where: { providerMessageId: messageId },
    select: { id: true, status: true },
  });
  // Not ours — Resend also carries the product's outreach mail.
  if (!notification) return NextResponse.json({ ok: true, ignored: "unknown_message" });

  // Events can arrive out of order, and the same event can be redelivered.
  // Both are handled by only ever moving forward through the lifecycle.
  if (!shouldAdvance(notification.status, status)) {
    return NextResponse.json({ ok: true, ignored: "stale_event" });
  }

  const field = TIMESTAMP_FIELD[status];
  await db.notification.update({
    where: { id: notification.id },
    data: {
      status,
      ...(field ? { [field]: new Date() } : {}),
    },
  });

  return NextResponse.json({ ok: true, status });
}
