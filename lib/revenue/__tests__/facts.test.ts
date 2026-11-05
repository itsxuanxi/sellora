import test from "node:test";
import assert from "node:assert/strict";
import {
  awaitingReplyToLatestOutreach,
  deriveOpportunityFacts,
  describeReplyState,
  hasNeverReplied,
  noReplyWithinDays,
  type FactInput,
} from "@/lib/revenue/facts";

/**
 * The shared opportunity facts.
 *
 * The bug these guard: three different modules each derived "have they
 * replied?" from a different subset of the tables. Cloudmint's timeline
 * rendered a Response row, the leak rules read Email.repliedAt, and the two
 * sat on the same page contradicting each other. These tests pin the three
 * reply states apart and check that every source counts.
 */

const NOW = new Date("2026-03-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function input(over: Partial<FactInput> = {}): FactInput {
  return {
    opportunityId: "opp_1",
    contactIds: ["c1"],
    emails: [],
    events: [],
    responses: [],
    signals: [],
    ...over,
  };
}

const email = (over: Partial<FactInput["emails"][number]> = {}) => ({
  id: "e1",
  prospectId: "c1",
  subject: "Proposal for Q2",
  sentAt: daysAgo(10),
  openedAt: null,
  repliedAt: null,
  ...over,
});

// ── The three reply states ────────────────────────────────────────────────

test("nothing sent is not 'never replied'", () => {
  const f = deriveOpportunityFacts(input(), NOW);
  assert.equal(f.replyState, "no_outreach_yet");
  assert.equal(hasNeverReplied(f), false, "silence proves nothing if we never wrote");
  assert.equal(noReplyWithinDays(f, 7), false);
  assert.match(describeReplyState(f), /Nothing has been sent/);
});

test("outreach with no inbound record of any kind is 'never replied'", () => {
  const f = deriveOpportunityFacts(
    input({ emails: [email(), { ...email(), id: "e2", sentAt: daysAgo(4) }] }),
    NOW
  );
  assert.equal(f.replyState, "never_replied");
  assert.ok(hasNeverReplied(f));
  assert.equal(f.replyCount, 0);
  assert.equal(f.outboundSinceLastReply, 2);
  assert.equal(noReplyWithinDays(f, 30), true);
});

test("the Cloudmint case: a reply recorded only as a Response row still counts", () => {
  // This is the exact shape of the reported bug. The reply existed as a
  // Response row — which the deal timeline renders — and nowhere else. Every
  // previous derivation read Email.repliedAt and/or the event log, so all of
  // them reported an account that had never replied.
  const f = deriveOpportunityFacts(
    input({
      emails: [email({ sentAt: daysAgo(20) }), { ...email(), id: "e2", sentAt: daysAgo(4) }],
      responses: [
        {
          id: "r1",
          responseType: "replied",
          contactId: "c1",
          observedAt: daysAgo(18),
          detail: "Asked about onboarding timeline",
        },
      ],
    }),
    NOW
  );

  assert.equal(hasNeverReplied(f), false, "a reply in the timeline is a reply everywhere");
  assert.equal(f.replyState, "awaiting_reply");
  assert.equal(f.lastReplyVia, "response");
  assert.equal(f.daysSinceReply, 18);
  assert.equal(f.outboundSinceLastReply, 1, "only the message after their reply is unanswered");
  assert.ok(!/never/i.test(describeReplyState(f)));
  assert.match(describeReplyState(f), /replied before/i);
});

test("a reply in the event log counts too", () => {
  const f = deriveOpportunityFacts(
    input({
      emails: [email({ sentAt: daysAgo(9) })],
      events: [
        {
          id: "ev1",
          source: "hubspot",
          sourceEventId: "h1",
          eventType: "email.replied",
          occurredAt: daysAgo(8),
          actorType: "buyer",
          contactId: "c1",
        },
      ],
    }),
    NOW
  );
  assert.equal(f.replyState, "they_replied_last");
  assert.equal(f.lastReplyVia, "event");
  assert.equal(f.outboundSinceLastReply, 0, "the ball is with us");
});

