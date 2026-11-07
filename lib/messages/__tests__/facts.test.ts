import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeReplyState,
  deriveOpportunityFacts,
  type FactInput,
  type MessageFactRow,
} from "@/lib/revenue/facts";

/**
 * A connected mailbox is the fifth source feeding `facts.ts`, and the first
 * one that can prove a buyer wrote something rather than that a tracker
 * recorded they did.
 *
 * These assert the join: that a synced reply is a reply everywhere, that it
 * merges with the CRM's record of the same message instead of counting
 * twice, and that a workspace with no mailbox derives exactly what it did
 * before — which is the property that lets this ship before any connector
 * exists.
 */

const NOW = new Date("2026-11-07T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function input(over: Partial<FactInput> = {}): FactInput {
  return {
    opportunityId: "opp_1",
    contactIds: ["c_maya"],
    emails: [],
    events: [],
    responses: [],
    signals: [],
    ...over,
  };
}

function message(over: Partial<MessageFactRow> = {}): MessageFactRow {
  return {
    id: "m_1",
    direction: "inbound",
    subject: "Re: Proposal",
    occurredAt: day(1),
    contactId: "c_maya",
    externalId: "gmail_abc",
    source: "gmail",
    ...over,
  };
}

test("a workspace with no mailbox derives what it always did", () => {
  // The property that lets the table exist before a connector does.
  const withoutField = deriveOpportunityFacts(input(), NOW);
  const withEmptyList = deriveOpportunityFacts(input({ messages: [] }), NOW);
  assert.equal(withoutField.replyState, withEmptyList.replyState);
  assert.equal(withoutField.lastReplyAt, withEmptyList.lastReplyAt);
  assert.equal(withoutField.coverage.sources.message, false);
});

test("a synced reply makes the deal one that replied", () => {
  const facts = deriveOpportunityFacts(
    input({
      messages: [
        message({ id: "m_out", direction: "outbound", occurredAt: day(5) }),
        message({ id: "m_in", direction: "inbound", occurredAt: day(1) }),
      ],
    }),
    NOW
  );
  assert.equal(facts.replyState, "they_replied_last");
  assert.equal(facts.lastReplyAt?.getTime(), day(1).getTime());
  assert.equal(facts.coverage.sources.message, true);
});

test("outbound mail alone leaves the deal awaiting a reply", () => {
  const facts = deriveOpportunityFacts(
    input({ messages: [message({ direction: "outbound", occurredAt: day(6) })] }),
    NOW
  );
  assert.equal(facts.replyState, "never_replied");
  assert.equal(facts.lastOutboundAt?.getTime(), day(6).getTime());
});

test("the same message from two sources is one reply, not two", () => {
  // A Gmail sync and a HubSpot engagement sync both see the message the
  // buyer sent. Counting it twice would make a single reply look like a
  // conversation, which is the bug class this module exists to prevent.
  const at = day(2);
  const facts = deriveOpportunityFacts(
    input({
      messages: [message({ id: "m_in", occurredAt: at })],
      events: [
        {
          id: "e_in",
          contactId: "c_maya",
          eventType: "email.replied",
          occurredAt: new Date(at.getTime() + 90_000),
          actorType: "buyer",
          sourceEventId: "hs_1",
          source: "hubspot",
        },
      ],
    }),
    NOW
  );
  assert.equal(facts.replyCount, 1, "one reply, counted once");
});

test("a redelivered message merges on the provider's own id", () => {
  // Two rows, same Gmail id, timestamps a minute apart — what a re-sync of an
  // overlapping window produces.
  const facts = deriveOpportunityFacts(
    input({
      messages: [
        message({ id: "row_a", externalId: "gmail_same", occurredAt: day(2) }),
        message({
          id: "row_b",
          externalId: "gmail_same",
          occurredAt: new Date(day(2).getTime() + 60_000),
        }),
      ],
    }),
    NOW
  );
  assert.equal(facts.replyCount, 1);
});

test("a message from an unknown contact still counts for the account", () => {
  // Someone at the client who is not in the CRM replies. It is weaker
  // evidence about who to chase, and it is still proof the company answered.
  const facts = deriveOpportunityFacts(
    input({ messages: [message({ contactId: null })] }),
    NOW
  );
  assert.equal(facts.replyState, "they_replied_last");
});

test("no screen can call a deal silent once a mailbox shows a reply", () => {
  // The regression this whole module guards: four places once derived
  // "have they replied?" independently and disagreed.
  const facts = deriveOpportunityFacts(
    input({ messages: [message({ occurredAt: day(3) })] }),
    NOW
  );
  assert.equal(facts.replyState, "they_replied_last");
  // The one sentence every screen prints about silence reads from the same
  // facts, so it cannot say "no reply" while the mailbox holds one.
  assert.match(describeReplyState(facts), /replied/i);
});
