import { test } from "node:test";
import assert from "node:assert/strict";
import {
  outcomeOf,
  statLines,
  summarize,
  type TrackedFollowUp,
} from "@/lib/followup/tracking";

const SENT = new Date("2026-11-01T09:00:00Z");
const later = (h: number) => new Date(SENT.getTime() + h * 3_600_000);

function fu(over: Partial<TrackedFollowUp> = {}): TrackedFollowUp {
  return {
    id: "f1",
    status: "SENT",
    sentAt: SENT,
    repliedAt: null,
    edited: false,
    meetingAt: null,
    stageChangedAt: null,
    ...over,
  };
}

// ── Outcomes are observed, never inferred ────────────────────────────────

test("a drafted follow-up nobody confirmed is not 'sent'", () => {
  assert.equal(outcomeOf(fu({ status: "DRAFT", sentAt: null })), "awaiting_confirmation");
});

test("sending does not by itself mean a meeting or a stage change", () => {
  // The whole trap: a sent email is not an outcome.
  assert.equal(outcomeOf(fu()), "sent");
});

test("a meeting counts only when one was recorded", () => {
  assert.equal(outcomeOf(fu({ meetingAt: later(48) })), "meeting_booked");
});

test("a stage change outranks a meeting, which outranks a reply", () => {
  assert.equal(
    outcomeOf(fu({ repliedAt: later(2), meetingAt: later(5), stageChangedAt: later(9) })),
    "stage_changed"
  );
  assert.equal(outcomeOf(fu({ repliedAt: later(2), meetingAt: later(5) })), "meeting_booked");
  assert.equal(outcomeOf(fu({ repliedAt: later(2) })), "replied");
});

test("a failed send is reported as failed, not as waiting", () => {
  assert.equal(outcomeOf(fu({ status: "FAILED", sentAt: null })), "failed");
});

// ── Statistics carry their denominators ──────────────────────────────────

test("rates are computed over sends, not over drafts", () => {
  const stats = summarize([
    fu({ id: "a", repliedAt: later(3) }),
    fu({ id: "b" }),
    fu({ id: "c", status: "DRAFT", sentAt: null }),
  ]);
  assert.deepEqual(stats, {
    suggested: 3,
    sent: 2,
    sentUnedited: 2,
    replied: 1,
    progressed: 0,
  });

  const lines = statLines(stats);
  assert.equal(lines[0].value, "67%"); // 2 of 3 drafted were sent
  assert.equal(lines[1].value, "50%"); // 1 of 2 sent drew a reply
});

test("every figure states the denominator it was computed over", () => {
  const lines = statLines(summarize([fu({ repliedAt: later(1) }), fu()]));
  for (const line of lines) {
    // "80% reply rate" over five sends is noise; the counts travel with it.
    assert.match(line.definition, /\d+ of \d+/, line.label);
  }
});

test("no rate divides by zero", () => {
  for (const line of statLines(summarize([]))) {
    assert.equal(line.value, "—");
  }
});

test("editing a draft before sending is counted separately from sending it", () => {
  const stats = summarize([fu({ edited: true }), fu({ edited: false })]);
  assert.equal(stats.sent, 2);
  assert.equal(stats.sentUnedited, 1);
  assert.match(statLines(stats)[0].definition, /1 went out unedited/);
});

// ── No win attribution ───────────────────────────────────────────────────

test("the statistics never claim a deal was won because of a follow-up", () => {
  const lines = statLines(summarize([fu({ stageChangedAt: later(20) })]));
  const text = lines.map((l) => `${l.label} ${l.definition}`).join(" ");
  assert.ok(!/\bwon\b|\bclosed\b|\brevenue\b|\battributed\b/i.test(text), text);
  // And it says plainly what the number is not.
  assert.match(lines[2].definition, /sequence, not a cause/);
});