test("historical reply followed by recent silence is awaiting_reply, not never_replied", () => {
  const f = deriveOpportunityFacts(
    input({
      emails: [
        email({ id: "e1", sentAt: daysAgo(90), repliedAt: daysAgo(89) }),
        email({ id: "e2", sentAt: daysAgo(12) }),
        email({ id: "e3", sentAt: daysAgo(5) }),
      ],
    }),
    NOW
  );
  assert.equal(f.replyState, "awaiting_reply");
  assert.ok(awaitingReplyToLatestOutreach(f));
  assert.equal(f.daysSinceReply, 89);
  assert.equal(f.outboundSinceLastReply, 2);

  // The three questions give three different answers on the same deal —
  // which is the point of keeping them separate.
  assert.equal(hasNeverReplied(f), false);
  assert.equal(noReplyWithinDays(f, 30), true);
  assert.equal(noReplyWithinDays(f, 120), false);
});

test("they replied last means the ball is with us", () => {
  const f = deriveOpportunityFacts(
    input({ emails: [email({ sentAt: daysAgo(6), repliedAt: daysAgo(2) })] }),
    NOW
  );
  assert.equal(f.replyState, "they_replied_last");
  assert.equal(f.outboundSinceLastReply, 0);
  assert.match(describeReplyState(f), /waiting on you/);
});

// ── Multiple contacts ─────────────────────────────────────────────────────

test("a reply from one contact does not credit the others", () => {
  const f = deriveOpportunityFacts(
    input({
      contactIds: ["c1", "c2", "c3"],
      emails: [
        email({ id: "e1", prospectId: "c1", sentAt: daysAgo(9), repliedAt: daysAgo(8) }),
        email({ id: "e2", prospectId: "c2", sentAt: daysAgo(9) }),
      ],
    }),
    NOW
  );

  assert.equal(f.replyState, "they_replied_last");
  const by = new Map(f.contacts.map((c) => [c.contactId, c]));
  assert.equal(by.get("c1")!.replyCount, 1);
  assert.equal(by.get("c2")!.replyCount, 0);
  assert.equal(by.get("c2")!.lastOutboundAt?.getTime(), daysAgo(9).getTime());
  // A contact nobody has written to is visible as exactly that.
  assert.equal(by.get("c3")!.lastOutboundAt, null);
  assert.equal(by.get("c3")!.replyCount, 0);
  assert.equal(f.lastReplyContactId, "c1");
});

// ── Duplicates ────────────────────────────────────────────────────────────

test("the same reply arriving twice is counted once", () => {
  const at = daysAgo(3);
  const f = deriveOpportunityFacts(
    input({
      emails: [email({ sentAt: daysAgo(5), repliedAt: at })],
      events: [
        {
          id: "ev1",
          source: "gmail",
          sourceEventId: "g1",
          eventType: "email.replied",
          occurredAt: at,
          actorType: "buyer",
          contactId: "c1",
        },
      ],
      responses: [
        {
          id: "r1",
          responseType: "replied",
          contactId: "c1",
          observedAt: at,
          detail: "Proposal for Q2",
        },
      ],
    }),
    NOW
  );
  // One real reply, recorded by three systems.
  assert.equal(f.replyCount, 1, `counted ${f.replyCount} replies for one event`);
  assert.equal(f.emailsReplied, 1);
});

test("a redelivered event minutes later is still one event", () => {
  const f = deriveOpportunityFacts(
    input({
      emails: [email({ sentAt: daysAgo(5) })],
      events: [
        {
          id: "ev1",
          source: "hubspot",
          sourceEventId: "h1",
          eventType: "email.replied",
          occurredAt: new Date(daysAgo(3).getTime()),
          actorType: "buyer",
          contactId: "c1",
        },
        {
          id: "ev2",
          source: "hubspot",
          sourceEventId: "h1",
          eventType: "email.replied",
          occurredAt: new Date(daysAgo(3).getTime() + 90_000),
          actorType: "buyer",
          contactId: "c1",
        },
      ],
    }),
    NOW
  );
  assert.equal(f.replyCount, 1);
});

// ── Missing and stale data ────────────────────────────────────────────────

