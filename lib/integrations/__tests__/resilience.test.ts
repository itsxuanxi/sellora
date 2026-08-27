import { test } from "node:test";
import assert from "node:assert/strict";
import { backoffDelay, HubspotApiError } from "@/lib/integrations/hubspot/client";
import { nextRetryDelay } from "@/lib/integrations/sync-runner";
import { eventIdempotencyKey } from "@/lib/events/ingest";

test("only transient HubSpot failures are marked retryable", () => {
  // Retrying a 400 sends the same malformed request again; retrying a 401
  // burns the portal's rate limit on a token that is definitively dead.
  assert.equal(new HubspotApiError(429, "").retryable, true);
  assert.equal(new HubspotApiError(500, "").retryable, true);
  assert.equal(new HubspotApiError(503, "").retryable, true);

  assert.equal(new HubspotApiError(400, "").retryable, false);
  assert.equal(new HubspotApiError(401, "").retryable, false);
  assert.equal(new HubspotApiError(403, "").retryable, false);
  assert.equal(new HubspotApiError(404, "").retryable, false);
});

test("an API error never echoes the whole response body", () => {
  const huge = "x".repeat(5000);
  assert.ok(new HubspotApiError(500, huge).message.length < 300);
});

test("client backoff grows and stays bounded", () => {
  // Sampled: the delay is jittered, so the assertion is on the envelope.
  const ceilingAt = (attempt: number) =>
    Math.max(...Array.from({ length: 200 }, () => backoffDelay(attempt)));

  assert.ok(ceilingAt(0) <= 500);
  assert.ok(ceilingAt(3) > ceilingAt(0));
  // Capped, or a long outage schedules a retry hours away.
  assert.ok(ceilingAt(20) <= 30_000);
});

test("client backoff is jittered, not a fixed ramp", () => {
  // A portal-wide 429 fails every in-flight request at once. Without jitter
  // they all retry on the same schedule and re-collide indefinitely.
  const samples = new Set(Array.from({ length: 60 }, () => backoffDelay(6)));
  assert.ok(samples.size > 10, "backoff appears deterministic");
});

test("Retry-After is honoured over the computed backoff", () => {
  // The provider knows better than the client when it will accept traffic.
  assert.equal(backoffDelay(0, 12_000), 12_000);
  // Still bounded: a hostile or mistaken header cannot park a job for hours.
  assert.equal(backoffDelay(0, 999_999), 30_000);
  // A zero or absent value falls back to the computed delay.
  assert.ok(backoffDelay(1, 0) <= 1000);
});

test("job backoff grows and is bounded", () => {
  const at = (attempt: number) =>
    Math.max(...Array.from({ length: 200 }, () => nextRetryDelay(attempt)));

  assert.ok(at(0) <= 2_000);
  assert.ok(at(4) > at(1));
  assert.ok(at(30) <= 15 * 60 * 1000);
  // Never zero: an immediate retry is just a tighter failure loop.
  assert.ok(Math.min(...Array.from({ length: 50 }, () => nextRetryDelay(3))) > 0);
});

test("the same logical event yields the same idempotency key", () => {
  const base = {
    orgId: "org_1",
    source: "hubspot",
    sourceEventId: "evt_9",
    eventType: "deal.stage_changed",
    occurredAt: new Date("2026-08-20T10:00:00Z"),
  };
  assert.equal(eventIdempotencyKey(base), eventIdempotencyKey({ ...base }));
});

test("a redelivery milliseconds later collapses onto the same key", () => {
  // Providers redeliver with drifting timestamps; keying on the exact instant
  // would treat one event as two.
  const a = eventIdempotencyKey({
    orgId: "org_1",
    source: "hubspot",
    sourceEventId: "evt_9",
    eventType: "deal.stage_changed",
    occurredAt: new Date("2026-08-20T10:00:00.000Z"),
  });
  const b = eventIdempotencyKey({
    orgId: "org_1",
    source: "hubspot",
    sourceEventId: "evt_9",
    eventType: "deal.stage_changed",
    occurredAt: new Date("2026-08-20T23:59:59.999Z"),
  });
  assert.equal(a, b);
});

test("keys never collide across tenants", () => {
  // Two customers' CRMs will issue the same object ids. Without orgId in the
  // key, one tenant's event would suppress another's.
  const forOrg = (orgId: string) =>
    eventIdempotencyKey({
      orgId,
      source: "hubspot",
      sourceEventId: "evt_1",
      eventType: "deal.created",
      occurredAt: new Date("2026-08-20T10:00:00Z"),
    });
  assert.notEqual(forOrg("org_a"), forOrg("org_b"));
});

test("different event types on one object stay distinct", () => {
  const withType = (eventType: string) =>
    eventIdempotencyKey({
      orgId: "org_1",
      source: "hubspot",
      sourceEventId: "evt_1",
      eventType,
      occurredAt: new Date("2026-08-20T10:00:00Z"),
    });
  assert.notEqual(withType("deal.stage_changed"), withType("deal.amount_changed"));
});
