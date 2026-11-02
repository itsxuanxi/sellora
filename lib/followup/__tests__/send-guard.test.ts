import { test } from "node:test";
import assert from "node:assert/strict";
import { decideSend, type SendCandidate } from "@/lib/followup/send-guard";

const BODY = "Hi Maya — checking in on the quote we sent last week.";
const SUBJECT = "Following up";

function draft(over: Partial<SendCandidate> = {}): SendCandidate {
  return {
    status: "DRAFT",
    toAddress: "maya@northwind.example",
    subject: SUBJECT,
    body: BODY,
    sendClaimedAt: null,
    sentAt: null,
    ...over,
  };
}

const confirm = { confirmedBody: BODY, confirmedSubject: SUBJECT, confirmed: true };

test("a confirmed draft may be sent", () => {
  assert.deepEqual(decideSend(draft(), confirm), { allowed: true });
});

// ── Nothing sends without an explicit confirmation ────────────────────────

test("an unconfirmed send is refused", () => {
  const decision = decideSend(draft(), { ...confirm, confirmed: false });
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.reason, "not_confirmed");
});

test("confirmation is never inferred from the draft being complete", () => {
  // The whole promise is that a human pressed the button. A draft that looks
  // ready is not a decision to send it.
  for (const status of ["DRAFT", "EDITED"]) {
    const decision = decideSend(draft({ status }), { ...confirm, confirmed: false });
    assert.equal(decision.allowed, false);
  }
});

test("a confirmation of different text than the draft holds is refused", () => {
  // Edited in one tab, confirmed in another: the text that would go out is
  // not the text the person read.
  const decision = decideSend(draft(), { ...confirm, confirmedBody: "Something else" });
  assert.equal(decision.allowed === false && decision.reason, "stale_confirmation");

  const subjectChanged = decideSend(draft(), { ...confirm, confirmedSubject: "Other" });
  assert.equal(
    subjectChanged.allowed === false && subjectChanged.reason,
    "stale_confirmation"
  );
});

test("trailing whitespace alone does not count as a change", () => {
  assert.deepEqual(
    decideSend(draft(), {
      ...confirm,
      confirmedBody: `${BODY}\n`,
      confirmedSubject: ` ${SUBJECT} `,
    }),
    { allowed: true }
  );
});

// ── A second click cannot send a second email ─────────────────────────────

test("a draft already sent is refused", () => {
  const decision = decideSend(
    draft({ status: "SENT", sentAt: new Date() }),
    confirm
  );
  assert.equal(decision.allowed === false && decision.reason, "already_sent");
});

test("a send already in flight is refused", () => {
  // The double click: the first is still talking to the provider.
  const decision = decideSend(draft({ sendClaimedAt: new Date() }), confirm);
  assert.equal(decision.allowed === false && decision.reason, "send_in_progress");
});

test("a failed send does not reopen the same draft for another attempt", () => {
  // After a transport error we cannot know whether the provider accepted the
  // message, so the claim stands and a retry means a new draft.
  const decision = decideSend(
    draft({ status: "FAILED", sendClaimedAt: new Date(), failureReason: "timeout" } as Partial<SendCandidate>),
    confirm
  );
  assert.equal(decision.allowed === false && decision.reason, "send_in_progress");
});

test("already-sent is reported ahead of any complaint about the request", () => {
  const decision = decideSend(draft({ status: "SENT", sentAt: new Date() }), {
    confirmedBody: "",
    confirmedSubject: "",
    confirmed: false,
  });
  assert.equal(decision.allowed === false && decision.reason, "already_sent");
});

// ── Sanity ────────────────────────────────────────────────────────────────

test("an empty draft is refused", () => {
  const decision = decideSend(draft({ body: "   " }), {
    ...confirm,
    confirmedBody: "   ",
  });
  assert.equal(decision.allowed === false && decision.reason, "empty_body");
});

test("a contact with no address is refused", () => {
  const decision = decideSend(draft({ toAddress: null }), confirm);
  assert.equal(decision.allowed === false && decision.reason, "no_recipient");
});

test("a missing draft is refused rather than throwing", () => {
  assert.equal(decideSend(null, confirm).allowed, false);
});

test("every refusal carries a message a seller can act on", () => {
  const cases: [SendCandidate | null, Parameters<typeof decideSend>[1]][] = [
    [null, confirm],
    [draft({ status: "SENT", sentAt: new Date() }), confirm],
    [draft({ sendClaimedAt: new Date() }), confirm],
    [draft(), { ...confirm, confirmed: false }],
    [draft({ toAddress: null }), confirm],
  ];
  for (const [d, r] of cases) {
    const decision = decideSend(d, r);
    assert.equal(decision.allowed, false);
    if (!decision.allowed) {
      assert.ok(decision.message.length > 10);
      // Business language, not a status code.
      assert.ok(!/null|undefined|_/.test(decision.message), decision.message);
    }
  }
});
