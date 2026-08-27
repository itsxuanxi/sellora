import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  parseNotifications,
  toActorType,
  toEventType,
  verifyWebhookSignature,
} from "@/lib/integrations/hubspot/webhook";
import { ingestEvents, type IngestEvent } from "@/lib/events/ingest";

/**
 * HubSpot webhook receiver.
 *
 * An unauthenticated door into a customer's data, so the order of operations
 * is the security property:
 *
 *   1. Read the body as raw bytes. Parsing and re-serialising JSON changes key
 *      order and whitespace, and the signature is over the exact string
 *      HubSpot sent.
 *   2. Verify the v3 signature and its timestamp before touching anything.
 *   3. Only then parse, map and ingest.
 *
 * Returns 200 on anything it has durably accepted, including batches where
 * individual notifications were unmappable. HubSpot retries non-2xx, and
 * retrying a batch because one entry used an unknown subscription type would
 * redeliver it forever.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  const verification = verifyWebhookSignature({
    method: "POST",
    // Must match the URI HubSpot signed. NEXT_PUBLIC_APP_URL is preferred over
    // req.url because a proxy can rewrite the incoming host and invalidate an
    // otherwise-valid signature.
    uri: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin}${
      new URL(req.url).pathname
    }`,
    rawBody,
    signature: req.headers.get("x-hubspot-signature-v3"),
    timestamp: req.headers.get("x-hubspot-request-timestamp"),
  });

  if (!verification.ok) {
    // Logged without the body: an unverified payload is attacker-controlled.
    console.warn("[hubspot] rejected webhook:", verification.reason);
    return NextResponse.json({ error: verification.reason }, { status: verification.status });
  }

  const notifications = parseNotifications(rawBody);
  if (notifications.length === 0) return NextResponse.json({ received: 0 });

  // One batch is always one portal. Resolving the tenant from the payload -
  // rather than from a session that does not exist here - is what keeps the
  // write tenant-scoped.
  const portalId = String(notifications[0].portalId);
  const connection = await db.integrationConnection.findFirst({
    where: { provider: "hubspot", externalAccountId: portalId },
    select: { id: true, orgId: true, status: true },
  });

  if (!connection) {
    // A signature-valid delivery for a portal nobody has connected. Accepted
    // so HubSpot stops retrying, but deliberately not stored anywhere.
    console.warn("[hubspot] webhook for unknown portal", portalId);
    return NextResponse.json({ received: 0, reason: "portal not connected" });
  }
  if (connection.status === "REVOKED") {
    return NextResponse.json({ received: 0, reason: "connection revoked" });
  }

  const events: IngestEvent[] = [];
  let skipped = 0;

  for (const n of notifications) {
    const eventType = toEventType(n.subscriptionType, n.propertyName);
    if (!eventType) {
      // Unknown subscription types are skipped rather than stored under a
      // guessed name. Gaps in the event graph are visible; invented types are not.
      skipped++;
      continue;
    }

    events.push({
      orgId: connection.orgId,
      connectionId: connection.id,
      source: "hubspot",
      sourceEventId: String(n.eventId),
      eventType,
      occurredAt: new Date(n.occurredAt),
      actorType: toActorType(n.changeSource),
      normalizedProperties: {
        objectId: n.objectId,
        propertyName: n.propertyName,
        propertyValue: n.propertyValue,
        changeSource: n.changeSource,
        subscriptionType: n.subscriptionType,
      },
    });
  }

  try {
    const result = await ingestEvents(events);
    return NextResponse.json({
      received: notifications.length,
      created: result.created,
      duplicates: result.duplicates,
      skipped,
    });
  } catch (err) {
    // A storage failure is the one case worth a non-2xx: HubSpot's retry is a
    // free second chance, and the events are idempotent so a redelivery is safe.
    console.error("[hubspot] webhook ingest failed:", err);
    return NextResponse.json({ error: "Could not store events." }, { status: 500 });
  }
}
