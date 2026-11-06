import { test } from "node:test";
import assert from "node:assert/strict";
import { bestByKind, isStale, type DealFactView } from "@/lib/deal-facts/kinds";
import { compareBlocked, identifyBlocker, type Blocker } from "@/lib/deal-facts/blockers";
import type { DealFacts, EvidenceRef, FollowUpReason } from "@/lib/followup/rules";

const NOW = new Date("2026-11-01T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function ev(id: string, daysAgo = 3): EvidenceRef {
  return {
    eventId: id,
    source: "hubspot",
    sourceEventId: `hs_${id}`,
    kind: "email_inbound",
    occurredAt: day(daysAgo),
    summary: `message ${id}`,
  };
}

function fact(over: Partial<DealFactView> & Pick<DealFactView, "kind" | "value">): DealFactView {
  return {
    id: `f_${over.kind}`,
    status: "SUGGESTED",
    sourceKind: "email",
    evidence: [],
    correctedFrom: null,
    lastVerifiedAt: day(2),
    ...over,
  } as DealFactView;
}

function deal(over: Partial<DealFacts> = {}): DealFacts {
  return {
    opportunityId: "opp_1",
    accountName: "Northwind",
    amount: 9_000,
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

const silence = (rule: FollowUpReason["rule"]): FollowUpReason => ({
  rule,
  action: "Follow up",
  because: `because of ${rule}`,
  evidence: [ev("e1")],
  daysOverdue: 4,
  staleness: null,
});

function identify(over: Partial<Parameters<typeof identifyBlocker>[0]> = {}) {
  return identifyBlocker({
    deal: deal(),
    facts: {},
    evidenceById: new Map(),
    silenceReason: null,
    buyerReplied: false,
    // Most cases here are about what a recorded fact implies, so extraction
    // is assumed to have run. The case where it has not is tested explicitly.
    hasExtractedFacts: true,
    ...over,
  });
}

// ── Each blocker is recognised ───────────────────────────────────────────

test("an overdue agreed action is the blocker", () => {
  const blocker = identify({ silenceReason: silence("followup_due") });
  assert.equal(blocker?.kind, "overdue_action");
});

test("an unanswered pricing question is recognised from the record", () => {
  const blocker = identify({
    facts: { budget: fact({ kind: "budget", value: "What would 6 months cost?" }) },
  });
  assert.equal(blocker?.kind, "unanswered_pricing");
  // The claim quotes them rather than paraphrasing.
  assert.match(blocker!.because, /What would 6 months cost\?/);
});

test("a budget on record that is not a question is not a pricing blocker", () => {
  // "Budget is £4k/month" is information, not something awaiting an answer.
  const blocker = identify({
    facts: { budget: fact({ kind: "budget", value: "Budget approved at 4k per month" }) },
  });
  assert.notEqual(blocker?.kind, "unanswered_pricing");
});

test("an open scope question is recognised", () => {
  const blocker = identify({
    facts: { scope_question: fact({ kind: "scope_question", value: "Does this include ad spend?" }) },
  });
  assert.equal(blocker?.kind, "unclear_scope");
});

test("a missing decision-maker is raised once a proposal is out", () => {
  const blocker = identify({ deal: deal({ stageKey: "PROPOSAL" }) });
  assert.equal(blocker?.kind, "missing_decision_maker");
});

test("a missing decision-maker is not raised on an early-stage deal", () => {
  // Nobody knows who signs off on a deal that is still being qualified, and
  // saying so every time would be noise.
  const blocker = identify({ deal: deal({ stageKey: "QUALIFYING" }) });
  assert.equal(blocker, null);
});

test("a known decision-maker removes that blocker", () => {
  const blocker = identify({
    facts: { decision_maker: fact({ kind: "decision_maker", value: "Priya, MD" }) },
  });
  assert.equal(blocker, null);
});

// ── Nothing is invented ──────────────────────────────────────────────────

test("no blocker is produced from an empty record on an early deal", () => {
  assert.equal(identify({ deal: deal({ stageKey: "NEW" }) }), null);
});

test("a blocker never carries a score or probability", () => {
  const blocker = identify({ silenceReason: silence("followup_due") })!;
  for (const key of Object.keys(blocker)) {
    assert.ok(!/score|probability|forecast|likelihood/i.test(key), key);
  }
});

// ── Precedence ───────────────────────────────────────────────────────────

test("a broken commitment outranks an unanswered question", () => {
  const blocker = identify({
    silenceReason: silence("followup_due"),
    facts: { budget: fact({ kind: "budget", value: "How much for 6 months?" }) },
  });
  assert.equal(blocker?.kind, "overdue_action");
});

test("a specific unanswered question outranks mere silence", () => {
  // "They have not replied" says something is wrong; "they asked what it
  // costs and nobody answered" says what to do about it.
  const blocker = identify({
    silenceReason: silence("quote_no_reply"),
    facts: { scope_question: fact({ kind: "scope_question", value: "Who writes the copy?" }) },
  });
  assert.equal(blocker?.kind, "unclear_scope");
});

test("a reply suppresses the awaiting-reply blocker", () => {
  const blocker = identify({
    silenceReason: silence("quote_no_reply"),
    deal: deal({ stageKey: "QUALIFYING" }),
    buyerReplied: true,
  });
  assert.equal(blocker, null);
});

// ── Evidence resolves to real records ────────────────────────────────────

test("a fact's evidence is resolved to the records behind it", () => {
  const record = ev("e9");
  const blocker = identify({
    facts: {
      scope_question: fact({
        kind: "scope_question",
        value: "Does this include ad spend?",
        evidence: ["e9"],
      }),
    },
    evidenceById: new Map([["e9", record]]),
  });
  assert.deepEqual(blocker!.evidence.map((e) => e.eventId), ["e9"]);
  assert.equal(blocker!.factId, "f_scope_question");
});

test("evidence that cannot be resolved is dropped, not faked", () => {
  const blocker = identify({
    facts: {
      scope_question: fact({ kind: "scope_question", value: "q", evidence: ["missing"] }),
    },
    evidenceById: new Map(),
  });
  assert.deepEqual(blocker!.evidence, []);
});

// ── Ordering ─────────────────────────────────────────────────────────────

function row(kind: Blocker["kind"], over: Partial<{ daysOverdue: number; amount: number | null; opportunityId: string }> = {}) {
  return {
    blocker: { kind, title: "", because: "", recommendedAction: "", evidence: [], factId: null },
    daysOverdue: 0,
    amount: null,
    opportunityId: "o",
    ...over,
  };
}

test("the dashboard orders by what is most actionable", () => {
  const sorted = [
    row("gone_quiet"),
    row("missing_decision_maker"),
    row("overdue_action"),
    row("unanswered_pricing"),
  ].sort(compareBlocked);
  assert.deepEqual(sorted.map((r) => r.blocker.kind), [
    "overdue_action",
    "unanswered_pricing",
    "missing_decision_maker",
    "gone_quiet",
  ]);
});

test("a big old quiet deal cannot outrank today's broken promise", () => {
  const sorted = [
    row("gone_quiet", { daysOverdue: 200, amount: 500_000, opportunityId: "old" }),
    row("overdue_action", { daysOverdue: 0, amount: null, opportunityId: "new" }),
  ].sort(compareBlocked);
  assert.equal(sorted[0].opportunityId, "new");
});

test("ordering is total and stable", () => {
  const base = [row("gone_quiet", { opportunityId: "a" }), row("gone_quiet", { opportunityId: "b" })];
  assert.deepEqual(
    [...base].sort(compareBlocked).map((r) => r.opportunityId),
    [...base].reverse().sort(compareBlocked).map((r) => r.opportunityId)
  );
});

// ── Knowledge state ──────────────────────────────────────────────────────

test("a confirmed fact beats a suggested one of the same kind", () => {
  const best = bestByKind([
    fact({ id: "s", kind: "budget", value: "guessed", status: "SUGGESTED" }),
    fact({ id: "c", kind: "budget", value: "stated", status: "CONFIRMED" }),
  ]);
  assert.equal(best.budget?.id, "c");
});

test("among equals the most recently verified wins", () => {
  const best = bestByKind([
    fact({ id: "old", kind: "objection", value: "a", lastVerifiedAt: day(40) }),
    fact({ id: "new", kind: "objection", value: "b", lastVerifiedAt: day(1) }),
  ]);
  assert.equal(best.objection?.id, "new");
});

test("an old fact is marked stale rather than quietly trusted", () => {
  assert.equal(isStale(fact({ kind: "budget", value: "x", lastVerifiedAt: day(90) }), NOW), true);
  assert.equal(isStale(fact({ kind: "budget", value: "x", lastVerifiedAt: day(3) }), NOW), false);
  // Never verified is not the same as stale.
  assert.equal(isStale(fact({ kind: "budget", value: "x", lastVerifiedAt: null }), NOW), false);
});

test("a missing decision-maker is not a finding until extraction has looked", () => {
  // The absence of a `decision_maker` fact is the default state of every deal
  // Selryn has not read. Treating it as information made the rule fire on
  // every open proposal in the workspace, which filled Today with one generic
  // complaint and crowded out the specific ones.
  const withoutExtraction = identify({
    deal: deal({ stageKey: "PROPOSAL" }),
    facts: {},
    hasExtractedFacts: false,
  });
  assert.notEqual(
    withoutExtraction?.kind,
    "missing_decision_maker",
    "silence from a deal nobody has read is not evidence about the deal"
  );

  const withExtraction = identify({
    deal: deal({ stageKey: "PROPOSAL" }),
    facts: {},
    hasExtractedFacts: true,
  });
  assert.equal(withExtraction?.kind, "missing_decision_maker");
});
