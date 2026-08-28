import "server-only";
import crypto from "node:crypto";
import { safeEqual } from "@/lib/security/crypto";

/**
 * Resend webhook signature verification (Svix).
 *
 * Resend delivers events through Svix, which signs `id.timestamp.body` with a
 * base64 secret carried after a `whsec_` prefix. Verifying matters for the
 * same reason it does on the HubSpot endpoint: this URL is public, and
 * anything that reaches it can claim a message bounced. An unverified bounce
 * would let a stranger mark a customer's address undeliverable.
 *
 * The signature header can carry several space-separated `v1,<sig>` pairs
 * during a secret rotation, so any one matching is a pass.
 */

/** Svix's own tolerance. Beyond it a captured request is refused. */
export const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string; status: 400 | 401 | 503 };

export function isResendWebhookConfigured(): boolean {
  return Boolean(process.env.RESEND_WEBHOOK_SECRET);
}

export function verifyResendSignature(opts: {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  /** The exact bytes received — never a re-serialised object. */
  rawBody: string;
  now?: Date;
}): VerifyResult {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, reason: "RESEND_WEBHOOK_SECRET is not set", status: 503 };
  }
  if (!opts.id || !opts.timestamp || !opts.signature) {
    return { ok: false, reason: "Missing Svix signature headers", status: 400 };
  }

  const sentAt = Number.parseInt(opts.timestamp, 10);
  if (Number.isNaN(sentAt)) {
    return { ok: false, reason: "Malformed timestamp", status: 400 };
  }
  const age = Math.abs((opts.now ?? new Date()).getTime() - sentAt * 1000);
  if (age > MAX_WEBHOOK_AGE_MS) {
    return { ok: false, reason: "Signature too old", status: 401 };
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${opts.id}.${opts.timestamp}.${opts.rawBody}`)
    .digest("base64");

  const provided = opts.signature
    .split(" ")
    .map((part) => part.split(",")[1] ?? "")
    .filter(Boolean);

  const matched = provided.some((sig) => safeEqual(sig, expected));
  return matched ? { ok: true } : { ok: false, reason: "Signature mismatch", status: 401 };
}

/**
 * Resend's event names, mapped to the lifecycle Selryn records.
 *
 * `email.replied` is deliberately absent: Resend does not emit it. Reply
 * detection needs an inbound mailbox, which Selryn does not have, so claiming
 * a "replied" status here would be inventing data.
 */
export const RESEND_EVENT_STATUS: Record<string, string> = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "SENT",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
};

/** Later states never regress to earlier ones on out-of-order delivery. */
const RANK: Record<string, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  OPENED: 3,
  CLICKED: 4,
  BOUNCED: 5,
  COMPLAINED: 5,
  FAILED: 5,
};

export function shouldAdvance(current: string, next: string): boolean {
  return (RANK[next] ?? 0) > (RANK[current] ?? 0);
}
