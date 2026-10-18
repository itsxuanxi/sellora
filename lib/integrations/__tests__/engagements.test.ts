import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENGAGEMENT_OBJECT_TYPES,
  ENGAGEMENT_SPECS,
  mapEngagement,
  type EngagementObjectType,
} from "@/lib/integrations/hubspot/engagements";
import type { HubspotObject } from "@/lib/integrations/hubspot/mappers";

const NOW = new Date("2026-10-18T12:00:00Z");
const PAST = "2026-10-10T09:00:00Z";
const FUTURE = "2026-10-25T09:00:00Z";

function obj(
  id: string,
  properties: Record<string, string>,
  assoc: { deals?: string[]; contacts?: string[] } = { deals: ["d1"] }
): HubspotObject {
  return {
    id,
    properties,
    associations: {
      ...(assoc.deals ? { deals: { results: assoc.deals.map((i) => ({ id: i })) } } : {}),
      ...(assoc.contacts
        ? { contacts: { results: assoc.contacts.map((i) => ({ id: i })) } }
        : {}),
    },
  } as unknown as HubspotObject;
}

function mapped(type: EngagementObjectType, o: HubspotObject) {
  const r = mapEngagement(type, o, NOW);
  assert.equal(r.ok, true, `expected ${type} to map`);
  if (!r.ok) throw new Error("unreachable");
  return r.value;
}

// ── Email direction ───────────────────────────────────────────────────────

test("an inbound email is the buyer replying", () => {
  const e = mapped(
    "emails",
    obj("1", { hs_timestamp: PAST, hs_email_direction: "INCOMING_EMAIL", hs_email_subject: "Re: scope" })
  );
  assert.equal(e.actorType, "buyer");
  assert.equal(e.interactionKind, "email_replied");
  assert.equal(e.signal?.type, "email_replied");
});

test("an outbound email is us, and proves nothing about them", () => {
  const e = mapped("emails", obj("2", { hs_timestamp: PAST, hs_email_direction: "EMAIL" }));
  assert.equal(e.actorType, "seller");
  assert.equal(e.interactionKind, "email_sent");
  assert.equal(e.signal, null);
});

test("an email of unknown direction is treated as ours", () => {
  // The expensive direction to be wrong in: counting an email of unknown
  // provenance as a reply would clear `neverReplied` on no evidence.
  for (const props of [{ hs_timestamp: PAST }, { hs_timestamp: PAST, hs_email_direction: "" }]) {
    const e = mapped("emails", obj("3", props));
    assert.equal(e.actorType, "seller");
    assert.equal(e.signal, null);
  }
});

// ── Meetings ──────────────────────────────────────────────────────────────

test("a completed past meeting proves attendance", () => {
  const e = mapped(
    "meetings",
    obj("4", { hs_timestamp: PAST, hs_meeting_outcome: "COMPLETED", hs_meeting_title: "Scope call" })
  );
  assert.equal(e.signal?.type, "meeting_attended");
  assert.equal(e.actorType, "buyer");
  assert.equal(e.eventType, "meeting.held");
});

test("a no-show is recorded as its own signal, not as attendance", () => {
  const e = mapped("meetings", obj("5", { hs_timestamp: PAST, hs_meeting_outcome: "NO_SHOW" }));
  assert.equal(e.signal?.type, "meeting_no_show");
  // They did not give us their time, so it is not buyer engagement.
  assert.equal(e.actorType, "seller");
});

test("a past meeting whose outcome was never updated proves nothing", () => {
  // Reps routinely leave the outcome at SCHEDULED. Treating that as attended
  // would manufacture the strongest behavioural signal in the model.
  for (const outcome of ["SCHEDULED", "", "CANCELED", "RESCHEDULED"]) {
    const e = mapped("meetings", obj("6", { hs_timestamp: PAST, hs_meeting_outcome: outcome }));
    assert.equal(e.signal, null, `outcome "${outcome}" must not imply attendance`);
  }
});

