import "server-only";
import crypto from "node:crypto";
import { safeEqual } from "@/lib/security/crypto";

/**
 * One-click unsubscribe links.
 *
 * The token is a keyed MAC of the user id, not the id itself: an unsubscribe
 * URL travels through mail servers and gets scanned by link checkers, so it
 * must not be guessable and must not be forgeable into someone else's.
 *
 * There is no expiry. An unsubscribe link that stopped working would be worse
 * than one that lasts — the person clicking it in a six-month-old email wants
 * out now, and telling them the link expired is not an acceptable answer.
 */

function secret(): string {
  const key = process.env.NOTIFICATION_SIGNING_KEY || process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "NOTIFICATION_SIGNING_KEY (or ENCRYPTION_KEY) must be set to sign unsubscribe links."
    );
  }
  return key;
}

export function isUnsubscribeConfigured(): boolean {
  return Boolean(process.env.NOTIFICATION_SIGNING_KEY || process.env.ENCRYPTION_KEY);
}

export function signUnsubscribe(userId: string): string {
  return crypto.createHmac("sha256", secret()).update(`unsub:${userId}`).digest("base64url");
}

export function verifyUnsubscribe(userId: string, token: string): boolean {
  try {
    return safeEqual(signUnsubscribe(userId), token);
  } catch {
    return false;
  }
}

export function unsubscribeUrl(appUrl: string, userId: string): string {
  return `${appUrl}/api/notifications/unsubscribe?u=${encodeURIComponent(userId)}&t=${signUnsubscribe(userId)}`;
}
