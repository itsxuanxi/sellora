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
import type { JobProgress } from "@/lib/integrations/sync-runner";
import { expectedRevenue } from "@/lib/revenue/money";
import { STAGE_WIN_BASELINE, type OpportunityStage } from "@/lib/revenue/config";

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

/** Owners are small and unpaginated in practice; synced for attribution only. */
export async function syncOwners(orgId: string): Promise<JobProgress> {
  const page = await fetchObjectPage<HubspotObject>(orgId, "owners", { limit: PAGE_SIZE });
  return { processed: page.results.length, failed: 0, cursor: null };
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
    default:
      throw new Error(`Unknown HubSpot object type "${job.objectType}"`);
  }
}

export type { Ignored };
