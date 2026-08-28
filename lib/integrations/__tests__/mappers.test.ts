import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bandEmployees,
  dealEventType,
  mapCompany,
  mapContact,
  mapDeal,
  mapDealStage,
  parseAmount,
  parseDate,
  type HubspotObject,
} from "@/lib/integrations/hubspot/mappers";

const obj = (
  id: string,
  properties: Record<string, string | null | undefined>
): HubspotObject => ({ id, properties });

// ── Money ────────────────────────────────────────────────────────────────

test("a blank amount is null, never zero", () => {
  // HubSpot sends "" for a deal with no amount. Reading that as 0 would feed
  // a false number into expected revenue, ranking and revenue-at-risk - every
  // figure the product reasons with.
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("   "), null);
  assert.equal(parseAmount(null), null);
  assert.equal(parseAmount(undefined), null);
  // A real zero is still a real zero.
  assert.equal(parseAmount("0"), 0);
});

test("amounts parse in the formats HubSpot actually sends", () => {
  assert.equal(parseAmount("42000"), 42_000);
  assert.equal(parseAmount("42000.00"), 42_000);
  assert.equal(parseAmount("42,000"), 42_000);
  assert.equal(parseAmount(" 42000 "), 42_000);
  assert.equal(parseAmount("42000.49"), 42_000);
  assert.equal(parseAmount("42000.50"), 42_001);
});

test("unparseable and negative amounts are refused, not coerced", () => {
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("$42,000"), null);
  assert.equal(parseAmount("-500"), null);
  assert.equal(parseAmount("NaN"), null);
});

// ── Dates ────────────────────────────────────────────────────────────────

test("dates parse from both ISO strings and epoch milliseconds", () => {
  assert.equal(parseDate("2026-08-20T10:00:00Z")?.toISOString(), "2026-08-20T10:00:00.000Z");
  assert.equal(parseDate("1787220000000")?.getTime(), 1_787_220_000_000);
});

test("a missing or invalid date is null rather than the epoch", () => {
  // new Date("") is Invalid, and new Date(0) would silently date everything
  // to 1970 and reorder a deal's entire history.
  assert.equal(parseDate(""), null);
  assert.equal(parseDate(null), null);
  assert.equal(parseDate("not a date"), null);
});

// ── Stages ───────────────────────────────────────────────────────────────

test("an unrecognised stage is null, never a default", () => {
  // A "Contract Sent" deal silently becoming NEW would reset its win
  // probability and bury it at the bottom of every ranking - wrong in a
  // direction that still looks plausible.
  assert.equal(mapDealStage("Some Custom Stage"), null);
  assert.equal(mapDealStage(""), null);
  assert.equal(mapDealStage(null), null);
});

test("HubSpot's default pipeline labels map correctly", () => {
  assert.equal(mapDealStage("Appointment Scheduled"), "MEETING");
  assert.equal(mapDealStage("Qualified To Buy"), "QUALIFYING");
  assert.equal(mapDealStage("Presentation Scheduled"), "MEETING");
  assert.equal(mapDealStage("Decision Maker Bought-In"), "PROPOSAL");
  assert.equal(mapDealStage("Contract Sent"), "NEGOTIATION");
  assert.equal(mapDealStage("Closed Won"), "WON");
  assert.equal(mapDealStage("Closed Lost"), "LOST");
});

test("closed states win over the words they contain", () => {
  // "Closed Won" contains "closed"; "Closed Lost" contains both. Order of the
  // checks is what keeps these apart.
  assert.equal(mapDealStage("Closed Won"), "WON");
  assert.equal(mapDealStage("closed lost"), "LOST");
  assert.equal(mapDealStage("Won - Contract Signed"), "WON");
  assert.equal(mapDealStage("Lost - No Budget"), "LOST");
});

test("stage matching ignores case and padding", () => {
  assert.equal(mapDealStage("  CLOSED WON  "), "WON");
  assert.equal(mapDealStage("negotiation"), "NEGOTIATION");
});

// ── Companies ────────────────────────────────────────────────────────────

