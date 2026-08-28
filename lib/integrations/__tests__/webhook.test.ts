import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  MAX_SIGNATURE_AGE_MS,
  parseNotifications,
  toActorType,
  toEventType,
  verifyWebhookSignature,
} from "@/lib/integrations/hubspot/webhook";

const SECRET = "test-client-secret";
const URI = "https://app.selryn.ai/api/integrations/hubspot/webhook";
const NOW = 1_800_000_000_000;

before(() => {
  process.env.HUBSPOT_CLIENT_SECRET = SECRET;
});

/** Signs the way HubSpot does, so the test exercises the real construction. */
function sign(method: string, uri: string, body: string, timestamp: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${method}${uri}${body}${timestamp}`, "utf8")
    .digest("base64");
}

const BODY = JSON.stringify([
  {
    eventId: 1,
    subscriptionType: "deal.propertyChange",
    portalId: 42,
    occurredAt: NOW,
    objectId: 99,
    propertyName: "dealstage",
  },
]);

test("a correctly signed request verifies", () => {
  const ts = String(NOW);
  const result = verifyWebhookSignature({
    method: "POST",
    uri: URI,
    rawBody: BODY,
    signature: sign("POST", URI, BODY, ts),
    timestamp: ts,
    now: NOW,
  });
  assert.equal(result.ok, true);
});

test("a tampered body is rejected", () => {
  // The attack this exists to stop: a valid-looking notification claiming a
  // deal moved stage, which Selryn would then score and recommend on.
  const ts = String(NOW);
  const signature = sign("POST", URI, BODY, ts);
  const tampered = BODY.replace('"objectId":99', '"objectId":1234');

  const result = verifyWebhookSignature({
    method: "POST",
    uri: URI,
    rawBody: tampered,
    signature,
    timestamp: ts,
    now: NOW,
  });
  assert.equal(result.ok, false);
});

test("a signature is bound to its URI, so it cannot be replayed elsewhere", () => {
  // This is why v3 is used over v1, which signs only the body.
  const ts = String(NOW);
  const signature = sign("POST", URI, BODY, ts);

  const result = verifyWebhookSignature({
    method: "POST",
    uri: "https://app.selryn.ai/api/integrations/other/webhook",
    rawBody: BODY,
    signature,
    timestamp: ts,
    now: NOW,
  });
  assert.equal(result.ok, false);
});

test("a signature is bound to its method", () => {
  const ts = String(NOW);
  const result = verifyWebhookSignature({
    method: "PUT",
    uri: URI,
    rawBody: BODY,
    signature: sign("POST", URI, BODY, ts),
    timestamp: ts,
    now: NOW,
  });
  assert.equal(result.ok, false);
});

test("an old signature is refused even though it verifies", () => {
  // Without a timestamp bound, one captured request stays replayable forever.
  const oldTs = String(NOW - MAX_SIGNATURE_AGE_MS - 1000);
  const result = verifyWebhookSignature({
    method: "POST",
    uri: URI,
    rawBody: BODY,
    signature: sign("POST", URI, BODY, oldTs),
    timestamp: oldTs,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.reason : "", /too old/i);
});

test("a far-future timestamp is refused", () => {
  // Otherwise it extends the replay window instead of bounding it.
  const futureTs = String(NOW + MAX_SIGNATURE_AGE_MS + 60_000);
  const result = verifyWebhookSignature({
    method: "POST",
    uri: URI,
    rawBody: BODY,
    signature: sign("POST", URI, BODY, futureTs),
    timestamp: futureTs,
    now: NOW,
  });
  assert.equal(result.ok, false);
});

test("missing or malformed headers are refused, not assumed valid", () => {
  const base = { method: "POST", uri: URI, rawBody: BODY, now: NOW };
  assert.equal(
    verifyWebhookSignature({ ...base, signature: null, timestamp: String(NOW) }).ok,
    false
  );
  assert.equal(
    verifyWebhookSignature({ ...base, signature: "abc", timestamp: null }).ok,
    false
  );
  assert.equal(
    verifyWebhookSignature({ ...base, signature: "abc", timestamp: "not-a-number" }).ok,
    false
  );
});

test("an unconfigured secret fails closed with 503, never open", () => {
  const original = process.env.HUBSPOT_CLIENT_SECRET;
  delete process.env.HUBSPOT_CLIENT_SECRET;

  const result = verifyWebhookSignature({
    method: "POST",
    uri: URI,
    rawBody: BODY,
    signature: "anything",
    timestamp: String(NOW),
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false ? result.status : 0, 503);

  process.env.HUBSPOT_CLIENT_SECRET = original;
});

test("notifications parse, and a bad entry costs only itself", () => {
  const mixed = JSON.stringify([
    { eventId: 1, subscriptionType: "deal.creation", portalId: 1, occurredAt: NOW, objectId: 5 },
    { garbage: true },
    null,
    { eventId: 2, subscriptionType: "contact.creation", portalId: 1, occurredAt: NOW, objectId: 6 },
  ]);
  // HubSpot will not redeliver the good ones because a neighbour was bad.
  assert.equal(parseNotifications(mixed).length, 2);
});

test("malformed JSON yields nothing rather than throwing", () => {
  assert.deepEqual(parseNotifications("{not json"), []);
  assert.deepEqual(parseNotifications('{"not":"an array"}'), []);
});

test("subscription types map to Selryn's vocabulary", () => {
  assert.equal(toEventType("deal.propertyChange", "dealstage"), "deal.stage_changed");
  assert.equal(toEventType("deal.propertyChange", "amount"), "deal.amount_changed");
  assert.equal(toEventType("deal.creation"), "deal.created");
  // Unknown types are skipped, not stored under a guessed name.
  assert.equal(toEventType("ticket.merge"), null);
});

test("a rep's own CRM edit is not counted as buyer engagement", () => {
  // Getting this wrong makes the product measure its user's activity and
  // report it as customer intent.
  assert.equal(toActorType("CRM_UI"), "seller");
  assert.equal(toActorType("SALES"), "seller");
  assert.equal(toActorType("FORM"), "buyer");
  assert.equal(toActorType("EMAIL"), "buyer");
  // Unrecognised sources are attributed to the system, never optimistically
  // to the buyer.
  assert.equal(toActorType("SOMETHING_NEW"), "system");
  assert.equal(toActorType(undefined), "system");
});
