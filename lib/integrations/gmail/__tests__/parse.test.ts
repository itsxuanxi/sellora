import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildQuery,
  decodeBody,
  extractPlainText,
  parseAddress,
  parseAddressList,
  parseGmailMessage,
  stripQuotedReply,
  type GmailMessage,
} from "@/lib/integrations/gmail/parse";

/**
 * The parser is where a mailbox connector actually goes wrong: MIME trees,
 * base64url, address headers written six ways, and quoted chains. All of it
 * is testable with a fixture, which is the point of keeping it pure — none
 * of these needed a Google account to write or to trust.
 */

const b64 = (s: string) =>
  Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

// ── Addresses ─────────────────────────────────────────────────────────────

test("an address is read out of the usual header shapes", () => {
  assert.deepEqual(parseAddress('"Maya Chen" <maya@cloudmint.io>'), {
    email: "maya@cloudmint.io",
    name: "Maya Chen",
  });
  assert.deepEqual(parseAddress("Maya Chen <maya@cloudmint.io>"), {
    email: "maya@cloudmint.io",
    name: "Maya Chen",
  });
  assert.deepEqual(parseAddress("maya@cloudmint.io"), {
    email: "maya@cloudmint.io",
    name: null,
  });
});

test("an address is lowercased, because matching a contact depends on it", () => {
  assert.equal(parseAddress("Maya@CloudMint.IO").email, "maya@cloudmint.io");
});

test("an unparseable sender yields null rather than a guess", () => {
  // An inbox has bounce daemons and list headers in it. Inventing an address
  // from one attaches a stranger's mail to somebody's deal.
  assert.equal(parseAddress("Mail Delivery Subsystem").email, null);
  assert.equal(parseAddress("").email, null);
  assert.equal(parseAddress(null).email, null);
});

test("a recipient list survives a comma inside a quoted name", () => {
  const list = parseAddressList('"Chen, Maya" <maya@cloudmint.io>, dana@cloudmint.io');
  assert.deepEqual(list, ["maya@cloudmint.io", "dana@cloudmint.io"]);
});

// ── Bodies ────────────────────────────────────────────────────────────────

test("base64url decodes where plain base64 would fail", () => {
  // Gmail uses - and _ in place of + and /; Buffer does not accept those.
  assert.equal(decodeBody(b64("Hi — can you resend the pricing?")), "Hi — can you resend the pricing?");
  assert.equal(decodeBody(undefined), null);
});

test("the plain-text part is found anywhere in the MIME tree", () => {
  const text = extractPlainText({
    mimeType: "multipart/mixed",
    parts: [
      {
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/html", body: { data: b64("<p>ignored</p>") } },
          { mimeType: "text/plain", body: { data: b64("the real body") } },
        ],
      },
    ],
  });
  assert.equal(text, "the real body");
});

test("html is used when a sender offered nothing else", () => {
  const text = extractPlainText({
    mimeType: "text/html",
    body: { data: b64("<p>Can you <b>resend</b> the quote?</p>") },
  });
  assert.equal(text, "Can you resend the quote?");
});

test("an attachment is never mistaken for the message", () => {
  const text = extractPlainText({
    mimeType: "multipart/mixed",
    parts: [
      { mimeType: "text/plain", filename: "proposal.txt", body: { data: b64("ATTACHED FILE") } },
      { mimeType: "text/plain", body: { data: b64("see attached") } },
    ],
  });
  assert.equal(text, "see attached");
});

// ── Quoted chains ─────────────────────────────────────────────────────────

test("the quoted chain under a reply is dropped", () => {
  // Otherwise every reply in a long thread carries the whole thread again,
  // and a model reading it extracts a "new" fact from a six-week-old line.
  const body = [
    "That price is higher than we budgeted.",
    "",
    "On Mon, 3 Nov 2026, Alex Carter wrote:",
    "> Here is the proposal we discussed",
    "> Let me know what you think",
  ].join("\n");
  assert.equal(stripQuotedReply(body), "That price is higher than we budgeted.");
});

