import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_APPLY_MIN_CONFIDENCE,
  METHOD_CONFIDENCE,
  emailDomain,
  isCorporateDomain,
  normalizeEmail,
} from "@/lib/identity/resolve";

test("emails normalise to a comparable form", () => {
  assert.equal(normalizeEmail("  Maya.Chen@Cloudmint.COM "), "maya.chen@cloudmint.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail("no@tld"), null);
  assert.equal(normalizeEmail(""), null);
});

test("domains are extracted from valid addresses only", () => {
  assert.equal(emailDomain("maya@cloudmint.com"), "cloudmint.com");
  assert.equal(emailDomain("MAYA@Cloudmint.com"), "cloudmint.com");
  assert.equal(emailDomain("garbage"), null);
});

test("free mailbox domains never identify a company", () => {
  // The single most destructive mistake available here: matching on gmail.com
  // collapses every consumer address in a workspace onto one account.
  for (const d of ["gmail.com", "outlook.com", "qq.com", "163.com", "proton.me"]) {
    assert.equal(isCorporateDomain(d), false, `${d} must not identify a company`);
  }
});

test("corporate domains do identify a company", () => {
  for (const d of ["cloudmint.com", "brightcart.io", "acme.co.uk"]) {
    assert.equal(isCorporateDomain(d), true, `${d} should be usable`);
  }
});

test("degenerate domains are rejected", () => {
  assert.equal(isCorporateDomain(null), false);
  assert.equal(isCorporateDomain(""), false);
  assert.equal(isCorporateDomain("com"), false);
  assert.equal(isCorporateDomain("localhost"), false);
});

test("a domain match sits below the auto-apply line", () => {
  // A domain match is right for a company with one open deal and wrong the
  // moment there are two - exactly when being wrong costs the most. It must
  // be a suggestion a human confirms, never applied silently.
  assert.ok(
    METHOD_CONFIDENCE.domain_match < AUTO_APPLY_MIN_CONFIDENCE,
    "domain matches must not auto-apply"
  );
});

test("definitional matches sit above the auto-apply line", () => {
  for (const method of ["exact_crm_id", "exact_email", "manual_override"] as const) {
    assert.ok(
      METHOD_CONFIDENCE[method] >= AUTO_APPLY_MIN_CONFIDENCE,
      `${method} should auto-apply`
    );
  }
});

test("confidence is ordered by how much each method deserves trust", () => {
  const { manual_override, exact_crm_id, exact_email, attendee_match, thread_participant, domain_match } =
    METHOD_CONFIDENCE;

  assert.equal(manual_override, 100);
  assert.equal(exact_crm_id, 100);
  assert.ok(exact_email > attendee_match);
  assert.ok(attendee_match > thread_participant);
  assert.ok(thread_participant > domain_match);
});

test("no method is scored outside 0-100", () => {
  for (const [method, value] of Object.entries(METHOD_CONFIDENCE)) {
    assert.ok(value >= 0 && value <= 100, `${method} is out of range`);
  }
});
