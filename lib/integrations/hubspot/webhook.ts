import "server-only";
import crypto from "node:crypto";
import { safeEqual } from "@/lib/security/crypto";

/**
 * HubSpot webhook signature verification (v3).
 *
 * A webhook endpoint is an unauthenticated door into a customer's data. Any
 * request that reaches it can claim a deal moved stage, and Selryn would
 * score, recommend and surface on that basis. Verification is the only thing
 * standing between "HubSpot said so" and "somebody said so".
 *
 * v3 rather than v1/v2: it signs the method, URI and timestamp as well as the
 * body, so a valid signature cannot be lifted from one request and replayed
 * against another endpoint. v1 signs only the body and app secret, which is
 * why HubSpot deprecated it.
 */

/**
 * HubSpot's own maximum. A signature older than this is refused even if it
 * verifies - without a timestamp bound, a single captured request stays
 * replayable forever.
 */
export const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string; status: 400 | 401 | 503 };

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_CLIENT_SECRET);
}

/**
 * Verifies a v3 signature.
 *
 * The raw body must be the exact bytes received. Parsing and re-serialising
 * JSON changes key order and whitespace, and the signature is over the string
 * HubSpot sent - which is why the route reads `await req.text()` and parses
 * only after this returns ok.
 */
export function verifyWebhookSignature(opts: {
  method: string;
  /** Full request URI, including scheme and host, as HubSpot called it. */
  uri: string;
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  now?: number;
}): VerifyResult {
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret) {
    // Not the caller's fault, and not something to accept blindly.
    return { ok: false, reason: "Webhook verification is not configured.", status: 503 };
  }
  if (!opts.signature || !opts.timestamp) {
    return { ok: false, reason: "Missing signature headers.", status: 401 };
  }

  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "Malformed timestamp header.", status: 400 };
  }

  // Checked before the HMAC: an expired request should not consume the work,
  // and rejecting on age first keeps the expensive path behind a cheap gate.
  const age = (opts.now ?? Date.now()) - ts;
  if (age > MAX_SIGNATURE_AGE_MS) {
    return { ok: false, reason: "Signature too old.", status: 401 };
  }
  // A timestamp far in the future is equally suspect - it would extend the
  // replay window rather than shorten it.
  if (age < -MAX_SIGNATURE_AGE_MS) {
    return { ok: false, reason: "Signature timestamp is in the future.", status: 401 };
  }

  const base = `${opts.method.toUpperCase()}${opts.uri}${opts.rawBody}${opts.timestamp}`;
  const expected = crypto.createHmac("sha256", secret).update(base, "utf8").digest("base64");

  if (!safeEqual(expected, opts.signature)) {
    return { ok: false, reason: "Signature did not match.", status: 401 };
  }
  return { ok: true };
}

/** One notification in a HubSpot webhook batch. */
export interface HubspotNotification {
  eventId: number;
  subscriptionType: string;
  portalId: number;
  occurredAt: number;
  objectId: number;
  propertyName?: string;
  propertyValue?: string;
  changeSource?: string;
}

/**
 * Parses a verified body into notifications.
 *
 * Tolerant on purpose: a malformed entry in a batch of a hundred should cost
 * that one entry, not the other ninety-nine. HubSpot will not redeliver the
 * good ones just because a neighbour was bad.
 */
export function parseNotifications(rawBody: string): HubspotNotification[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((n): n is HubspotNotification => {
    if (typeof n !== "object" || n === null) return false;
    const c = n as Record<string, unknown>;
    return (
      typeof c.eventId === "number" &&
      typeof c.subscriptionType === "string" &&
      typeof c.objectId === "number" &&
      typeof c.occurredAt === "number"
    );
  });
}

/**
 * Maps a HubSpot subscription type onto Selryn's event vocabulary.
 *
 * Unknown types return null and are skipped rather than stored under a
 * guessed name: an event graph with invented types is worse than one with
 * gaps, because the gaps are visible.
 */
export function toEventType(subscriptionType: string, propertyName?: string): string | null {
  switch (subscriptionType) {
    case "deal.creation":
      return "deal.created";
    case "deal.deletion":
      return "deal.deleted";
    case "deal.propertyChange":
      if (propertyName === "dealstage") return "deal.stage_changed";
      if (propertyName === "amount") return "deal.amount_changed";
      if (propertyName === "closedate") return "deal.close_date_changed";
      if (propertyName === "hubspot_owner_id") return "deal.owner_changed";
      return "deal.property_changed";
    case "contact.creation":
      return "contact.created";
    case "contact.propertyChange":
      return "contact.property_changed";
    case "company.creation":
      return "company.created";
    case "company.propertyChange":
      return "company.property_changed";
    default:
      return null;
  }
}

/**
 * Who caused a change.
 *
 * HubSpot's `changeSource` distinguishes a rep editing a record from a form
 * the buyer filled in. Scoring depends on the difference: counting a rep's own
 * CRM hygiene as buyer engagement is how these systems end up measuring
 * activity instead of intent. Anything unrecognised is attributed to the
 * system rather than optimistically to the buyer.
 */
export function toActorType(changeSource?: string): "buyer" | "seller" | "system" {
  switch (changeSource) {
    case "FORM":
    case "EMAIL":
    case "MEETING":
      return "buyer";
    case "CRM_UI":
    case "SALES":
    case "MOBILE_IOS":
    case "MOBILE_ANDROID":
      return "seller";
    default:
      return "system";
  }
}