test("Outlook's divider is recognised too", () => {
  const body = "Looks good.\n\n-----Original Message-----\nFrom: alex@acme.com";
  assert.equal(stripQuotedReply(body), "Looks good.");
});

test("a message that is only a quote comes out empty, not wrong", () => {
  assert.equal(stripQuotedReply("> just the quote"), "");
});

// ── Whole messages ────────────────────────────────────────────────────────

function message(over: Partial<GmailMessage> = {}): GmailMessage {
  return {
    id: "m1",
    threadId: "t1",
    labelIds: ["INBOX"],
    internalDate: String(Date.UTC(2026, 10, 5, 9, 30)),
    snippet: "That price is higher…",
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Maya Chen <maya@cloudmint.io>" },
        { name: "To", value: "alex@acme.com" },
        { name: "Subject", value: "Re: Proposal" },
      ],
      body: { data: b64("That price is higher than we budgeted.") },
    },
    ...over,
  };
}

test("an inbound reply parses into what the schema stores", () => {
  const parsed = parseGmailMessage(message())!;
  assert.equal(parsed.direction, "inbound");
  assert.equal(parsed.fromEmail, "maya@cloudmint.io");
  assert.equal(parsed.fromName, "Maya Chen");
  assert.deepEqual(parsed.toEmails, ["alex@acme.com"]);
  assert.equal(parsed.subject, "Re: Proposal");
  assert.equal(parsed.body, "That price is higher than we budgeted.");
  assert.equal(parsed.threadId, "t1");
});

test("direction comes from Gmail's label, not from comparing addresses", () => {
  // An owner who sends from an alias, or whose mail goes out through a
  // sequencer, would otherwise have their own outbound filed as the client
  // replying — which marks every chased deal as answered.
  const sent = parseGmailMessage(message({ labelIds: ["SENT"] }))!;
  assert.equal(sent.direction, "outbound");
});

test("a draft is not correspondence", () => {
  assert.equal(parseGmailMessage(message({ labelIds: ["DRAFT"] })), null);
});

test("a message with no readable sender is skipped", () => {
  const broken = message({
    payload: { headers: [{ name: "Subject", value: "No sender" }] },
  });
  assert.equal(parseGmailMessage(broken), null);
});

test("a message with no date is skipped rather than dated now", () => {
  // Dating it "now" would make an old thread look like activity today, which
  // is precisely the signal the whole product is built on.
  const undated = message({ internalDate: undefined });
  undated.payload!.headers = undated.payload!.headers!.filter((h) => h.name !== "Date");
  assert.equal(parseGmailMessage(undated), null);
});

test("a body that is entirely quoted stores null, not an empty string", () => {
  const quoted = message({
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "maya@cloudmint.io" },
        { name: "Subject", value: "Re: Proposal" },
      ],
      body: { data: b64("> only the quote") },
    },
  });
  assert.equal(parseGmailMessage(quoted)!.body, null);
});

// ── What gets fetched at all ──────────────────────────────────────────────

test("the query is scoped to known contacts", () => {
  // Selryn has no business reading mail from an agency's accountant. Scoping
  // the query means that mail is never fetched, not fetched and discarded.
  const q = buildQuery({ contactEmails: ["maya@cloudmint.io"], sinceDays: 3 })!;
  assert.match(q, /from:maya@cloudmint\.io/);
  assert.match(q, /to:maya@cloudmint\.io/);
  assert.match(q, /newer_than:3d/);
});

test("duplicate and malformed addresses do not reach the query", () => {
  const q = buildQuery({
    contactEmails: ["Maya@Cloudmint.io", "maya@cloudmint.io", "not-an-address"],
    sinceDays: 3,
  })!;
  assert.equal(q.match(/from:maya@cloudmint\.io/g)?.length, 1);
  assert.ok(!q.includes("not-an-address"));
});

test("no contacts means no query, so nothing is fetched", () => {
  assert.equal(buildQuery({ contactEmails: [], sinceDays: 3 }), null);
  assert.equal(buildQuery({ contactEmails: ["nope"], sinceDays: 3 }), null);
});
