import "server-only";
import { db } from "@/lib/db";
import { fetchDealPipelines, fetchObjectPage } from "@/lib/integrations/hubspot/client";
import {
  HUBSPOT_SOURCE,
  REQUESTED_PROPERTIES,
  dealEventType,
  mapCompany,
  mapContact,
  mapDeal,
  type HubspotObject,
} from "@/lib/integrations/hubspot/mappers";
import { ingestEvents, type IngestEvent } from "@/lib/events/ingest";
import { upsertSignal } from "@/lib/intent/signals";
import { HubspotApiError } from "@/lib/integrations/hubspot/client";
import {
  ENGAGEMENT_SPECS,
  mapEngagement,
  type EngagementObjectType,
  type InteractionKind,
} from "@/lib/integrations/hubspot/engagements";
import type { JobProgress } from "@/lib/integrations/sync-runner";
import { expectedRevenue } from "@/lib/revenue/money";
import { STAGE_WIN_BASELINE, type OpportunityStage } from "@/lib/revenue/config";
import {
  LEAD_PROPERTIES,
  LEAD_PROVENANCE,
  mapLead,
} from "@/lib/integrations/hubspot/leads";

/**
 * The handlers that turn one page of HubSpot objects into Selryn records.
 *
 * One page per call, returning the cursor. The runner persists that cursor
 * between calls, so a backfill of forty thousand deals survives a timeout,
 * a redeploy or a rate limit and resumes exactly where it stopped rather than
 * starting over and never finishing.
 *
 * Everything is upserted on (orgId, externalSource, externalId). Re-running a
 * sync is therefore a no-op rather than a duplicate, which matters because
 * overlapping incremental windows and webhook-triggered runs guarantee the
 * same record arrives more than once.
 *
 * A record that fails to map is counted and skipped, never guessed at. One bad
 * deal must not fail the page it arrived in - the other ninety-nine are fine,
 * and HubSpot will not resend them.
 */

const PAGE_SIZE = 100;

/** Fields Selryn owns and a sync must never overwrite. */
type Ignored = never;

export async function syncCompanies(
  orgId: string,
  connectionId: string,
  cursor: string | null
): Promise<JobProgress> {
  const page = await fetchObjectPage<HubspotObject>(orgId, "companies", {
    after: cursor ?? undefined,
    limit: PAGE_SIZE,
    properties: [...REQUESTED_PROPERTIES.companies],
  });

  let processed = 0;
  let failed = 0;
  const events: IngestEvent[] = [];

  for (const obj of page.results) {
    const mapped = mapCompany(obj);
    if (!mapped.ok) {
      failed++;
      console.warn(`[hubspot:companies] skipped - ${mapped.reason}`);
      continue;
    }
    const c = mapped.value;

    const account = await db.account.upsert({
      where: {
        orgId_externalSource_externalId: {
          orgId,
          externalSource: HUBSPOT_SOURCE,
          externalId: c.externalId,
        },
      },
      // Scores, research and ICP fit are Selryn's own work and are deliberately
      // absent here: a sync refreshes what HubSpot owns and leaves the rest.
      update: {
        name: c.name,
        domain: c.domain,
        industry: c.industry,
        companySize: c.companySize,
        region: c.region,
      },
      create: {
        orgId,
        externalSource: HUBSPOT_SOURCE,
        externalId: c.externalId,
        name: c.name,
        domain: c.domain,
        industry: c.industry,
        companySize: c.companySize,
        region: c.region,
        source: "imported",
      },
      select: { id: true },
    });

    events.push({
      orgId,
      connectionId,
      accountId: account.id,
      source: "hubspot",
      sourceEventId: c.externalId,
      eventType: "company.synced",
      occurredAt: new Date(obj.updatedAt ?? Date.now()),
      actorType: "system",
      normalizedProperties: { name: c.name, domain: c.domain, industry: c.industry },
    });
    processed++;
  }

  await ingestEvents(events);
  return { processed, failed, cursor: page.paging?.next?.after ?? null };
}

