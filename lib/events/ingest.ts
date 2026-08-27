import "server-only";
import { db } from "@/lib/db";
import { stableHash } from "@/lib/security/crypto";

/**
 * The single door into the Revenue Event Graph.
 *
 * Everything Sellora observes - a CRM stage change, a reply, a no-show, a
 * pricing-page visit - becomes a RevenueEvent through this module and no
 * other. One door means one place where idempotency, tenant scoping and
 * normalisation are guaranteed, instead of each integration reimplementing
 * them slightly differently.
 *
 * Events are immutable once written. Scores and recommendations are derived
 * and can be recomputed at will; the evidence underneath them must not move,
 * or a score can never be explained after the fact.
 */

export type EventSource =
  | "hubspot"
  | "gmail"
  | "google_calendar"
  | "website_sdk"
  | "manual"
  | "demo";

export type ActorType = "buyer" | "seller" | "system";

export interface IngestEvent {
  orgId: string;
  connectionId?: string | null;
  source: EventSource;
  /** The provider's own id for this thing, so a row can be traced back. */
  sourceEventId: string;
  eventType: string;
  occurredAt: Date;
  actorType: ActorType;
  accountId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  normalizedProperties?: Record<string, unknown>;
  rawPayloadRef?: string | null;
  /** 0-100. A CRM field change is certain; an inferred no-show is not. */
  confidence?: number;
  /**
   * Overrides the derived key. Pass one when the natural identity of an event
   * is not (source, id, type, time) - for example a daily rollup.
   */
  idempotencyKey?: string;
}

/**
 * The identity of an event.
 *
 * Includes the day rather than the exact instant: providers routinely
 * redeliver the same logical event with a timestamp that differs by
 * milliseconds, and a key built on the exact time would treat those as two
 * events. It includes orgId so a key can never collide across tenants even if
 * two customers' CRMs issue the same object id, which they will.
 */
export function eventIdempotencyKey(e: {
  orgId: string;
  source: string;
  sourceEventId: string;
  eventType: string;
  occurredAt: Date;
}): string {
  return stableHash(
    e.orgId,
    e.source,
    e.eventType,
    e.sourceEventId,
    e.occurredAt.toISOString().slice(0, 10)
  );
}

export interface IngestResult {
  created: number;
  duplicates: number;
}

/**
 * Writes one event, or does nothing if it already exists.
 *
 * `createMany` with `skipDuplicates` rather than a find-then-create: the
 * check-then-act version races with itself the moment two webhook deliveries
 * arrive together, and providers deliver in parallel by design. The unique
 * index does the work, at the only layer that can actually guarantee it.
 */
export async function ingestEvent(event: IngestEvent): Promise<IngestResult> {
  return ingestEvents([event]);
}

/** Batch ingest. Same guarantees, one round trip. */
export async function ingestEvents(events: IngestEvent[]): Promise<IngestResult> {
  if (events.length === 0) return { created: 0, duplicates: 0 };

  const rows = events.map((e) => ({
    orgId: e.orgId,
    connectionId: e.connectionId ?? null,
    accountId: e.accountId ?? null,
    contactId: e.contactId ?? null,
    opportunityId: e.opportunityId ?? null,
    source: e.source,
    sourceEventId: e.sourceEventId,
    eventType: e.eventType,
    occurredAt: e.occurredAt,
    actorType: e.actorType,
    normalizedProperties: e.normalizedProperties
      ? JSON.stringify(e.normalizedProperties)
      : null,
    rawPayloadRef: e.rawPayloadRef ?? null,
    confidence: e.confidence ?? 100,
    idempotencyKey: e.idempotencyKey ?? eventIdempotencyKey(e),
  }));

  // Deduplicate inside the batch too. A single HubSpot page can legitimately
  // contain the same logical event twice, and skipDuplicates only protects
  // against rows already committed.
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.idempotencyKey)) return false;
    seen.add(r.idempotencyKey);
    return true;
  });

  const { count } = await db.revenueEvent.createMany({
    data: unique,
    skipDuplicates: true,
  });

  return { created: count, duplicates: events.length - count };
}

/**
 * Attaches events to entities discovered later.
 *
 * Events routinely arrive before the deal they belong to exists - a reply
 * lands, and the opportunity is created in the CRM the next morning. Dropping
 * those would lose exactly the early signals that matter most, so they are
 * stored unattached and linked when identity resolution catches up.
 */
export async function linkOrphanEvents(opts: {
  orgId: string;
  contactId?: string;
  accountId?: string;
  opportunityId: string;
}): Promise<number> {
  if (!opts.contactId && !opts.accountId) return 0;

  const { count } = await db.revenueEvent.updateMany({
    where: {
      orgId: opts.orgId,
      opportunityId: null,
      OR: [
        ...(opts.contactId ? [{ contactId: opts.contactId }] : []),
        ...(opts.accountId ? [{ accountId: opts.accountId }] : []),
      ],
    },
    data: { opportunityId: opts.opportunityId },
  });
  return count;
}

/** The event history for one deal, newest first. Tenant-scoped. */
export async function eventsForOpportunity(
  orgId: string,
  opportunityId: string,
  limit = 200
) {
  return db.revenueEvent.findMany({
    where: { orgId, opportunityId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}

/**
 * Ingestion freshness, for the integration health panel.
 *
 * Reports the newest `occurredAt`, not the newest `receivedAt`: a backfill can
 * write thousands of rows in a minute and make a stale connection look
 * healthy. What matters is how recently something actually happened.
 */
export async function ingestionFreshness(orgId: string, source: EventSource) {
  const [newest, total] = await Promise.all([
    db.revenueEvent.findFirst({
      where: { orgId, source },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true, receivedAt: true },
    }),
    db.revenueEvent.count({ where: { orgId, source } }),
  ]);

  return {
    totalEvents: total,
    newestEventAt: newest?.occurredAt ?? null,
    lastReceivedAt: newest?.receivedAt ?? null,
  };
}
