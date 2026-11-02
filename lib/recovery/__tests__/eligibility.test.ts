import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROPOSAL_DORMANT_DAYS,
  REVISITABLE_LOSS_REASONS,
  compareRecovery,
  evaluateRecovery,
  type RecoveryCandidate,
  type RecoveryReason,
} from "@/lib/recovery/eligibility";

const NOW = new Date("2026-11-01T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const ahead = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

function candidate(over: Partial<RecoveryCandidate> = {}): RecoveryCandidate {
  return {
    opportunityId: "opp_1",
    accountName: "Northwind",
    amount: 12_000,
    currency: "USD",
    stageKey: "PROPOSAL",
    closedAt: null,
    lostReason: null,
    proposalSentAt: day(60),
    lastActivityAt: day(55),
    everEngaged: true,
    postponedUntil: null,
    exclusions: [],
    evidenceIds: ["e1"],
    ...over,
  };
}

// ── Exclusions are absolute ──────────────────────────────────────────────

test("a do-not-contact flag disqualifies a deal outright", () => {
  const verdict = evaluateRecovery(candidate({ exclusions: ["do_not_contact"] }), NOW);
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.eligible === false && verdict.why, "excluded");
});

test("an explicit rejection is never surfaced, however valuable the deal", () => {
  const verdict = evaluateRecovery(
    candidate({ exclusions: ["explicit_rejection"], amount: 500_000 }),
    NOW
  );
  assert.equal(verdict.eligible, false);
});

test("every exclusion kind disqualifies", () => {
  for (const reason of ["do_not_contact", "explicit_rejection", "user_excluded", "unsubscribed"] as const) {
    const verdict = evaluateRecovery(candidate({ exclusions: [reason] }), NOW);
    assert.equal(verdict.eligible, false, reason);
    assert.equal(verdict.eligible === false && verdict.why, "excluded");
  }
});

test("exclusions are checked before anything that would qualify", () => {
  // A postponement whose date arrived is the strongest positive signal there
  // is; it must still lose to an opt-out.
  const verdict = evaluateRecovery(
    candidate({ postponedUntil: day(5), exclusions: ["unsubscribed"] }),
    NOW
  );
  assert.equal(verdict.eligible, false);
});

// ── Old is not the same as dormant ───────────────────────────────────────

test("a record nobody ever engaged with is old, not a recovery opportunity", () => {
  // Reopening a conversation that never happened is cold outreach in costume.
  const verdict = evaluateRecovery(
    candidate({ everEngaged: false, lastActivityAt: day(400) }),
    NOW
  );
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.eligible === false && verdict.why, "never_engaged");
});

test("age alone never qualifies anything", () => {
  const verdict = evaluateRecovery(
    candidate({
      everEngaged: true,
      proposalSentAt: null,
      stageKey: "QUALIFYING",
      lastActivityAt: day(900),
    }),
    NOW
  );
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.eligible === false && verdict.why, "no_qualifying_rule");
});

// ── The three qualifying rules ───────────────────────────────────────────

test("a proposal nobody answered qualifies once it is properly dormant", () => {
  const verdict = evaluateRecovery(candidate({ proposalSentAt: day(60) }), NOW);
  assert.equal(verdict.eligible, true);
  assert.equal(verdict.eligible && verdict.reason.rule, "proposal_unanswered");
  assert.match(verdict.eligible ? verdict.reason.because : "", /60 days ago/);
});

test("a proposal still inside the waiting window is not recovery, just waiting", () => {
  const verdict = evaluateRecovery(
    candidate({ proposalSentAt: day(PROPOSAL_DORMANT_DAYS - 1) }),
    NOW
  );
  assert.equal(verdict.eligible === false && verdict.why, "too_recent");
});

test("a postponement whose date has arrived qualifies", () => {
  const verdict = evaluateRecovery(candidate({ postponedUntil: day(2) }), NOW);
  assert.equal(verdict.eligible && verdict.reason.rule, "postponement_due");
});

test("a postponement still in the future does not", () => {
  const verdict = evaluateRecovery(
    candidate({ postponedUntil: ahead(30), proposalSentAt: null, stageKey: "QUALIFYING" }),
    NOW
  );
  assert.equal(verdict.eligible, false);
});

test("a loss over timing or budget becomes revisitable after its own wait", () => {
  for (const [reason, wait] of Object.entries(REVISITABLE_LOSS_REASONS)) {
    const ready = evaluateRecovery(
      candidate({
        stageKey: "LOST",
        lostReason: reason,
        closedAt: day(wait + 5),
        proposalSentAt: null,
      }),
      NOW
    );
    assert.equal(ready.eligible, true, `${reason} should qualify after ${wait} days`);

    const early = evaluateRecovery(
      candidate({
        stageKey: "LOST",
        lostReason: reason,
        closedAt: day(wait - 5),
        proposalSentAt: null,
      }),
      NOW
    );
    assert.equal(early.eligible, false, `${reason} should still be too recent`);
  }
});

test("a deal lost to a competitor is not resurfaced", () => {
  // They chose someone else. A cheery note six months later reads as not
  // having listened.
  const verdict = evaluateRecovery(
    candidate({
      stageKey: "LOST",
      lostReason: "competitor",
      closedAt: day(400),
      proposalSentAt: null,
    }),
    NOW
  );
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.eligible === false && verdict.why, "no_qualifying_rule");
});

// ── No revenue claims ────────────────────────────────────────────────────

test("a recovery reason contains no money and no promise", () => {
  const verdict = evaluateRecovery(candidate(), NOW);
  assert.ok(verdict.eligible);
  const reason = (verdict as { reason: RecoveryReason }).reason;
  const text = `${reason.because} ${reason.angle}`;
  assert.ok(!/\$|recover|revenue|win back|guarantee/i.test(text), text);
});

test("the module exposes no total of any kind", async () => {
  const mod = await import("@/lib/recovery/eligibility");
  for (const key of Object.keys(mod)) {
    assert.ok(!/total|sum|recoverable|pipeline/i.test(key), `${key} looks like a total`);
  }
});

// ── Ordering ─────────────────────────────────────────────────────────────

function row(rule: RecoveryReason["rule"], over: Partial<{ dormantDays: number; amount: number | null; opportunityId: string }> = {}) {
  return {
    reason: { rule, because: "", angle: "", evidenceIds: [], dormantDays: 100, ...over },
    amount: over.amount ?? null,
    opportunityId: over.opportunityId ?? "o",
  };
}

test("a date the client named outranks our own inference", () => {
  const sorted = [
    row("loss_reason_expired"),
    row("proposal_unanswered"),
    row("postponement_due"),
  ].sort(compareRecovery);
  assert.deepEqual(sorted.map((r) => r.reason.rule), [
    "postponement_due",
    "proposal_unanswered",
    "loss_reason_expired",
  ]);
});

test("within a rule, the least stale comes first", () => {
  const sorted = [
    row("proposal_unanswered", { dormantDays: 300, opportunityId: "stale" }),
    row("proposal_unanswered", { dormantDays: 40, opportunityId: "fresher" }),
  ].sort(compareRecovery);
  assert.equal(sorted[0].opportunityId, "fresher");
});
