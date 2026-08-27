import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  DecryptionError,
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
  redact,
  safeEqual,
  stableHash,
} from "@/lib/security/crypto";

// A static import is safe here because crypto.ts reads process.env inside
// key(), at call time, rather than at module scope - which is exactly so a
// test (or a key rotation) can change it without reimporting.
before(() => {
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

test("a secret round-trips", () => {
  const token = "pat-na1-" + "x".repeat(60);
  assert.equal(decryptSecret(encryptSecret(token)), token);
});

test("ciphertext never contains the plaintext", () => {
  const secret = "super-secret-refresh-token";
  const stored = encryptSecret(secret);
  assert.ok(!stored.includes(secret));
});

test("encrypting twice gives different ciphertext", () => {
  // A fresh IV each time. Deterministic ciphertext would leak that two
  // workspaces hold the same token.
  const a = encryptSecret("same");
  const b = encryptSecret("same");
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), decryptSecret(b));
});

test("a tampered ciphertext fails instead of decrypting to garbage", () => {
  // This is the whole reason for GCM over CBC.
  const stored = encryptSecret("original-token");
  const [v, iv, tag, data] = stored.split(".");
  const flipped = Buffer.from(data, "base64url");
  flipped[0] ^= 0xff;
  const tampered = [v, iv, tag, flipped.toString("base64url")].join(".");

  assert.throws(() => decryptSecret(tampered), DecryptionError);
});

test("a wrong key fails closed", () => {
  const stored = encryptSecret("token");
  const original = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  assert.throws(() => decryptSecret(stored), DecryptionError);
  process.env.ENCRYPTION_KEY = original;
});

test("a malformed or wrongly-versioned envelope is rejected", () => {
  assert.throws(() => decryptSecret("not-an-envelope"), DecryptionError);
  assert.throws(() => decryptSecret("v9.a.b.c"), DecryptionError);
});

test("a key of the wrong length is refused rather than padded", () => {
  const original = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
  assert.equal(isEncryptionConfigured(), false);
  assert.throws(() => encryptSecret("x"), /32 bytes/);
  process.env.ENCRYPTION_KEY = original;
});

test("safeEqual matches only identical strings", () => {
  assert.equal(safeEqual("abc123", "abc123"), true);
  assert.equal(safeEqual("abc123", "abc124"), false);
  // Different lengths must return false, not throw - timingSafeEqual does.
  assert.equal(safeEqual("short", "much-longer-value"), false);
  assert.equal(safeEqual("", ""), true);
});

test("stableHash is stable, and separates different inputs", () => {
  assert.equal(stableHash("a", "b"), stableHash("a", "b"));
  assert.notEqual(stableHash("a", "b"), stableHash("b", "a"));
  assert.equal(stableHash("x").length, 32);
});

test("redact removes secrets by key name", () => {
  const out = redact({
    accessToken: "should-not-survive",
    refresh_token: "nor-this",
    apiKey: "nor-this-either",
    Authorization: "Bearer abc",
    portalId: 12345,
    name: "Cloudmint",
  }) as Record<string, unknown>;

  assert.equal(out.accessToken, "[redacted]");
  assert.equal(out.refresh_token, "[redacted]");
  assert.equal(out.apiKey, "[redacted]");
  assert.equal(out.Authorization, "[redacted]");
  // Harmless fields survive, or the log is useless.
  assert.equal(out.portalId, 12345);
  assert.equal(out.name, "Cloudmint");
});

test("redact reaches into nested objects and arrays", () => {
  const out = redact({
    connection: { provider: "hubspot", credentials: { accessToken: "leak" } },
    items: [{ secret: "leak" }],
  }) as Record<string, Record<string, Record<string, unknown>>>;

  assert.equal(out.connection.credentials.accessToken, "[redacted]");
  assert.equal(
    (out.items as unknown as Record<string, string>[])[0].secret,
    "[redacted]"
  );
});

test("a long bare string is masked even without a telling key name", () => {
  const masked = redact({ note: "y".repeat(80) }) as Record<string, string>;
  assert.ok(masked.note.endsWith("[redacted]"));
  assert.ok(masked.note.length < 80);
});

test("redact terminates on a cyclic object", () => {
  const cyclic: Record<string, unknown> = { name: "loop" };
  cyclic.self = cyclic;
  // Depth-capped rather than stack-overflowing on a logged Prisma object.
  assert.doesNotThrow(() => redact(cyclic));
});