test("a future meeting is scheduled, never attended", () => {
  const e = mapped("meetings", obj("7", { hs_timestamp: FUTURE, hs_meeting_outcome: "COMPLETED" }));
  assert.equal(e.signal, null);
  assert.equal(e.eventType, "meeting.scheduled");
});

test("a meeting's start time wins over its create timestamp", () => {
  const e = mapped(
    "meetings",
    obj("8", { hs_timestamp: "2026-09-01T09:00:00Z", hs_meeting_start_time: PAST })
  );
  assert.equal(e.occurredAt.toISOString(), new Date(PAST).toISOString());
});

// ── Calls and notes ───────────────────────────────────────────────────────

test("an inbound call is buyer activity but invents no signal", () => {
  const e = mapped("calls", obj("9", { hs_timestamp: PAST, hs_call_direction: "INBOUND" }));
  assert.equal(e.actorType, "buyer");
  assert.equal(e.eventType, "call.received");
  // No SignalType means "buyer phoned in". Borrowing one that means something
  // else would corrupt every weight that reads it.
  assert.equal(e.signal, null);
});

test("a note is our own working text, never evidence about them", () => {
  const e = mapped("notes", obj("10", { hs_timestamp: PAST }));
  assert.equal(e.actorType, "seller");
  assert.equal(e.interactionKind, "note");
  assert.equal(e.signal, null);
});

// ── Rejection ─────────────────────────────────────────────────────────────

test("an engagement attached to nothing is dropped, not guessed at", () => {
  const r = mapEngagement("emails", obj("11", { hs_timestamp: PAST }, {}), NOW);
  assert.equal(r.ok, false);
});

test("an engagement with no usable timestamp is dropped", () => {
  for (const props of [{}, { hs_timestamp: "" }, { hs_timestamp: "not-a-date" }]) {
    const r = mapEngagement("calls", obj("12", props), NOW);
    assert.equal(r.ok, false, `${JSON.stringify(props)} should not map`);
  }
});

test("one bad engagement returns a reason rather than throwing", () => {
  // A backfill of ten thousand rows must not stop on one malformed record.
  const r = mapEngagement("emails", obj("13", {}, {}), NOW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.reason.length > 0);
});

// ── The rule the whole module exists to keep ──────────────────────────────

test("nothing derives proposal_opened from a HubSpot engagement", () => {
  // It feeds the highest-severity leak rule in the product. HubSpot proves
  // neither that a document was a proposal nor that the buyer opened it, so
  // firing it from a subject-line match would be exactly the confident
  // fabrication the rest of this codebase refuses.
  const samples: [EngagementObjectType, Record<string, string>][] = [
    ["emails", { hs_timestamp: PAST, hs_email_subject: "Your proposal is attached" }],
    ["emails", { hs_timestamp: PAST, hs_email_direction: "INCOMING_EMAIL", hs_email_subject: "Re: proposal" }],
    ["meetings", { hs_timestamp: PAST, hs_meeting_title: "Proposal review", hs_meeting_outcome: "COMPLETED" }],
    ["calls", { hs_timestamp: PAST, hs_call_title: "Proposal walkthrough" }],
  ];
  for (const [type, props] of samples) {
    const e = mapped(type, obj("14", props));
    assert.notEqual(e.signal?.type, "proposal_opened");
  }
});

test("every engagement type declares a scope and properties", () => {
  for (const type of ENGAGEMENT_OBJECT_TYPES) {
    const spec = ENGAGEMENT_SPECS[type];
    assert.ok(spec.scope.length > 0, `${type} has no scope`);
    assert.ok(spec.properties.includes("hs_timestamp"), `${type} must request hs_timestamp`);
  }
});

test("note bodies are never requested", () => {
  // Private working text, no buyer evidence in it, and a wider blast radius
  // for no gain.
  assert.ok(!ENGAGEMENT_SPECS.notes.properties.includes("hs_note_body"));
});
