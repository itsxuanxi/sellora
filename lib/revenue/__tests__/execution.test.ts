import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALWAYS_AVAILABLE,
  draftFor,
  executionSummary,
} from "@/lib/revenue/execution";
import type { EnrichedOpportunity } from "@/lib/revenue/queries";

/**
 * The draft is what a human is asked to approve, so the properties that
 * matter are: it addresses a real person, it cites the evidence on screen,
 * and it refuses to exist when there is nobody to send to.
 */

function opportunity(over: Partial<EnrichedOpportunity> = {}): EnrichedOpportunity {
  return {
    id: "opp1",
    name: "Cloudmint — Growth Plan",
    stage: "PROPOSAL",
    dealValue: 42_000,
    currency: "USD",
    dealValueBasis: "user_entered",
    winProbability: 62,
    expectedValue: 26_040,
    score: 79,
    scoreBand: "hot",
    confidence: "high",
    whyNow: ["+ Proposal opened twice"],
    lastInteractionAt: new Date(),
    lastInteractionKind: "email_opened",
    nextStepDueAt: null,
    daysSinceContact: 4,
    account: { id: "a1", name: "Cloudmint", industry: "Fintech", domain: "cloudmint.io" },
    contact: { id: "c1", name: "Maya Chen", position: "VP Finance", email: "maya@cloudmint.io" },
    signals: [],
    leaks: [],
    primaryLeak: {
      type: "going_cold",
      category: "Going cold",
      severity: "critical",
      summary: "They opened your proposal and nobody has followed up since.",
      evidence: ["Proposal opened 2x", "No contact for 4 days"],
      ageDays: 4,
    } as EnrichedOpportunity["primaryLeak"],
    nextAction: {
      actionType: "follow_up",
      headline: "Send Maya Chen a personal follow-up today",
      rationale: "The proposal was opened twice and nobody has replied.",
      urgency: "today",
      expectedValue: 26_040,
      leakType: "going_cold",
      alternatives: [],
      dedupeKey: "k",
    },
    atRisk: 26_040,
    ...over,
  } as EnrichedOpportunity;
}

test("the draft greets the actual contact by first name", () => {
  const draft = draftFor(opportunity());
  assert.match(draft.body, /^Hi Maya,/);
  assert.equal(draft.destination, "maya@cloudmint.io");
  assert.equal(draft.blocked, null);
});

test("the draft cites the detected leak rather than generic encouragement", () => {
  const draft = draftFor(opportunity());
  assert.match(draft.body, /nobody has followed up since/i);
});

test("an opportunity with no contact email cannot be drafted", () => {
  const draft = draftFor(opportunity({ contact: null }));
  assert.ok(draft.blocked, "expected a blocking reason");
  assert.match(draft.blocked!, /no contact with an email address/i);
});

test("a call action is not an email and says nothing is sent", () => {
  const opp = opportunity();
  const draft = draftFor({
    ...opp,
    nextAction: { ...opp.nextAction, actionType: "call" },
  });
  assert.equal(draft.channel, "call");
  assert.match(executionSummary(draft, false), /Nothing is sent/i);
});

test("the approval note names the destination, and says when it is simulated", () => {
  const draft = draftFor(opportunity());
  const real = executionSummary(draft, false);
  const sandbox = executionSummary(draft, true);

  assert.match(real, /maya@cloudmint\.io/);
  assert.equal(/simulated/i.test(real), false);

  // The person approving has to be able to tell these two apart at a glance.
  assert.match(sandbox, /simulated/i);
  assert.match(sandbox, /No email will actually be delivered/i);
});

test("a blocked draft explains itself instead of offering to send", () => {
  const draft = draftFor(opportunity({ contact: null }));
  assert.equal(executionSummary(draft, false), draft.blocked);
});

// ── The internal actions ───────────────────────────────────────────────────

test("a follow-up task reaches nobody and says so", () => {
  const draft = draftFor(opportunity(), "task");
  assert.equal(draft.channel, "manual");
  assert.equal(draft.blocked, null);

  const note = executionSummary(draft, false);
  assert.match(note, /follow-up task/i);
  assert.match(note, /next step/i);
  // The whole point of a task is that the buyer is not contacted.
  assert.match(note, /Nothing is sent to the buyer/i);
});

test("an escalation goes to managers, never to the buyer", () => {
  const draft = draftFor(opportunity(), "escalate_manager");
  assert.equal(draft.channel, "internal");

  const real = executionSummary(draft, false);
  assert.match(real, /owners and admins/i);
  assert.match(real, /buyer is not contacted/i);

  // And a sandbox must be distinguishable from the real thing at a glance.
  assert.match(executionSummary(draft, true), /Simulated/i);
});

test("an internal action is draftable even with no contact email", () => {
  // A task and an escalation are about the deal, not the person, so a
  // missing address must not block them the way it blocks an email.
  for (const type of ["task", "escalate_manager"] as const) {
    const draft = draftFor(opportunity({ contact: null }), type);
    assert.equal(draft.blocked, null, `${type} should not be blocked`);
  }
});

test("the alternatives offered are only the ones that always apply", () => {
  assert.deepEqual(ALWAYS_AVAILABLE, ["follow_up", "call", "task", "escalate_manager"]);
  // Every one must be draftable without extra context.
  for (const type of ALWAYS_AVAILABLE) {
    const draft = draftFor(opportunity(), type);
    assert.ok(draft.body.length > 0, `${type} produced no body`);
    assert.ok(draft.summary.length > 0, `${type} produced no summary`);
  }
});

test("an internal action's destination is not the buyer's address", () => {
  // Storing the contact email against a task would put a person in the
  // ledger who was never contacted.
  const task = draftFor(opportunity(), "task");
  assert.equal(task.destination, null);

  const escalation = draftFor(opportunity(), "escalate_manager");
  assert.equal(escalation.destination, "Workspace owners and admins");

  // An email still records where it went.
  const email = draftFor(opportunity(), "follow_up");
  assert.equal(email.destination, "maya@cloudmint.io");
});
