import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CRM_OPTIONS,
  OPPORTUNITY_VOLUMES,
  TEAM_SIZES,
  labelFor,
  validateDemoRequest,
  type DemoRequestInput,
} from "@/lib/marketing/demo-request";

function valid(overrides: Partial<DemoRequestInput> = {}): DemoRequestInput {
  return {
    fullName: "Maya Chen",
    workEmail: "maya@cloudmint.com",
    company: "Cloudmint",
    role: "VP Finance",
    teamSize: "6_20",
    crm: "hubspot",
    opportunityVolume: "501_2000",
    goal: "Deals go quiet after the demo and we find out far too late.",
    heardFrom: "A colleague",
    website: "",
    ...overrides,
  };
}

test("a complete request passes", () => {
  const result = validateDemoRequest(valid());
  assert.equal(result.ok, true);
});

test("every required field reports its own error", () => {
  const result = validateDemoRequest({
    fullName: "",
    workEmail: "",
    company: "",
    role: "",
    teamSize: "",
    goal: "",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;

  for (const field of ["fullName", "workEmail", "company", "role", "teamSize", "goal"] as const) {
    assert.ok(result.errors[field], `${field} produced no error message`);
  }
});

test("optional fields really are optional", () => {
  // Someone without a CRM should not be blocked from asking for a demo.
  const result = validateDemoRequest(
    valid({ crm: "", opportunityVolume: "", heardFrom: "" })
  );
  assert.equal(result.ok, true);
});

test("malformed emails are rejected", () => {
  for (const bad of ["not-an-email", "maya@", "@cloudmint.com", "maya@nodot", ""]) {
    const result = validateDemoRequest(valid({ workEmail: bad }));
    assert.equal(result.ok, false, `"${bad}" should not pass`);
  }
});

test("a work-email field asks for a work email", () => {
  const result = validateDemoRequest(valid({ workEmail: "maya@gmail.com" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.workEmail ?? "", /work email/i);
});

test("an unfamiliar corporate domain is not blocked", () => {
  // The free-mailbox list catches a reflex, it does not police domains.
  assert.equal(validateDemoRequest(valid({ workEmail: "m@some-startup.io" })).ok, true);
});

test("email is normalised so duplicates and rate limits line up", () => {
  const result = validateDemoRequest(valid({ workEmail: "  Maya@CloudMint.COM " }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.values.workEmail, "maya@cloudmint.com");
});

test("whitespace is trimmed rather than stored", () => {
  const result = validateDemoRequest(valid({ fullName: "  Maya Chen  ", company: " Cloudmint " }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.values.fullName, "Maya Chen");
    assert.equal(result.values.company, "Cloudmint");
  }
});

test("a whitespace-only required field does not count as filled", () => {
  const result = validateDemoRequest(valid({ company: "     " }));
  assert.equal(result.ok, false);
});

test("select values are constrained to the offered options", () => {
  // Guards against a tampered payload writing arbitrary strings into the row.
  assert.equal(validateDemoRequest(valid({ teamSize: "10000" })).ok, false);
  assert.equal(validateDemoRequest(valid({ crm: "notion" })).ok, false);
  assert.equal(validateDemoRequest(valid({ opportunityVolume: "loads" })).ok, false);
});

test("every offered option actually validates", () => {
  for (const o of TEAM_SIZES) {
    assert.equal(validateDemoRequest(valid({ teamSize: o.value })).ok, true, o.value);
  }
  for (const o of CRM_OPTIONS) {
    assert.equal(validateDemoRequest(valid({ crm: o.value })).ok, true, o.value);
  }
  for (const o of OPPORTUNITY_VOLUMES) {
    assert.equal(validateDemoRequest(valid({ opportunityVolume: o.value })).ok, true, o.value);
  }
});

test("a filled honeypot fails validation", () => {
  // No real person can reach the field, so anything in it is a bot.
  const result = validateDemoRequest(valid({ website: "http://spam.example" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.website);
});

test("oversized input is refused rather than truncated", () => {
  assert.equal(validateDemoRequest(valid({ goal: "x".repeat(4001) })).ok, false);
  assert.equal(validateDemoRequest(valid({ fullName: "x".repeat(121) })).ok, false);
});

test("a one-word goal is refused, a sentence is enough", () => {
  assert.equal(validateDemoRequest(valid({ goal: "help" })).ok, false);
  assert.equal(validateDemoRequest(valid({ goal: "Fewer stalled deals." })).ok, true);
});

test("only one message per field, so the form is not a wall of complaints", () => {
  const result = validateDemoRequest(valid({ workEmail: "" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(typeof result.errors.workEmail, "string");
});

test("labelFor turns stored values back into readable text", () => {
  assert.equal(labelFor(TEAM_SIZES, "6_20"), "6-20");
  assert.equal(labelFor(CRM_OPTIONS, "hubspot"), "HubSpot");
  // Absent optional fields read as absent, never as a blank line in the email.
  assert.equal(labelFor(CRM_OPTIONS, null), "Not provided");
  assert.equal(labelFor(CRM_OPTIONS, ""), "Not provided");
  // An unknown stored value is shown as-is rather than hidden.
  assert.equal(labelFor(CRM_OPTIONS, "legacy_value"), "legacy_value");
});

test("garbage payloads are rejected without throwing", () => {
  for (const bad of [null, undefined, "string", 42, []]) {
    assert.doesNotThrow(() => validateDemoRequest(bad));
    assert.equal(validateDemoRequest(bad).ok, false);
  }
});
