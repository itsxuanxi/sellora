import { test } from "node:test";
import assert from "node:assert/strict";
import { draftFor, executionSummary } from "@/lib/revenue/execution";
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
