import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEADS_SCOPE,
  LEAD_PROVENANCE,
  isLifecycleLead,
  mapLead,
  provenanceLabel,
} from "@/lib/integrations/hubspot/leads";
import { HUBSPOT_SCOPES } from "@/lib/integrations/hubspot/oauth";

function obj(properties: Record<string, string | null>) {
  return { id: "501", properties, createdAt: "", updatedAt: "" } as never;
}

// ── The distinction the whole module exists for ──────────────────────────

test("a Leads record and a Contact are stored under different sources", () => {
  // Merging them produces a "leads" count that means nothing, and an agency
  // acting on it works a list half of which nobody qualified.
  assert.notEqual(LEAD_PROVENANCE.leadsObject, LEAD_PROVENANCE.contact);
});

test("a lead lifecycle stage on a contact is recognised, not conflated", () => {
  for (const stage of ["lead", "marketingqualifiedlead", "salesqualifiedlead"]) {
    assert.equal(isLifecycleLead(stage), true, stage);
  }
  // Case and padding vary by portal and by import.
  assert.equal(isLifecycleLead("  Lead  "), true);
  assert.equal(isLifecycleLead("SalesQualifiedLead"), true);
});

test("other lifecycle stages are not leads", () => {
  for (const stage of ["customer", "subscriber", "opportunity", "evangelist", "other"]) {
    assert.equal(isLifecycleLead(stage), false, stage);
  }
  assert.equal(isLifecycleLead(null), false);
  assert.equal(isLifecycleLead(undefined), false);
  assert.equal(isLifecycleLead(""), false);
});

test("the UI can tell the two kinds apart", () => {
  assert.equal(provenanceLabel(LEAD_PROVENANCE.leadsObject), "HubSpot lead");
  assert.equal(provenanceLabel(LEAD_PROVENANCE.contact), "HubSpot contact");
  assert.equal(provenanceLabel("csv_import"), "Imported");
  assert.equal(provenanceLabel(null), "Imported");
});

// ── Mapping is defensive, because portals differ ─────────────────────────

test("a well-formed lead maps", () => {
  const result = mapLead(
    obj({
      hs_lead_name: "Northwind — paid social",
      hs_pipeline_stage: "Attempting contact",
      hs_lead_type: "NEW_BUSINESS",
      hs_lead_source: "Referral",
      hubspot_owner_id: "99",
      hs_lastmodifieddate: "2026-10-01T09:00:00Z",
    })
  );
  assert.ok(result.ok);
  assert.equal(result.value.name, "Northwind — paid social");
  assert.equal(result.value.stageLabel, "Attempting contact");
  assert.equal(result.value.lastModifiedAt?.toISOString(), "2026-10-01T09:00:00.000Z");
});

test("a lead with no name is skipped rather than given a placeholder", () => {
  // A placeholder would put "Unknown" into a list of people to contact.
  const result = mapLead(obj({ hs_lead_type: "NEW_BUSINESS" }));
  assert.equal(result.ok, false);
});

test("the label stands in when the name property is absent", () => {
  // Property naming varies across portals; falling back beats dropping a row.
  const result = mapLead(obj({ hs_lead_label: "Acme — SEO retainer" }));
  assert.ok(result.ok);
  assert.equal(result.value.name, "Acme — SEO retainer");
});

test("missing and malformed properties yield null, never an exception", () => {
  const result = mapLead(
    obj({
      hs_lead_name: "Fine",
      hs_pipeline_stage: null,
      hs_lead_type: "   ",
      hs_lastmodifieddate: "not-a-date",
    })
  );
  assert.ok(result.ok);
  assert.equal(result.value.stageLabel, null);
  assert.equal(result.value.leadType, null);
  // A date that cannot be parsed is absent, not epoch zero.
  assert.equal(result.value.lastModifiedAt, null);
});

test("an object with no properties at all does not throw", () => {
  const result = mapLead({ id: "1" } as never);
  assert.equal(result.ok, false);
});

// ── Availability ─────────────────────────────────────────────────────────

test("the leads scope is optional, never required to connect", () => {
  // Not every portal has the Leads object. Requiring the scope would make
  // consent fail for customers who simply do not have that feature.
  assert.ok(
    !HUBSPOT_SCOPES.includes(LEADS_SCOPE),
    "leads must not be in the required scope set"
  );
});

test("the Leads stage is never mapped onto a deal stage", async () => {
  // Leads pipelines are configured per portal and have nothing to do with
  // deal stages; coercing one into the other invents a position in a pipeline.
  const source = await import("node:fs").then((fs) =>
    fs.readFileSync("lib/integrations/hubspot/leads.ts", "utf8")
  );
  assert.ok(!/STAGE_WIN_BASELINE|OpportunityStage|mapStage/.test(source));
});