export async function syncContacts(
  orgId: string,
  connectionId: string,
  cursor: string | null
): Promise<JobProgress> {
  const page = await fetchObjectPage<HubspotObject>(orgId, "contacts", {
    after: cursor ?? undefined,
    limit: PAGE_SIZE,
    properties: [...REQUESTED_PROPERTIES.contacts],
  });

  let processed = 0;
  let failed = 0;
  const events: IngestEvent[] = [];

  for (const obj of page.results) {
    const mapped = mapContact(obj);
    if (!mapped.ok) {
      failed++;
      continue;
    }
    const c = mapped.value;

    // Link to the account only if that company has already been synced. A
    // missing link is recoverable on the next run; a wrong one is not, so no
    // account is invented from the free-text company name.
    const account = c.externalCompanyId
      ? await db.account.findUnique({
          where: {
            orgId_externalSource_externalId: {
              orgId,
              externalSource: HUBSPOT_SOURCE,
              externalId: c.externalCompanyId,
            },
          },
          select: { id: true },
        })
      : null;

    const contact = await db.prospect.upsert({
      where: {
        orgId_externalSource_externalId: {
          orgId,
          externalSource: HUBSPOT_SOURCE,
          externalId: c.externalId,
        },
      },
      update: {
        name: c.name,
        email: c.email,
        position: c.position,
        ...(account ? { accountId: account.id } : {}),
      },
      create: {
        orgId,
        externalSource: HUBSPOT_SOURCE,
        externalId: c.externalId,
        name: c.name,
        email: c.email,
        company: c.company ?? "Unknown",
        position: c.position,
        accountId: account?.id ?? null,
      },
      select: { id: true },
    });

    events.push({
      orgId,
      connectionId,
      contactId: contact.id,
      accountId: account?.id ?? null,
      source: "hubspot",
      sourceEventId: c.externalId,
      eventType: "contact.synced",
      occurredAt: new Date(obj.updatedAt ?? Date.now()),
      actorType: "system",
      normalizedProperties: { email: c.email, position: c.position },
    });
    processed++;
  }

  await ingestEvents(events);
  return { processed, failed, cursor: page.paging?.next?.after ?? null };
}

export async function syncDeals(
  orgId: string,
  connectionId: string,
  cursor: string | null
): Promise<JobProgress> {
  // Stage ids are meaningless without their labels, and the labels are
  // per-portal. Fetched once per page rather than per deal.
  const stageLabels = await dealStageLabels(orgId);

  const page = await fetchObjectPage<HubspotObject>(orgId, "deals", {
    after: cursor ?? undefined,
    limit: PAGE_SIZE,
    properties: [...REQUESTED_PROPERTIES.deals],
  });

  let processed = 0;
  let failed = 0;
  const events: IngestEvent[] = [];

  for (const obj of page.results) {
    const mapped = mapDeal(obj, stageLabels);
    if (!mapped.ok) {
      failed++;
      continue;
    }
    const d = mapped.value;

    // A deal Selryn cannot place in its own funnel is skipped rather than
    // filed under NEW: a "Contract Sent" deal silently becoming "New" would
    // reset its win probability and bury it at the bottom of every ranking.
    if (!d.stage) {
      failed++;
      console.warn(`[hubspot:deals] unmapped stage "${d.rawStage}" on deal ${d.externalId}`);
      continue;
    }
    // Money is the unit this product reasons in. A deal with no amount cannot
    // be ranked by expected revenue, so it is reported rather than zeroed.
    if (d.dealValue === null) {
      failed++;
      console.warn(`[hubspot:deals] no amount on deal ${d.externalId}`);
      continue;
    }

    const account = await findDealAccount(orgId, obj);
    const stage = d.stage as OpportunityStage;
    const winProbability = STAGE_WIN_BASELINE[stage];

    const opportunity = await db.opportunity.upsert({
      where: {
        orgId_externalSource_externalId: {
          orgId,
          externalSource: HUBSPOT_SOURCE,
          externalId: d.externalId,
        },
      },
      // Scores, recommendations and whyNow are Selryn's and survive a sync.
      // Stage, value and close date belong to the CRM and are refreshed.
      update: {
        name: d.name,
        dealValue: d.dealValue,
        stage,
        closedAt: stage === "WON" || stage === "LOST" ? (d.closeDate ?? new Date()) : null,
        ...(account ? { accountId: account.id } : {}),
      },
      create: {
        orgId,
        externalSource: HUBSPOT_SOURCE,
        externalId: d.externalId,
        // An unmatched deal still needs somewhere to live, so a placeholder
        // account is created and later corrected when its company syncs.
        accountId: account?.id ?? (await placeholderAccount(orgId, d.name)),
        name: d.name,
        dealValue: d.dealValue,
        stage,
        source: "imported",
        dealValueBasis: "user_entered",
        winProbability,
        closedAt: stage === "WON" || stage === "LOST" ? (d.closeDate ?? new Date()) : null,
      },
      select: { id: true, accountId: true },
    });

    events.push({
      orgId,
      connectionId,
      opportunityId: opportunity.id,
      accountId: opportunity.accountId,
      source: "hubspot",
      sourceEventId: d.externalId,
      eventType: dealEventType(d),
      occurredAt: d.lastModifiedAt ?? new Date(obj.updatedAt ?? Date.now()),
      // A backfill is Selryn reading history, not the buyer acting. Marking
      // these "buyer" would make every new connection look like a burst of
      // engagement on day one.
      actorType: "system",
      normalizedProperties: {
        stage: d.rawStage,
        mappedStage: stage,
        amount: d.dealValue,
        expectedRevenue: expectedRevenue(d.dealValue, winProbability),
        pipeline: d.pipeline,
      },
    });
    processed++;
  }

  await ingestEvents(events);
  return { processed, failed, cursor: page.paging?.next?.after ?? null };
}