test("missing data is reported as missing, not as a finding", () => {
  const f = deriveOpportunityFacts(input({ contactIds: [] }), NOW);
  assert.equal(f.coverage.hasAnyRecord, false);
  assert.equal(f.coverage.hasContacts, false);
  assert.equal(f.coverage.newestRecordAt, null);
  assert.ok(f.coverage.caveats.some((c) => /No contacts/.test(c)));
  assert.ok(f.coverage.caveats.some((c) => /silence is not a signal/.test(c)));
});

test("a workspace with CRM deals but no inbox says so", () => {
  const f = deriveOpportunityFacts(
    input({
      signals: [
        { id: "s1", signalType: "pricing_page_viewed", occurredAt: daysAgo(2), title: "Pricing" },
      ],
    }),
    NOW
  );
  assert.equal(f.coverage.sources.email, false);
  assert.equal(f.coverage.sources.event, false);
  assert.ok(f.coverage.caveats.some((c) => /No email or CRM activity/.test(c)));
  assert.equal(f.replyState, "no_outreach_yet");
});

test("stale records are flagged so absence is not read as behaviour", () => {
  const f = deriveOpportunityFacts(
    input({ emails: [email({ sentAt: daysAgo(200) })] }),
    NOW
  );
  assert.equal(f.coverage.stale, true);
  assert.equal(f.coverage.recordAgeDays, 200);
  assert.ok(f.coverage.caveats.some((c) => /200 days old/.test(c)));
});

test("fresh records are not flagged stale", () => {
  const f = deriveOpportunityFacts(
    input({ emails: [email({ sentAt: daysAgo(2) })] }),
    NOW
  );
  assert.equal(f.coverage.stale, false);
  assert.deepEqual(f.coverage.caveats, []);
});

// ── Activity that is not a reply ──────────────────────────────────────────

test("opening a proposal is activity, never a reply", () => {
  const f = deriveOpportunityFacts(
    input({
      emails: [email({ sentAt: daysAgo(6), openedAt: daysAgo(5) })],
      responses: [
        { id: "r1", responseType: "proposal_viewed", contactId: "c1", observedAt: daysAgo(4), detail: null },
      ],
    }),
    NOW
  );
  assert.equal(f.replyState, "never_replied", "an open is not an answer");
  assert.equal(f.replyCount, 0);
  assert.equal(f.proposalViews, 1);
  assert.equal(f.emailsOpened, 1);
  assert.equal(f.lastBuyerActivityKind, "proposal_view");
  assert.equal(f.daysSinceBuyerActivity, 4);
});

test("a booked meeting counts as them coming back to us", () => {
  const f = deriveOpportunityFacts(
    input({
      emails: [email({ sentAt: daysAgo(6) })],
      responses: [
        { id: "r1", responseType: "meeting_booked", contactId: "c1", observedAt: daysAgo(4), detail: "Booked Thu" },
      ],
    }),
    NOW
  );
  assert.equal(f.replyState, "they_replied_last");
  assert.equal(f.meetingsHeld, 1);
});

test("a no_response outcome row is not mistaken for contact", () => {
  const f = deriveOpportunityFacts(
    input({
      emails: [email({ sentAt: daysAgo(6) })],
      responses: [
        { id: "r1", responseType: "no_response", contactId: "c1", observedAt: daysAgo(1), detail: null },
      ],
    }),
    NOW
  );
  assert.equal(f.replyState, "never_replied");
  assert.equal(f.replyCount, 0);
});

test("evidence carries a timestamp and source for every claim", () => {
  const f = deriveOpportunityFacts(
    input({
      emails: [email({ sentAt: daysAgo(6), repliedAt: daysAgo(3) })],
      signals: [
        { id: "s1", signalType: "pricing_page_viewed", occurredAt: daysAgo(1), title: "Pricing viewed" },
      ],
    }),
    NOW
  );
  assert.ok(f.evidence.length >= 3);
  for (const e of f.evidence) {
    assert.ok(e.at instanceof Date);
    assert.ok(["email", "event", "response", "signal"].includes(e.source));
    assert.equal(typeof e.summary, "string");
  }
  // Newest first, so a UI can take the top n and show the most recent.
  for (let i = 1; i < f.evidence.length; i++) {
    assert.ok(f.evidence[i - 1].at >= f.evidence[i].at);
  }
});
