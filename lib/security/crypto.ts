import "server-only";
import crypto from "node:crypto";

/**
 * Envelope encryption for integration secrets.
 *
 * OAuth access and refresh tokens are the most dangerous data Selryn holds: a
 * leaked HubSpot refresh token is standing read/write access to a customer's
 * entire CRM. They are never written to the database in plaintext.
 *
 * AES-256-GCM, because the tokens must be tamper-evident as well as secret.
 * GCM's auth tag means a modified ciphertext fails to decrypt rather than
 * yielding garbage that some code path might then send to HubSpot.
 *
 * The stored format is versioned from the start (`v1.iv.tag.ciphertext`, all
 * base64url). Rotating a key without a version prefix means rewriting every
 * row blind, and the first time you need rotation is the worst time to design
 * for it.
 */

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits: the only GCM nonce size with a security proof
const KEY_BYTES = 32;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super("ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32");
    this.name = "MissingEncryptionKeyError";
  }
}

export class DecryptionError extends Error {
  constructor(reason: string) {
    super(`Could not decrypt stored secret: ${reason}`);
    this.name = "DecryptionError";
  }
}

/**
 * Reads the key at call time rather than at module scope, so a process that
 * never touches integrations can boot without one and tests can set it.
 */
function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new MissingEncryptionKeyError();

  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${buf.length}. Generate with: openssl rand -base64 32`
    );
  }
  return buf;
}

/** Whether secrets can be stored at all. Surfaced in setup checks, never assumed. */
export function isEncryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4) throw new DecryptionError("malformed envelope");

  const [version, ivB64, tagB64, dataB64] = parts;
  if (version !== VERSION) {
    throw new DecryptionError(`unsupported envelope version "${version}"`);
  }

  try {
    const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Deliberately opaque: a failure means a wrong key or a tampered record,
    // and saying which is itself a small oracle.
    throw new DecryptionError("wrong key or tampered ciphertext");
  }
}

/**
 * Constant-time comparison, for webhook signatures and OAuth state.
 *
 * `===` on a signature leaks its matching prefix through timing. Length is
 * checked first because timingSafeEqual throws on a length mismatch, and that
 * throw would be a timing signal of its own.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** URL-safe random token, for OAuth state and SDK keys. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Stable hash for idempotency keys and dedup.
 *
 * SHA-256 truncated to 32 hex characters: 128 bits of collision resistance,
 * ample for per-tenant event keys, and narrow enough to index cheaply.
 */
export function stableHash(...parts: (string | number)[]): string {
  return crypto.createHash("sha256").update(parts.join(" ")).digest("hex").slice(0, 32);
}

/**
 * Strips secrets out of anything heading for a log line.
 *
 * Applied at the logging boundary rather than trusted to callers, because the
 * whole point is that it still works when somebody logs a whole error object
 * without thinking about what is inside it.
 */
const SENSITIVE_KEY = /(token|secret|password|authorization|api_?key|refresh|cookie|signature)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    // A bare token logged as a loose string still gets masked, by length.
    return value.length > 40 ? `${value.slice(0, 6)}[redacted]` : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}