/** SignalSource key for anything derived from a connected HubSpot portal. */
export const HUBSPOT_SIGNAL_SOURCE = "hubspot_crm";

/**
 * Engagement history — the half of the data the priority engine actually
 * reasons with.
 *
 * One job per engagement type rather than one job for all four, so each gets
 * its own cursor and a portal with a million emails and six meetings does not
 * starve the meetings. Types are independent in every way that matters: a
 * missing scope skips one and leaves the rest working.
 */
export async function syncEngagements(
  orgId: string,
  connectionId: string,
  objectType: EngagementObjectType,
  cursor: string | null
): Promise<JobProgress> {
  const spec = ENGAGEMENT_SPECS[objectType];

  let page;
  try {
    page = await fetchObjectPage<HubspotObject>(orgId, objectType, {
      after: cursor ?? undefined,
      limit: PAGE_SIZE,
      properties: spec.properties,
      // Without these an engagement is an orphan: the deal it belongs to is
      // the entire reason to read it.
      associations: ["deals", "contacts"],
    });
  } catch (err) {
    // 403 means the optional scope was not granted — a configuration fact,
    // not a failure. Returning cleanly keeps the connection healthy and lets
    // the other three types sync; throwing would retry forever and eventually
    // dead-letter a job that can never succeed.
    if (err instanceof HubspotApiError && err.status === 403) {
      console.warn(
        `[hubspot:${objectType}] scope "${spec.scope}" not granted — skipping this type`
      );
      return { processed: 0, failed: 0, cursor: null };
    }
    throw err;
  }

  const events: IngestEvent[] = [];
  const newest = new Map<string, { at: Date; kind: InteractionKind }>();
  let processed = 0;
  let failed = 0;

  for (const obj of page.results) {
    const mapped = mapEngagement(objectType, obj);
    if (!mapped.ok) {
      failed++;
      continue;
    }
    const e = mapped.value;

    const opportunity = await resolveOpportunity(orgId, e.dealIds);
    const contact = await resolveContact(orgId, e.contactIds);
    const accountId = opportunity?.accountId ?? contact?.accountId ?? null;

    // Nothing to attach it to yet. Companies and deals sync first, so this is
    // usually an engagement on an object outside the synced set rather than
    // an ordering problem.
    if (!opportunity && !accountId) {
      failed++;
      continue;
    }

    events.push({
      orgId,
      connectionId,
      source: "hubspot",
      sourceEventId: e.externalId,
      eventType: e.eventType,
      occurredAt: e.occurredAt,
      actorType: e.actorType,
      accountId,
      contactId: contact?.id ?? null,
      opportunityId: opportunity?.id ?? null,
      normalizedProperties: {
        objectType,
        interactionKind: e.interactionKind,
        title: e.title,
      },
    });

    // Only where the engagement is itself the proof — see engagements.ts.
    if (e.signal && accountId) {
      await upsertSignal(orgId, accountId, {
        signalType: e.signal.type,
        title: e.signal.title,
        sourceKey: HUBSPOT_SIGNAL_SOURCE,
        occurredAt: e.occurredAt,
        evidence: e.title,
        contactId: contact?.id ?? null,
        opportunityId: opportunity?.id ?? null,
      });
    }

    if (opportunity) {
      const prev = newest.get(opportunity.id);
      if (!prev || e.occurredAt > prev.at) {
        newest.set(opportunity.id, { at: e.occurredAt, kind: e.interactionKind });
      }
    }
    processed++;
  }

  await ingestEvents(events);
  await advanceLastInteraction(newest);

  return { processed, failed, cursor: page.paging?.next?.after ?? null };
}

