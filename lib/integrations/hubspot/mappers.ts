import {
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/lib/revenue/config";

/**
 * HubSpot's shapes to Selryn's, as pure functions.
 *
 * Deliberately free of database and network calls so the translation can be
 * tested directly against real HubSpot payloads. Mapping is where silent
 * corruption enters a product like this - a misread amount, a stage mapped to
 * the wrong bucket, a date parsed in the wrong timezone - and none of that is
 * catchable if the only way to exercise it is to run a live sync.
 *
 * Every function here refuses rather than guesses. A deal with no name, an
 * amount that will not parse, a stage nobody recognises: these return an
 * explicit failure the caller counts, instead of a plausible default that
 * quietly becomes wrong data in somebody's pipeline.
 */

export const HUBSPOT_SOURCE = "hubspot";

/** A HubSpot CRM object as the v3 API returns it. */
export interface HubspotObject {
  id: string;
  properties: Record<string, string | null | undefined>;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}

/** Either a mapped value, or the reason it could not be mapped. */
export type MapResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

/** The properties worth requesting per object type. */
export const REQUESTED_PROPERTIES = {
  companies: ["name", "domain", "industry", "numberofemployees", "country", "hs_lastmodifieddate"],
  contacts: ["firstname", "lastname", "email", "jobtitle", "company", "associatedcompanyid", "hs_lastmodifieddate"],
  deals: ["dealname", "amount", "dealstage", "closedate", "hubspot_owner_id", "pipeline", "hs_lastmodifieddate"],
  owners: [],
} as const;

// ── Value parsing ─────────────────────────────────────────────────────────

/**
 * Money, to whole currency units.
 *
 * HubSpot sends amounts as strings and an empty deal has `""`, not `"0"`.
 * Returning 0 for a blank amount would be a lie the whole product then reasons
 * about - expected revenue, ranking, "revenue at risk" all inherit it - so a
 * blank is null and the caller decides what to do about a deal with no value.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  // Tolerates "42000.00", "42,000", " 42000 ". Rejects "abc" and "".
  const cleaned = trimmed.replace(/,/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

/** HubSpot timestamps arrive as ISO strings or epoch milliseconds. */
export function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  // All digits: epoch milliseconds.
  if (/^\d+$/.test(trimmed)) {
    const d = new Date(Number(trimmed));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A HubSpot deal stage to one of Selryn's.
 *
 * HubSpot stage ids are per-pipeline and customer-defined, so there is no
 * fixed table to look them up in. Matching is on the *label* a customer chose,
 * which is what they actually see and name meaningfully.
 *
 * Anything unrecognised returns null rather than defaulting to NEW. A deal in
 * "Contract Sent" silently becoming "New" would reset its win probability and
 * put it at the bottom of every ranking - visibly wrong to the rep, and worse,
 * wrong in a direction that looks plausible.
 */
export function mapDealStage(rawLabel: string | null | undefined): OpportunityStage | null {
  if (!rawLabel) return null;
  const s = rawLabel.trim().toLowerCase();
  if (s === "") return null;

  // Closed states first: "closed won" contains "won" but also "closed".
  if (/\bclosed\s*won\b|\bwon\b/.test(s)) return "WON";
  if (/\bclosed\s*lost\b|\blost\b|\bdisqualif/.test(s)) return "LOST";

  if (/\bcontract|negotiat|final\b/.test(s)) return "NEGOTIATION";
  if (/\bproposal|quote|contract\s*sent|decision\s*maker\b/.test(s)) return "PROPOSAL";
  if (/\bdemo|meeting|presentation|scheduled\b/.test(s)) return "MEETING";
  if (/\bqualif|discovery|evaluat|appointment\b/.test(s)) return "QUALIFYING";
  if (/\bnew\b|\blead\b|\bprospect|\bappointment\b/.test(s)) return "NEW";

  return null;
}

export function isKnownStage(value: string): value is OpportunityStage {
  return (OPPORTUNITY_STAGES as readonly string[]).includes(value);
}

// ── Object mapping ────────────────────────────────────────────────────────

export interface MappedCompany {
  externalId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  companySize: string | null;
  region: string | null;
}

export function mapCompany(obj: HubspotObject): MapResult<MappedCompany> {
  const name = obj.properties.name?.trim();
  if (!name) {
    // A nameless account is unusable everywhere it would appear.
    return { ok: false, reason: `Company ${obj.id} has no name` };
  }

  return {
    ok: true,
    value: {
      externalId: obj.id,
      name,
      domain: obj.properties.domain?.trim().toLowerCase() || null,
      industry: obj.properties.industry?.trim() || null,
      companySize: bandEmployees(obj.properties.numberofemployees),
      region: obj.properties.country?.trim() || null,
    },
  };
}

/** Headcount to the bands the ICP scoring already uses. */
export function bandEmployees(raw: string | null | undefined): string | null {
  const n = parseAmount(raw);
  if (n === null) return null;
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  if (n <= 1000) return "201-1000";
  return "1000+";
}

export interface MappedContact {
  externalId: string;
  name: string;
  email: string;
  position: string | null;
  company: string | null;
  externalCompanyId: string | null;
}

export function mapContact(obj: HubspotObject): MapResult<MappedContact> {
  const email = obj.properties.email?.trim().toLowerCase();
  if (!email) {
    // Email is the join key for engagement, threads and identity resolution.
    // A contact without one cannot be connected to anything.
    return { ok: false, reason: `Contact ${obj.id} has no email` };
  }

  const name =
    [obj.properties.firstname, obj.properties.lastname]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(" ") ||
    // Falls back to the local part rather than "Unknown", which reads as a
    // real missing-data state instead of a placeholder pretending to be a name.
    email.split("@")[0];

  return {
    ok: true,
    value: {
      externalId: obj.id,
      name,
      email,
      position: obj.properties.jobtitle?.trim() || null,
      company: obj.properties.company?.trim() || null,
      externalCompanyId: obj.properties.associatedcompanyid?.trim() || null,
    },
  };
}

export interface MappedDeal {
  externalId: string;
  name: string;
  dealValue: number | null;
  stage: OpportunityStage | null;
  rawStage: string | null;
  closeDate: Date | null;
  ownerId: string | null;
  pipeline: string | null;
  lastModifiedAt: Date | null;
}

export function mapDeal(
  obj: HubspotObject,
  stageLabels: Record<string, string> = {}
): MapResult<MappedDeal> {
  const name = obj.properties.dealname?.trim();
  if (!name) return { ok: false, reason: `Deal ${obj.id} has no name` };

  const rawStageId = obj.properties.dealstage?.trim() || null;
  // Stage ids mean nothing on their own; the label the customer chose does.
  const stageLabel = rawStageId ? (stageLabels[rawStageId] ?? rawStageId) : null;

  return {
    ok: true,
    value: {
      externalId: obj.id,
      name,
      dealValue: parseAmount(obj.properties.amount),
      stage: mapDealStage(stageLabel),
      rawStage: stageLabel,
      closeDate: parseDate(obj.properties.closedate),
      ownerId: obj.properties.hubspot_owner_id?.trim() || null,
      pipeline: obj.properties.pipeline?.trim() || null,
      lastModifiedAt: parseDate(obj.properties.hs_lastmodifieddate),
    },
  };
}

/**
 * The event a synced deal contributes to the graph.
 *
 * `actorType` is "system" rather than "buyer": a backfill is Selryn reading
 * history, not the buyer doing something. Attributing imported records to the
 * buyer would make every new connection look like a burst of engagement on
 * day one and corrupt every intent score built on top of it.
 */
export function dealEventType(deal: MappedDeal): string {
  if (deal.stage === "WON") return "deal.won";
  if (deal.stage === "LOST") return "deal.lost";
  return "deal.synced";
}
