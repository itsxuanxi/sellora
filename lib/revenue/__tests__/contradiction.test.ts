import test from "node:test";
import assert from "node:assert/strict";
import {
  findContradiction,
  insufficientEvidence,
  premiseContradictedNow,
} from "@/lib/revenue/contradiction";
import { deriveOpportunityFacts, type FactInput } from "@/lib/revenue/facts";

/**
 * Advice has to withdraw itself when the world moves.
 *
 * A recommendation is a claim about the present and the row outlives the
 * situation. Between one refresh and the next a buyer can reply to the exact
 * thread the card is telling the seller to chase; rendering it anyway proves
 * Selryn is reading different records from the person using it.
 */

const NOW = new Date("2026-03-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function facts(over: Partial<FactInput> = {}) {
  return deriveOpportunityFacts(
    {
      opportunityId: "opp_1",
      contactIds: ["c1"],
      emails: [],
      events: [],
      responses: [],
      signals: [],
      ...over,
    },
    NOW
  );
}

const email = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  prospectId: "c1",
  subject: "Proposal for Q2",
  sentAt: daysAgo(10),
  openedAt: null,
  repliedAt: null,
  ...over,
}) as FactInput["emails"][number];

const rec = (over: Record<string, unknown> = {}) => ({
  createdAt: daysAgo(5),
  leakType: "high_intent_no_response",
  actionType: "follow_up",
  expiresAt: null,
  ...over,
});

test("a reply after the advice was raised withdraws it", () => {
  const c = findContradiction(
    rec(),
    facts({ emails: [email({ sentAt: daysAgo(10), repliedAt: daysAgo(2) })] }),
    NOW
  );
  assert.equal(c?.kind, "buyer_replied");
  assert.match(c!.because, /replied 2 days ago/);
  assert.equal(c!.at.getTime(), daysAgo(2).getTime());
});

test("a reply recorded only in the outcome tracker withdraws it too", () => {
  // Same source blindness that caused the original bug: the reply must count
  // wherever it landed.
  const c = findContradiction(
    rec(),
    facts({
      emails: [email({ sentAt: daysAgo(10) })],
      responses: [
        { id: "r1", responseType: "replied", contactId: "c1", observedAt: daysAgo(1), detail: "Re: Proposal" },
      ],
    }),
    NOW
  );
  assert.equal(c?.kind, "buyer_replied");
});

test("a reply from before the advice was raised does not withdraw it", () => {
  // The recommendation was written knowing about that reply. Withdrawing on
  // it would make every piece of advice refute itself the moment it appeared.
  const c = findContradiction(
    rec({ createdAt: daysAgo(2) }),
    facts({ emails: [email({ sentAt: daysAgo(10), repliedAt: daysAgo(8) })] }),
    NOW
  );
  assert.equal(c, null);
});

test("a reply that we have since answered does not withdraw it", () => {
  // They replied, we wrote back, and they have gone quiet again. The silence
  // the advice is about is the current silence, not the earlier exchange.
  const c = findContradiction(
    rec({ createdAt: daysAgo(10) }),
    facts({
      emails: [
        email({ id: "e1", sentAt: daysAgo(20), repliedAt: daysAgo(18) }),
        email({ id: "e2", sentAt: daysAgo(4) }),
      ],
    }),
    NOW
  );
  assert.equal(c, null, "awaiting_reply is still a live silence");
});

test("somebody already following up withdraws follow-up advice", () => {
  const c = findContradiction(
    rec({ leakType: "needs_follow_up", createdAt: daysAgo(5) }),
    facts({ emails: [email({ id: "e2", sentAt: daysAgo(1), subject: "Checking in" })] }),
    NOW
  );
  assert.equal(c?.kind, "already_actioned");
  assert.match(c!.because, /Checking in/);
});

test("sending another email does not satisfy advice to book a meeting", () => {
  const c = findContradiction(
    rec({ leakType: "meeting_no_next_step", createdAt: daysAgo(5), actionType: "book_meeting" }),
    facts({ emails: [email({ id: "e2", sentAt: daysAgo(1) })] }),
    NOW
  );
  assert.equal(c, null, "the missing next step still does not exist");
});

test("a reply does not withdraw advice whose premise is not silence", () => {
  const c = findContradiction(
    rec({ leakType: "meeting_no_next_step" }),
    facts({ emails: [email({ sentAt: daysAgo(10), repliedAt: daysAgo(1) })] }),
    NOW
  );
  assert.equal(c, null);
});

test("expired advice withdraws itself", () => {
  const c = findContradiction(
    rec({ leakType: null, expiresAt: daysAgo(1) }),
    facts({ emails: [email()] }),
    NOW
  );
  assert.equal(c?.kind, "expired");
});

// ── Insufficient evidence ─────────────────────────────────────────────────

test("no records at all is reported as insufficient, not as silence", () => {
  const note = insufficientEvidence(facts());
  assert.ok(note);
  assert.match(note!, /No activity has synced/);
});

test("records but nothing sent is insufficient to explain silence", () => {
  const note = insufficientEvidence(
    facts({
      signals: [{ id: "s1", signalType: "pricing_page_viewed", occurredAt: daysAgo(1), title: "Pricing" }],
    })
  );
  assert.ok(note);
  assert.match(note!, /Nothing has been sent/);
});

test("stale records are reported as possibly out of date", () => {
  const note = insufficientEvidence(facts({ emails: [email({ sentAt: daysAgo(120) })] }));
  assert.ok(note);
  assert.match(note!, /120 days old/);
});

test("fresh, complete records produce no caveat", () => {
  const note = insufficientEvidence(
    facts({ emails: [email({ sentAt: daysAgo(3), repliedAt: daysAgo(1) })] })
  );
  assert.equal(note, null);
});

test("ordinary follow-up advice withdraws on a reply even with no leak type", () => {
  // The most common recommendation in the product — "check in on the
  // proposal" — carries `leakType: null`, and the silence test used to
  // require a leak. So the one piece of advice most likely to be followed by
  // a reply was the only one that never withdrew itself.
  const c = findContradiction(
    rec({ leakType: null, actionType: "follow_up" }),
    facts({ emails: [email({ sentAt: daysAgo(10), repliedAt: daysAgo(1) })] }),
    NOW
  );
  assert.equal(c?.kind, "buyer_replied");
});

test("advice to send the proposal is not withdrawn by a reply", () => {
  // Not premised on silence: they replied, and the proposal still is not sent.
  const c = findContradiction(
    rec({ leakType: null, actionType: "send_proposal" }),
    facts({ emails: [email({ sentAt: daysAgo(10), repliedAt: daysAgo(1) })] }),
    NOW
  );
  assert.equal(c, null);
});

test("a fresh candidate premised on silence is not raised while they wait on us", () => {
  const facts_ = facts({ emails: [email({ sentAt: daysAgo(5), repliedAt: daysAgo(1) })] });
  assert.ok(premiseContradictedNow(null, facts_, "follow_up"));
  assert.equal(premiseContradictedNow(null, facts_, "send_proposal"), null);
  assert.ok(premiseContradictedNow("high_intent_no_response", facts_));
});