/**
 * Moves `lastInteractionAt` forward, never backward.
 *
 * Load-bearing: the four engagement types are four independent jobs running
 * in whatever order the queue drains them, and pages within a type arrive
 * oldest-first. A plain update would let the notes job overwrite a reply from
 * this morning with a note from March, and the deal would read as quiet when
 * the buyer is waiting on an answer.
 */
async function advanceLastInteraction(
  newest: Map<string, { at: Date; kind: InteractionKind }>
): Promise<void> {
  for (const [id, v] of newest) {
    await db.opportunity.updateMany({
      where: {
        id,
        OR: [{ lastInteractionAt: null }, { lastInteractionAt: { lt: v.at } }],
      },
      data: { lastInteractionAt: v.at, lastInteractionKind: v.kind },
    });
  }
}

/** First synced opportunity among a HubSpot engagement's deal associations. */
async function resolveOpportunity(orgId: string, dealIds: string[]) {
  for (const externalId of dealIds) {
    const opp = await db.opportunity.findUnique({
      where: {
        orgId_externalSource_externalId: {
          orgId,
          externalSource: HUBSPOT_SOURCE,
          externalId,
        },
      },
      select: { id: true, accountId: true },
    });
    if (opp) return opp;
  }
  return null;
}

/** First synced contact among a HubSpot engagement's contact associations. */
async function resolveContact(orgId: string, contactIds: string[]) {
  for (const externalId of contactIds) {
    const contact = await db.prospect.findUnique({
      where: {
        orgId_externalSource_externalId: {
          orgId,
          externalSource: HUBSPOT_SOURCE,
          externalId,
        },
      },
      select: { id: true, accountId: true },
    });
    if (contact) return contact;
  }
  return null;
}

/** Owners are small and unpaginated in practice; synced for attribution only. */
export async function syncOwners(orgId: string): Promise<JobProgress> {
  const page = await fetchObjectPage<HubspotObject>(orgId, "owners", { limit: PAGE_SIZE });
  return { processed: page.results.length, failed: 0, cursor: null };
}

/**
 * HubSpot's dedicated Leads object.
 *
 * Stored as prospects under a different `externalSource`, so a lead and a
 * contact can never overwrite one another and the UI can say which kind of
 * record it is showing. See lib/integrations/hubspot/leads.ts for why the
 * distinction matters.
 *
 * A 403 means the portal does not have the Leads object or did not grant the
 * optional scope. That is a normal configuration, not a failure: it returns
 * an empty page so the job completes and the rest of the sync is unaffected.
 */
