import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TIMING,
  RULE_ORDER,
  buyerHasReplied,
  compareFollowUps,
  evaluateFollowUp,
  rankFollowUps,
  type DealFacts,
  type EvidenceRef,
  type FollowUpItem,
} from "@/lib/followup/rules";

const NOW = new Date("2026-11-01T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

let seq = 0;
function ev(kind: EvidenceRef["kind"], daysAgo: number): EvidenceRef {
  seq += 1;
  return {
    eventId: `evt_${seq}`,
    source: "hubspot",
    sourceEventId: `hs_${seq}`,
    kind,
    occurredAt: day(daysAgo),
    summary: `${kind} ${seq}`,
  };
}

function facts(over: Partial<DealFacts> = {}): DealFacts {
  return {
    opportunityId: "opp_1",
    accountName: "Northwind",
    amount: 12_000,
    currency: "USD",
    stage: "Proposal",
    stageKey: "PROPOSAL",
    lastOutbound: null,
    lastInbound: null,
    lastActivity: null,
    quoteSent: null,
    nextStepDueAt: null,
    nextStepEvidence: null,
    dataAgeDays: 1,
    ...over,
  };
}

// ── The three triggers ────────────────────────────────────────────────────

test("a quote nobody answered is surfaced once the waiting period passes", () => {
  const quote = ev("email_outbound", 5);
  const reason = evaluateFollowUp(
    facts({ quoteSent: quote, lastOutbound: quote, lastActivity: quote }),
    NOW
  );
  assert.equal(reason?.rule, "quote_no_reply");
  assert.match(reason!.because, /You sent “email_outbound \d+” 5 days ago/);
  // The claim has to point at the record it rests on.
  assert.deepEqual(
    reason!.evidence.map((e) => e.eventId),
    [quote.eventId]
  );
});

test("a quote still inside the waiting period is not chased yet", () => {
  const quote = ev("email_outbound", DEFAULT_TIMING.quietAfterQuoteDays - 1);
  assert.equal(
    evaluateFollowUp(facts({ quoteSent: quote, lastActivity: quote }), NOW),
    null
  );
});

test("an overdue follow-up date is reported with the real number of days", () => {
  const note = ev("crm_field", 9);
  const reason = evaluateFollowUp(
    facts({ nextStepDueAt: day(4), nextStepEvidence: note, lastActivity: note }),
    NOW
  );
  assert.equal(reason?.rule, "followup_due");
  assert.equal(reason?.daysOverdue, 4);
  assert.match(reason!.because, /passed 4 days ago/);
});

test("a deal with no activity at all for a long time is surfaced", () => {
  const old = ev("note", 30);
  const reason = evaluateFollowUp(facts({ lastActivity: old, lastOutbound: old }), NOW);
  assert.equal(reason?.rule, "gone_quiet");
  assert.match(reason!.because, /30 days/);
});

test("a recently active deal is left alone", () => {
  const recent = ev("email_outbound", 2);
  assert.equal(
    evaluateFollowUp(facts({ lastActivity: recent, lastOutbound: recent }), NOW),
    null
  );
});

// ── Replies stop the nagging ──────────────────────────────────────────────

test("a buyer reply silences the chase on that thread", () => {
  const quote = ev("email_outbound", 10);
  const reply = ev("email_inbound", 1);
  const f = facts({
    quoteSent: quote,
    lastOutbound: quote,
    lastInbound: reply,
    lastActivity: reply,
  });
  assert.equal(buyerHasReplied(f), true);
  // Without this the product would keep telling a seller to chase a quote the
  // customer already answered — the fastest way to lose their trust in it.
  assert.equal(evaluateFollowUp(f, NOW), null);
});

test("the quote reason names the real subject rather than asserting a quote", () => {
  const quote = { ...ev("email_outbound", 6), summary: "Northwind — pricing for 40 seats" };
  const reason = evaluateFollowUp(facts({ quoteSent: quote, lastActivity: quote }), NOW);
  assert.match(reason!.because, /Northwind — pricing for 40 seats/);
});

test("a reply older than our last message does not count as answered", () => {
  const reply = ev("email_inbound", 20);
  const quote = ev("email_outbound", 6);
  const f = facts({
    lastInbound: reply,
    quoteSent: quote,
    lastOutbound: quote,
    lastActivity: quote,
  });
  assert.equal(buyerHasReplied(f), false);
  assert.equal(evaluateFollowUp(f, NOW)?.rule, "quote_no_reply");
});

test("a missed commitment still stands even after the buyer writes in", () => {
  // The seller said they would do something on a date and did not. A reply
  // does not discharge that, so this rule is checked before the reply test.
  const reply = ev("email_inbound", 1);
  const reason = evaluateFollowUp(
    facts({ nextStepDueAt: day(3), lastInbound: reply, lastActivity: reply }),
    NOW
  );
  assert.equal(reason?.rule, "followup_due");
});

// ── No invented numbers ───────────────────────────────────────────────────

test("a deal with no amount is still followed up", () => {
  const quote = ev("email_outbound", 8);
  const reason = evaluateFollowUp(
    facts({ amount: null, quoteSent: quote, lastActivity: quote }),
    NOW
  );
  assert.equal(reason?.rule, "quote_no_reply");
});

test("a reason carries no score of any kind", () => {
  const quote = ev("email_outbound", 8);
  const reason = evaluateFollowUp(facts({ quoteSent: quote, lastActivity: quote }), NOW)!;
  for (const key of Object.keys(reason)) {
    assert.ok(
      !/score|probability|forecast|expected|risk/i.test(key),
      `"${key}" looks like an invented number; this layer reports facts only`
    );
  }
});

// ── Ordering ──────────────────────────────────────────────────────────────

function item(over: Partial<FollowUpItem>): FollowUpItem {
  return {
    opportunityId: "opp",
    accountName: "Acme",
    amount: null,
    currency: "USD",
    stage: "Proposal",
    stageKey: "PROPOSAL",
    lastActivityAt: null,
    staleness: null,
    rule: "gone_quiet",
    action: "a",
    because: "b",
    evidence: [],
    daysOverdue: 0,
    ...over,
  };
}

test("a broken commitment outranks a quote, which outranks a quiet deal", () => {
  const ranked = rankFollowUps([
    item({ opportunityId: "c", rule: "gone_quiet" }),
    item({ opportunityId: "a", rule: "quote_no_reply" }),
    item({ opportunityId: "b", rule: "followup_due" }),
  ]);
  assert.deepEqual(
    ranked.map((i) => i.rule),
    ["followup_due", "quote_no_reply", "gone_quiet"]
  );
});

test("a long tail of dormant deals cannot bury today's missed promise", () => {
  const ranked = rankFollowUps([
    item({ opportunityId: "old", rule: "gone_quiet", daysOverdue: 300, amount: 999_999 }),
    item({ opportunityId: "new", rule: "followup_due", daysOverdue: 0, amount: null }),
  ]);
  assert.equal(ranked[0].opportunityId, "new");
});

test("within one rule the most overdue comes first", () => {
  const ranked = rankFollowUps([
    item({ opportunityId: "a", rule: "quote_no_reply", daysOverdue: 2 }),
    item({ opportunityId: "b", rule: "quote_no_reply", daysOverdue: 9 }),
  ]);
  assert.deepEqual(ranked.map((i) => i.opportunityId), ["b", "a"]);
});

test("amount only breaks a tie, and a missing amount sorts last", () => {
  const ranked = rankFollowUps([
    item({ opportunityId: "none", rule: "quote_no_reply", daysOverdue: 3, amount: null }),
    item({ opportunityId: "small", rule: "quote_no_reply", daysOverdue: 3, amount: 1_000 }),
    item({ opportunityId: "big", rule: "quote_no_reply", daysOverdue: 3, amount: 80_000 }),
  ]);
  assert.deepEqual(ranked.map((i) => i.opportunityId), ["big", "small", "none"]);
});

test("the order is total and stable, so the list never reshuffles itself", () => {
  const base = [
    item({ opportunityId: "x", rule: "gone_quiet", daysOverdue: 1, amount: 500 }),
    item({ opportunityId: "y", rule: "gone_quiet", daysOverdue: 1, amount: 500 }),
    item({ opportunityId: "z", rule: "gone_quiet", daysOverdue: 1, amount: 500 }),
  ];
  const once = rankFollowUps(base).map((i) => i.opportunityId);
  const twice = rankFollowUps([...base].reverse()).map((i) => i.opportunityId);
  assert.deepEqual(once, twice);
});

// ── Staying handled ───────────────────────────────────────────────────────

import { isSuppressed } from "@/lib/followup/rules";

test("a deal marked done does not come straight back", () => {
  // The facts that triggered it have not changed, so without this the item
  // reappears on the next load and the button looks broken.
  const handledAt = day(1);
  assert.equal(
    isSuppressed({ state: "DONE", snoozedUntil: null, handledAgainst: handledAt }, handledAt, NOW),
    true
  );
});

test("a deal marked done returns when something new actually happens", () => {
  const handledAt = day(3);
  const reply = day(1);
  assert.equal(
    isSuppressed({ state: "DONE", snoozedUntil: null, handledAgainst: handledAt }, reply, NOW),
    false
  );
});

test("a snooze is released by time and nothing else", () => {
  const future = new Date(NOW.getTime() + 86_400_000);
  assert.equal(
    isSuppressed({ state: "SNOOZED", snoozedUntil: future, handledAgainst: null }, day(0), NOW),
    true
  );
  // New activity does not cut a snooze short: the seller asked for quiet.
  assert.equal(
    isSuppressed({ state: "SNOOZED", snoozedUntil: future, handledAgainst: null }, NOW, NOW),
    true
  );
  const past = new Date(NOW.getTime() - 1000);
  assert.equal(
    isSuppressed({ state: "SNOOZED", snoozedUntil: past, handledAgainst: null }, null, NOW),
    false
  );
});

test("an ignored deal stays ignored", () => {
  assert.equal(
    isSuppressed({ state: "IGNORED", snoozedUntil: null, handledAgainst: day(9) }, NOW, NOW),
    true
  );
});

test("a deal nobody has touched is never suppressed", () => {
  assert.equal(isSuppressed(null, day(5), NOW), false);
});

// ── Missing next steps, value and freshness (requirement 4) ───────────────

test("a live deal with no agreed next step is raised while it is still warm", () => {
  const reason = evaluateFollowUp(
    facts({
      stageKey: "MEETING",
      stage: "Meeting",
      nextStepDueAt: null,
      quoteSent: null,
      lastActivity: ev("meeting", 7),
      lastOutbound: ev("email_outbound", 7),
      dataAgeDays: 7,
    }),
    NOW
  );
  assert.equal(reason?.rule, "no_next_step");
  assert.match(reason!.because, /no next step recorded/i);
  assert.match(reason!.because, /7 days/);
  assert.ok(reason!.evidence.length > 0, "must cite the record it read");
});

test("an early-stage deal with no next step is not a gap", () => {
  // Nobody has met yet, so there is nothing to have agreed.
  const reason = evaluateFollowUp(
    facts({
      stageKey: "QUALIFYING",
      nextStepDueAt: null,
      quoteSent: null,
      lastActivity: ev("email_outbound", 7),
      dataAgeDays: 7,
    }),
    NOW
  );
  assert.notEqual(reason?.rule, "no_next_step");
});

test("a deal talked to yesterday is not chased for a missing next step", () => {
  const reason = evaluateFollowUp(
    facts({
      stageKey: "PROPOSAL",
      nextStepDueAt: null,
      quoteSent: null,
      lastActivity: ev("email_outbound", 1),
      dataAgeDays: 1,
    }),
    NOW
  );
  assert.equal(reason, null);
});

test("stale evidence is disclosed on the reason, not used to hide it", () => {
  const reason = evaluateFollowUp(
    facts({
      stageKey: "PROPOSAL",
      quoteSent: null,
      nextStepDueAt: null,
      lastActivity: ev("email_outbound", 70),
      dataAgeDays: 70,
    }),
    NOW
  );
  assert.equal(reason?.rule, "gone_quiet", "a long-dormant deal still surfaces");
  assert.ok(reason!.staleness, "staleness must be stated");
  assert.match(reason!.staleness!, /70 days old/);
  assert.match(reason!.staleness!, /check the CRM/i);
});

test("fresh evidence carries no staleness caveat", () => {
  const reason = evaluateFollowUp(
    facts({
      nextStepDueAt: day(2),
      lastActivity: ev("email_outbound", 2),
      dataAgeDays: 2,
    }),
    NOW
  );
  assert.equal(reason?.rule, "followup_due");
  assert.equal(reason!.staleness, null);
});

test("a deal with no synced activity at all says so rather than asserting silence", () => {
  const reason = evaluateFollowUp(
    facts({ nextStepDueAt: day(3), lastActivity: null, dataAgeDays: null }),
    NOW
  );
  assert.equal(reason?.rule, "followup_due");
  assert.match(reason!.staleness!, /nothing to check this against/i);
});

test("every rule in RULE_ORDER is rankable, so none can silently drift", () => {
  for (const rule of RULE_ORDER) {
    const a = item({ rule, daysOverdue: 1 });
    const b = item({ rule, daysOverdue: 5 });
    assert.ok(compareFollowUps(b, a) < 0, `${rule} must order by days overdue`);
  }
});

test("opportunity value breaks a tie but never jumps the rule order", () => {
  const bigQuiet = item({ rule: "gone_quiet", daysOverdue: 2, amount: 500_000 });
  const smallDue = item({ rule: "followup_due", daysOverdue: 0, amount: 500 });
  assert.equal(
    rankFollowUps([bigQuiet, smallDue])[0].rule,
    "followup_due",
    "a missed commitment outranks a large dormant deal"
  );

  const small = item({ rule: "gone_quiet", daysOverdue: 2, amount: 1_000, opportunityId: "a" });
  const big = item({ rule: "gone_quiet", daysOverdue: 2, amount: 90_000, opportunityId: "b" });
  assert.equal(rankFollowUps([small, big])[0].opportunityId, "b");
});