test("a company maps, lowercasing its domain", () => {
  const result = mapCompany(
    obj("1", { name: "  Cloudmint  ", domain: "Cloudmint.COM", industry: "Fintech", numberofemployees: "180", country: "United States" })
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.name, "Cloudmint");
  // Domains are the identity join key; case would fork one company into two.
  assert.equal(result.value.domain, "cloudmint.com");
  assert.equal(result.value.companySize, "51-200");
});

test("a nameless company is refused with a reason", () => {
  const result = mapCompany(obj("7", { domain: "x.com" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /no name/i);
});

test("headcount bands match the ICP scoring buckets", () => {
  assert.equal(bandEmployees("5"), "1-10");
  assert.equal(bandEmployees("50"), "11-50");
  assert.equal(bandEmployees("200"), "51-200");
  assert.equal(bandEmployees("1000"), "201-1000");
  assert.equal(bandEmployees("5000"), "1000+");
  assert.equal(bandEmployees(""), null);
});

// ── Contacts ─────────────────────────────────────────────────────────────

test("a contact maps, normalising its email", () => {
  const result = mapContact(
    obj("2", { firstname: "Maya", lastname: "Chen", email: "  Maya@Cloudmint.com ", jobtitle: "VP Finance" })
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.name, "Maya Chen");
  assert.equal(result.value.email, "maya@cloudmint.com");
});

test("a contact with no email is refused", () => {
  // Email is the join key for threads, engagement and identity resolution.
  const result = mapContact(obj("3", { firstname: "Maya" }));
  assert.equal(result.ok, false);
});

test("a nameless contact falls back to the email local part", () => {
  // Better a real fragment of their address than a placeholder pretending
  // to be a name.
  const result = mapContact(obj("4", { email: "maya@cloudmint.com" }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.name, "maya");
});

test("a half-named contact still maps", () => {
  const result = mapContact(obj("5", { firstname: "Maya", email: "m@c.com" }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.name, "Maya");
});

// ── Deals ────────────────────────────────────────────────────────────────

const LABELS = { "1234": "Closed Won", "5678": "Contract Sent" };

test("a deal maps through its stage label, not its id", () => {
  const result = mapDeal(
    obj("9", { dealname: "Cloudmint - Growth", amount: "42000", dealstage: "5678", closedate: "2026-09-30T00:00:00Z" }),
    LABELS
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.dealValue, 42_000);
  assert.equal(result.value.stage, "NEGOTIATION");
  assert.equal(result.value.rawStage, "Contract Sent");
});

test("without labels a stage id cannot map, and says so", () => {
  // Rather than mis-filing every deal in the portal under a guessed stage.
  const result = mapDeal(obj("9", { dealname: "X", amount: "1", dealstage: "5678" }), {});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.stage, null);
    assert.equal(result.value.rawStage, "5678");
  }
});

test("a deal keeps a null amount rather than inventing zero", () => {
  const result = mapDeal(obj("9", { dealname: "X", dealstage: "1234" }), LABELS);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.dealValue, null);
});

test("a nameless deal is refused", () => {
  assert.equal(mapDeal(obj("9", { amount: "1" }), LABELS).ok, false);
});

test("closed deals produce their own event types", () => {
  const won = mapDeal(obj("1", { dealname: "A", amount: "1", dealstage: "1234" }), LABELS);
  assert.ok(won.ok);
  if (won.ok) assert.equal(dealEventType(won.value), "deal.won");

  const open = mapDeal(obj("2", { dealname: "B", amount: "1", dealstage: "5678" }), LABELS);
  assert.ok(open.ok);
  if (open.ok) assert.equal(dealEventType(open.value), "deal.synced");
});

test("mapping never throws on a malformed object", () => {
  // A page of a hundred must not be lost because one record is strange.
  const junk = obj("x", { dealname: undefined, amount: null, dealstage: undefined });
  assert.doesNotThrow(() => mapDeal(junk, {}));
  assert.doesNotThrow(() => mapCompany(junk));
  assert.doesNotThrow(() => mapContact(junk));
});
