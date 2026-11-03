import type { HubspotObject, MapResult } from "@/lib/integrations/hubspot/mappers";

/**
 * HubSpot's dedicated Leads object.
 *
 * Not the same thing as a contact whose lifecycle stage happens to say
 * "lead", and the difference is the reason this file exists. A Leads record
 * is a first-class pipeline object with its own stage and owner; a lifecycle
 * stage is a label on a contact that somebody — or a form — set once. Merging
 * them produces a "leads" count that means nothing, and an agency that acts
 * on it is working a list half of which was never qualified by anyone.
 *
 * So the two are stored side by side and kept apart by `externalSource`:
 *
 *   hubspot        a Contact
 *   hubspot_lead   a record from the Leads object
 *
 * The unique key is (orgId, externalSource, externalId), so a lead and a
 * contact carrying the same HubSpot id cannot collide, and `LEAD_PROVENANCE`
 * is what the UI reads to say which kind of record it is looking at.
 *
 * Availability: the Leads object is not present in every portal — it depends
 * on the hub and tier — so the scope is requested as optional and a 403 is
 * treated as "this portal does not have it", never as a failure. See
 * `syncLeads` in sync.ts.
 */

export const LEADS_SCOPE = "crm.objects.leads.read";

/** How a prospect row records where it came from. */
export const LEAD_PROVENANCE = {
  /** HubSpot's dedicated Leads object. */
  leadsObject: "hubspot_lead",
  /** A Contact, which may or may not carry a lead lifecycle stage. */
  contact: "hubspot",
} as const;

/**
 * Properties requested from the Leads object.
 *
 * These names are the part of this file least verifiable from here: the Leads
 * object is newer than the rest of the CRM API and its property set varies by
 * portal. Everything is read defensively — a missing property yields null and
 * never an exception — so a portal that names things differently syncs less
 * rather than failing. Verifying them against a live portal is on the
 * checklist in the delivery notes.
 */
export const LEAD_PROPERTIES = [
  "hs_lead_name",
  "hs_lead_label",
  "hs_lead_type",
  "hs_lead_source",
  "hs_pipeline_stage",
  "hubspot_owner_id",
  "hs_createdate",
  "hs_lastmodifieddate",
] as const;

export interface MappedLead {
  externalId: string;
  name: string;
  /** The Leads pipeline stage, verbatim. Never mapped onto deal stages. */
  stageLabel: string | null;
  leadType: string | null;
  leadSource: string | null;
  ownerId: string | null;
  lastModifiedAt: Date | null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function date(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapLead(obj: HubspotObject): MapResult<MappedLead> {
  const p = obj.properties ?? {};

  // A lead with no name at all cannot be shown to anyone usefully, and
  // inventing one would put a placeholder into a sales list.
  const name = text(p.hs_lead_name) ?? text(p.hs_lead_label);
  if (!name) {
    return { ok: false, reason: `Lead ${obj.id} has no name` };
  }

  return {
    ok: true,
    value: {
      externalId: obj.id,
      name,
      stageLabel: text(p.hs_pipeline_stage),
      leadType: text(p.hs_lead_type),
      leadSource: text(p.hs_lead_source),
      ownerId: text(p.hubspot_owner_id),
      lastModifiedAt: date(p.hs_lastmodifieddate),
    },
  };
}

/**
 * Lifecycle stages that mark a contact as a lead.
 *
 * Used to report the distinction, never to merge the two. A contact matching
 * this is still a contact — it is counted separately and labelled differently
 * from a record that came out of the Leads object.
 */
const LEAD_LIFECYCLE_STAGES = new Set([
  "lead",
  "marketingqualifiedlead",
  "salesqualifiedlead",
]);

export function isLifecycleLead(lifecycleStage: string | null | undefined): boolean {
  if (!lifecycleStage) return false;
  return LEAD_LIFECYCLE_STAGES.has(lifecycleStage.trim().toLowerCase());
}

/** What the UI says about where a record came from. */
export function provenanceLabel(externalSource: string | null): string {
  switch (externalSource) {
    case LEAD_PROVENANCE.leadsObject:
      return "HubSpot lead";
    case LEAD_PROVENANCE.contact:
      return "HubSpot contact";
    default:
      return "Imported";
  }
}