export async function syncLeads(
  orgId: string,
  connectionId: string,
  cursor: string | null
): Promise<JobProgress> {
  let page;
  try {
    page = await fetchObjectPage<HubspotObject>(orgId, "leads", {
      after: cursor ?? undefined,
      limit: PAGE_SIZE,
      properties: [...LEAD_PROPERTIES],
    });
  } catch (err) {
    if (err instanceof HubspotApiError && (err.status === 403 || err.status === 404)) {
      console.warn(`[hubspot:leads] portal has no Leads object or scope — skipping`);
      return { processed: 0, failed: 0, cursor: null };
    }
    throw err;
  }

  let processed = 0;
  let failed = 0;

  for (const obj of page.results) {
    const mapped = mapLead(obj);
    if (!mapped.ok) {
      console.warn(`[hubspot:leads] skipped — ${mapped.reason}`);
      failed++;
      continue;
    }
    const lead = mapped.value;

    await db.prospect.upsert({
      where: {
        orgId_externalSource_externalId: {
          orgId,
          externalSource: LEAD_PROVENANCE.leadsObject,
          externalId: lead.externalId,
        },
      },
      update: {
        name: lead.name,
        notes: lead.leadSource ? `Lead source: ${lead.leadSource}` : undefined,
      },
      create: {
        orgId,
        externalSource: LEAD_PROVENANCE.leadsObject,
        externalId: lead.externalId,
        name: lead.name,
        // The Leads object carries no email of its own; it associates to a
        // contact that does. Until that association is resolved the row is a
        // lead we can show but not write to, which is the honest state.
        email: "",
        company: lead.name,
        stage: "NEW_LEAD",
        notes: lead.leadSource ? `Lead source: ${lead.leadSource}` : null,
      },
    });
    processed++;
  }

  return { processed, failed, cursor: page.paging?.next?.after ?? null };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Stage id to the label the customer chose, across every deal pipeline. */
async function dealStageLabels(orgId: string): Promise<Record<string, string>> {
  try {
    const pipelines = await fetchDealPipelines(orgId);
    const labels: Record<string, string> = {};
    for (const p of pipelines.results) {
      for (const stage of p.stages) labels[stage.id] = stage.label;
    }
    return labels;
  } catch (err) {
    // Without labels every stage falls back to its raw id and will not map,
    // so the deals page reports failures rather than mis-filing them.
    console.warn("[hubspot] could not read deal pipelines:", err);
    return {};
  }
}

/** The account a deal is associated with, if that company is already synced. */
async function findDealAccount(orgId: string, obj: HubspotObject) {
  const assocId =
    (obj as { associations?: { companies?: { results?: { id: string }[] } } }).associations
      ?.companies?.results?.[0]?.id ?? null;
  if (!assocId) return null;

  return db.account.findUnique({
    where: {
      orgId_externalSource_externalId: {
        orgId,
        externalSource: HUBSPOT_SOURCE,
        externalId: assocId,
      },
    },
    select: { id: true },
  });
}

/**
 * A holding account for a deal whose company has not synced yet.
 *
 * Named after the deal and marked imported so it is identifiable later.
 * Dropping the deal instead would lose real pipeline; inventing a confident
 * account name would be worse.
 */
async function placeholderAccount(orgId: string, dealName: string): Promise<string> {
  const name = dealName.slice(0, 120);
  const existing = await db.account.findFirst({
    where: { orgId, name },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.account.create({
    data: { orgId, name, source: "imported", verified: false },
    select: { id: true },
  });
  return created.id;
}

/** Routes a job to its handler. Unknown object types fail loudly. */
export async function runHubspotJob(job: {
  orgId: string;
  connectionId: string;
  objectType: string;
  cursor: string | null;
}): Promise<JobProgress> {
  switch (job.objectType) {
    case "companies":
      return syncCompanies(job.orgId, job.connectionId, job.cursor);
    case "contacts":
      return syncContacts(job.orgId, job.connectionId, job.cursor);
    case "deals":
      return syncDeals(job.orgId, job.connectionId, job.cursor);
    case "owners":
      return syncOwners(job.orgId);
    case "leads":
      return syncLeads(job.orgId, job.connectionId, job.cursor);
    case "emails":
    case "meetings":
    case "calls":
    case "notes":
      return syncEngagements(
        job.orgId,
        job.connectionId,
        job.objectType as EngagementObjectType,
        job.cursor
      );
    default:
      throw new Error(`Unknown HubSpot object type "${job.objectType}"`);
  }
}

export type { Ignored };
