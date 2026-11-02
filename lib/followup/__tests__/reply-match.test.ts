import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyInbound,
  firstReply,
  type InboundCandidate,
} from "@/lib/followup/reply-match";

const OPP = "opp_1";
const SENT = new Date("2026-11-01T09:00:00Z");
const after = (mins: number) => new Date(SENT.getTime() + mins * 60_000);

function inbound(over: Partial<InboundCandidate> = {}): InboundCandidate {
  return {
    actorType: "buyer",
    eventType: "email.replied",
    occurredAt: after(60),
    subject: "Re: Following up",
    opportunityId: OPP,
    ...over,
  };
}

const opts = { sentAt: SENT, opportunityId: OPP };

test("a genuine customer reply counts", () => {
  assert.deepEqual(classifyInbound(inbound(), opts), { isReply: true });
});

// ── Our own mail is not a reply ───────────────────────────────────────────

test("our own outbound message is not a reply", () => {
  const verdict = classifyInbound(
    inbound({ actorType: "seller", eventType: "email.sent" }),
    opts
  );
  assert.equal(verdict.isReply === false && verdict.reason, "not_inbound");
});

test("a system record is not a reply", () => {
  const verdict = classifyInbound(inbound({ actorType: "system" }), opts);
  assert.equal(verdict.isReply === false && verdict.reason, "not_inbound");
});

test("a meeting or note is not a reply, however it is linked", () => {
  for (const eventType of ["meeting.held", "note.logged", "call.received"]) {
    const verdict = classifyInbound(inbound({ eventType }), opts);
    assert.equal(verdict.isReply === false && verdict.reason, "not_inbound");
  }
});

// ── Bounces mean the opposite of a reply ──────────────────────────────────

test("a bounce is not a reply", () => {
  for (const subject of [
    "Undeliverable: Following up",
    "Delivery Status Notification (Failure)",
    "Mail delivery failed: returning message to sender",
    "Returned mail: see transcript for details",
  ]) {
    const verdict = classifyInbound(inbound({ subject }), opts);
    assert.equal(
      verdict.isReply === false && verdict.reason,
      "bounce",
      `"${subject}" should be read as a bounce`
    );
  }
});

// ── Auto-replies are machines ─────────────────────────────────────────────

test("an out-of-office is not a reply", () => {
  for (const subject of [
    "Automatic reply: Following up",
    "Out of Office",
    "Re: Re: Auto-Reply: Following up",
    "Away from the office until Monday",
  ]) {
    const verdict = classifyInbound(inbound({ subject }), opts);
    assert.equal(
      verdict.isReply === false && verdict.reason,
      "auto_reply",
      `"${subject}" should be read as automated`
    );
  }
});

test("automated mail is caught by its headers even with an innocent subject", () => {
  const headerSets = [
    { "Auto-Submitted": "auto-replied" },
    { "X-Autoreply": "yes" },
    { "X-Auto-Response-Suppress": "All" },
    { Precedence: "bulk" },
    { "List-Id": "<announce.example.com>" },
  ];
  for (const headers of headerSets) {
    const verdict = classifyInbound(inbound({ headers }), opts);
    assert.equal(
      verdict.isReply === false && verdict.reason,
      "auto_reply",
      `${JSON.stringify(headers)} should be read as automated`
    );
  }
});

test("auto-submitted: no is a human who happens to set the header", () => {
  assert.deepEqual(
    classifyInbound(inbound({ headers: { "Auto-Submitted": "no" } }), opts),
    { isReply: true }
  );
});

// ── It has to be the right thread and the right deal ──────────────────────

test("a reply on another deal does not silence this one", () => {
  const verdict = classifyInbound(inbound({ opportunityId: "opp_other" }), opts);
  assert.equal(verdict.isReply === false && verdict.reason, "unlinked");
});

test("an unlinked record does not silence anything", () => {
  const verdict = classifyInbound(inbound({ opportunityId: null }), opts);
  assert.equal(verdict.isReply === false && verdict.reason, "unlinked");
});

test("mail that predates the follow-up answers something else", () => {
  const verdict = classifyInbound(
    inbound({ occurredAt: new Date(SENT.getTime() - 60_000) }),
    opts
  );
  assert.equal(verdict.isReply === false && verdict.reason, "before_send");
});

// ── Picking the reply that stops the reminders ────────────────────────────

test("the first genuine reply wins, skipping the noise before it", () => {
  const auto = inbound({ subject: "Automatic reply: Following up", occurredAt: after(1) });
  const bounce = inbound({ subject: "Undeliverable: Following up", occurredAt: after(2) });
  const real = inbound({ subject: "Re: Following up", occurredAt: after(90) });
  const later = inbound({ subject: "Re: Following up again", occurredAt: after(400) });

  const found = firstReply([later, bounce, real, auto], opts);
  assert.equal(found?.occurredAt.getTime(), real.occurredAt.getTime());
});

test("a thread with only automated mail has no reply", () => {
  const found = firstReply(
    [
      inbound({ subject: "Out of Office" }),
      inbound({ subject: "Undeliverable: Following up" }),
      inbound({ actorType: "seller" }),
    ],
    opts
  );
  // The expensive mistake: going quiet about a deal nobody actually answered.
  assert.equal(found, null);
});
