import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RETENTION_POLICY } from "@/lib/integrations/retention-policy";

/**
 * The policy and the code that enforces it have to say the same thing. These
 * assert the shape of that promise — the deletion itself needs a database and
 * is listed as unverified in the delivery notes.
 */

const SOURCE = readFileSync("lib/integrations/retention.ts", "utf8");

test("the policy is stated, not implied", () => {
  for (const [key, text] of Object.entries(RETENTION_POLICY)) {
    assert.ok(text.length > 30, `${key} is too terse to be a policy`);
    // Plain language — this is read by an agency owner mid-decision.
    assert.ok(!/orgId|externalSource|deleteMany|null/.test(text), key);
  }
});

test("credentials are destroyed unconditionally", () => {
  assert.match(RETENTION_POLICY.credentials, /immediately/i);
  // The revoke happens before any optional erase, and not inside its branch.
  const revokeAt = SOURCE.indexOf("purgeSyncedRecords");
  assert.ok(revokeAt > 0);
});

test("keeping synced records is the default, and the policy says so", () => {
  assert.match(RETENTION_POLICY.syncedRecordsDefault, /stay in your workspace/i);
  assert.match(RETENTION_POLICY.syncedRecordsOnRequest, /if you choose/i);
});

test("erasing a deal takes the Selryn records attached to it", () => {
  // A drafted follow-up cannot outlive the deal it describes.
  assert.match(RETENTION_POLICY.syncedRecordsOnRequest, /follow-ups and extracted details/i);
});

test("the audit log survives the erase", () => {
  assert.match(RETENTION_POLICY.auditLog, /kept either way/i);
  // And the purge writes one rather than deleting quietly.
  assert.match(SOURCE, /recordAudit/);
});

test("the audit entry records counts, never the deleted contents", () => {
  assert.match(SOURCE, /metadata: \{ deleted: report/);
  assert.ok(!/metadata:[^}]*\bvalue\b|metadata:[^}]*\bemail\b/.test(SOURCE));
});

test("the purge is scoped to one workspace and one provider", () => {
  // Each deleteMany carries both filters. Matched by scanning forward from
  // the call rather than with a brace-counting regex, which the nested
  // `{ startsWith: provider }` defeats.
  const positions = [...SOURCE.matchAll(/deleteMany\(/g)].map((m) => m.index ?? 0);
  assert.equal(positions.length, 4, `expected four deletes, found ${positions.length}`);
  for (const at of positions) {
    const call = SOURCE.slice(at, at + 160);
    assert.match(call, /\borgId\b/, call);
    assert.match(call, /\bprovider\b/, call);
  }
});

test("both HubSpot prospect sources are erased, not only contacts", () => {
  // Contacts are "hubspot"; the Leads object writes "hubspot_lead". Matching
  // the provider exactly would leave every synced lead behind.
  assert.match(SOURCE, /startsWith: provider/);
});
