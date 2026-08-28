import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  RESEND_EVENT_STATUS,
  shouldAdvance,
  verifyResendSignature,
} from "@/lib/notifications/resend-webhook";
import { renderNotificationEmail } from "@/lib/notifications/email-template";
import { localHour, isWeekend } from "@/lib/notifications/scheduler";
import { localDayKey } from "@/lib/notifications/digest";
import type { NotificationMessage } from "@/lib/notifications/types";

// ── Webhook signature ─────────────────────────────────────────────────────

const SECRET_BYTES = crypto.randomBytes(24);
const WHSEC = `whsec_${SECRET_BYTES.toString("base64")}`;

function sign(id: string, timestamp: string, body: string): string {
  const sig = crypto
    .createHmac("sha256", SECRET_BYTES)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${sig}`;
}

function withSecret<T>(fn: () => T): T {
  const previous = process.env.RESEND_WEBHOOK_SECRET;
  process.env.RESEND_WEBHOOK_SECRET = WHSEC;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = previous;
  }
}

const NOW = new Date("2026-08-28T12:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));
const BODY = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });

test("a correctly signed webhook verifies", () => {
  withSecret(() => {
    const result = verifyResendSignature({
      id: "msg_1",
      timestamp: TS,
      signature: sign("msg_1", TS, BODY),
      rawBody: BODY,
      now: NOW,
    });
    assert.equal(result.ok, true);
  });
});

test("a tampered body is refused", () => {
  withSecret(() => {
    const result = verifyResendSignature({
      id: "msg_1",
      timestamp: TS,
      signature: sign("msg_1", TS, BODY),
      rawBody: BODY.replace("delivered", "bounced"),
      now: NOW,
    });
    assert.equal(result.ok, false);
  });
});

test("a signature lifted onto another message id is refused", () => {
  withSecret(() => {
    const result = verifyResendSignature({
      id: "msg_2",
      timestamp: TS,
      signature: sign("msg_1", TS, BODY),
      rawBody: BODY,
      now: NOW,
    });
    assert.equal(result.ok, false);
  });
});

test("an old signature is refused even though it verifies", () => {
  withSecret(() => {
    const result = verifyResendSignature({
      id: "msg_1",
      timestamp: TS,
      signature: sign("msg_1", TS, BODY),
      rawBody: BODY,
      now: new Date(NOW.getTime() + 10 * 60 * 1000),
    });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 401);
  });
});

test("rotation is supported: any one of several signatures may match", () => {
  withSecret(() => {
    const result = verifyResendSignature({
      id: "msg_1",
      timestamp: TS,
      signature: `v1,not-the-one ${sign("msg_1", TS, BODY)}`,
      rawBody: BODY,
      now: NOW,
    });
    assert.equal(result.ok, true);
  });
});

test("a missing secret fails closed, and says so distinctly", () => {
  const previous = process.env.RESEND_WEBHOOK_SECRET;
  delete process.env.RESEND_WEBHOOK_SECRET;
  try {
    const result = verifyResendSignature({
      id: "msg_1",
      timestamp: TS,
      signature: sign("msg_1", TS, BODY),
      rawBody: BODY,
      now: NOW,
    });
    assert.equal(result.ok, false);
    // 503, not 401: this is our misconfiguration, not their bad request.
    assert.equal(result.ok === false && result.status, 503);
  } finally {
    if (previous !== undefined) process.env.RESEND_WEBHOOK_SECRET = previous;
  }
});

// ── Delivery lifecycle ────────────────────────────────────────────────────

test("the lifecycle only moves forward", () => {
  assert.equal(shouldAdvance("SENT", "DELIVERED"), true);
  assert.equal(shouldAdvance("OPENED", "CLICKED"), true);
  // Out-of-order webhooks are normal; an open arriving after a click must not
  // roll the record back.
  assert.equal(shouldAdvance("CLICKED", "OPENED"), false);
  assert.equal(shouldAdvance("DELIVERED", "SENT"), false);
  // Redelivery of the same event is a no-op rather than a rewrite.
  assert.equal(shouldAdvance("OPENED", "OPENED"), false);
});

test("Resend does not report replies, so no event maps to one", () => {
  const statuses = Object.values(RESEND_EVENT_STATUS);
  assert.ok(!statuses.includes("REPLIED"));
  assert.ok(!("email.replied" in RESEND_EVENT_STATUS));
});

// ── Scheduling ────────────────────────────────────────────────────────────

test("the digest hour is the recipient's hour, not the server's", () => {
  const noonUtc = new Date("2026-08-28T12:00:00Z");
  assert.equal(localHour(noonUtc, "UTC"), 12);
  assert.equal(localHour(noonUtc, "Asia/Shanghai"), 20);
  assert.equal(localHour(noonUtc, "America/Los_Angeles"), 5);
});

test("an unusable time zone falls back instead of throwing", () => {
  const noonUtc = new Date("2026-08-28T12:00:00Z");
  assert.equal(localHour(noonUtc, "Not/AZone"), 12);
  assert.equal(localDayKey(noonUtc, "Not/AZone"), "2026-08-28");
});

test("weekends are judged in the recipient's zone", () => {
  // Saturday 13:00 UTC is still Saturday in Los Angeles...
  const saturday = new Date("2026-08-29T13:00:00Z");
  assert.equal(isWeekend(saturday, "America/Los_Angeles"), true);
  // ...but Sunday afternoon UTC is already Monday in Auckland.
  const sunday = new Date("2026-08-30T13:00:00Z");
  assert.equal(isWeekend(sunday, "UTC"), true);
  assert.equal(isWeekend(sunday, "Pacific/Auckland"), false);
});

test("the digest dedupe key is one per local day", () => {
  const morning = new Date("2026-08-28T00:30:00Z");
  const evening = new Date("2026-08-28T23:30:00Z");
  assert.equal(localDayKey(morning, "UTC"), localDayKey(evening, "UTC"));

  // Shanghai is eight hours ahead, so late-evening UTC is already tomorrow
  // there — which is exactly why the key has to be computed per recipient.
  assert.equal(localDayKey(evening, "UTC"), "2026-08-28");
  assert.equal(localDayKey(evening, "Asia/Shanghai"), "2026-08-29");
  // And a Los Angeles recipient is still on the previous day.
  assert.equal(localDayKey(morning, "America/Los_Angeles"), "2026-08-27");
});

// ── Rendering ─────────────────────────────────────────────────────────────

const MESSAGE: NotificationMessage = {
  kind: "daily_digest",
  dedupeKey: "daily_digest:2026-08-28",
  subject: "Today's priorities",
  headline: "$21,840 at risk across 2 deals.",
  deals: [
    {
      opportunityId: "opp1",
      company: "Cloudmint & Co <script>",
      stage: "Proposal",
      dealValue: 42_000,
      winProbability: 52,
      expectedValue: 21_840,
      currency: "USD",
      reason: "Proposal opened twice, then silence",
      nextAction: "Send a security follow-up",
      urgency: "Today",
      atRisk: 21_840,
      url: "https://example.com/opportunities/opp1",
    },
  ],
  summary: { revenueAtRisk: "$21,840", openPipeline: "$108,500", openCount: 7 },
  primaryUrl: "https://example.com/dashboard",
  primaryLabel: "Open today's priorities",
};

test("the email renders both parts and escapes company names", () => {
  const { html, text } = renderNotificationEmail(MESSAGE, {
    unsubscribeUrl: "https://example.com/unsub",
    workspaceName: "Acme Labs",
    simulated: false,
  });
  assert.ok(html.includes("Cloudmint &amp; Co &lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(text.includes("Cloudmint & Co <script>"));
});

test("every email carries a working unsubscribe link", () => {
  const { html, text } = renderNotificationEmail(MESSAGE, {
    unsubscribeUrl: "https://example.com/unsub",
    workspaceName: "Acme Labs",
    simulated: false,
  });
  assert.ok(html.includes("https://example.com/unsub"));
  assert.ok(text.includes("https://example.com/unsub"));
});

test("a simulated send says so in the message itself", () => {
  const { html, text } = renderNotificationEmail(MESSAGE, {
    unsubscribeUrl: "https://example.com/unsub",
    workspaceName: "Acme Labs",
    simulated: true,
  });
  assert.ok(/sample data/i.test(html));
  assert.ok(/sample data/i.test(text));
});
