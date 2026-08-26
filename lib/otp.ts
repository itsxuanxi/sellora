import "server-only";
import { createHash, randomInt } from "node:crypto";

/**
 * One-time sign-in codes for the built-in auth mode. Works with either an
 * email address or a phone number as the identifier.
 */

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;

export type OtpChannel = "email" | "phone";

export interface NormalizedIdentifier {
  value: string;
  channel: OtpChannel;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{6,15}$/;

/**
 * Accepts an email or a phone number (spaces/dashes/parens tolerated) and
 * returns the canonical form, or null if it's neither.
 */
export function normalizeIdentifier(raw: string): NormalizedIdentifier | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    return EMAIL_RE.test(email) && email.length <= 200
      ? { value: email, channel: "email" }
      : null;
  }
  const phone = trimmed.replace(/[\s\-()]/g, "");
  return PHONE_RE.test(phone) ? { value: phone, channel: "phone" } : null;
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
