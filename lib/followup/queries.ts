import "server-only";
import { db } from "@/lib/db";
import { OPEN_STAGES, STAGE_LABELS, type OpportunityStage } from "@/lib/revenue/config";
import {
  DEFAULT_TIMING,
  evaluateFollowUp,
  isSuppressed,
  rankFollowUps,
  type DealFacts,
  type EvidenceKind,
  type EvidenceRef,
  type FollowUpItem,
  type FollowUpTiming,
} from "@/lib/followup/rules";

/**
 * Turning stored records into today's follow-up list.
 *
 * A thin adapter on purpose. Every judgement lives in `rules.ts`, which is
 * pure and tested; this file only loads rows, shapes them into `DealFacts`
 * and reports what the rules say. Pushing a decision down here would put it
 * somewhere no test can reach without a database.
 *
 * Every query filters on `orgId`. Workspaces share one Postgres, so a query
 * that reaches a deal by id alone is a cross-tenant read waiting to happen —
 * `lib/followup/__tests__/isolation.test.ts` asserts the filter is present in
 * every call in this file.
 */

/** Stages where an outbound email is fairly described as a quote. */
const QUOTING_STAGES = new Set(["PROPOSAL", "NEGOTIATION"]);

/** Provider event types, mapped to the evidence kinds the UI renders. */
const EVIDENCE_KIND: Record<string, EvidenceKind> = {
  "email.sent": "email_outbound",
  "email.replied": "email_inbound",
  "meeting.held": "meeting",
  "meeting.scheduled": "meeting",
  "call.placed": "call",
  "call.received": "call",
  "note.logged": "note",
};

interface EventRow {
  id: string;
  source: string;
  sourceEventId: string;
  eventType: string;
  occurredAt: Date;
  actorType: string;
  normalizedProperties: string | null;
  opportunityId: string | null;
}

/** The subject or title the provider recorded, never a generated one. */
function summarize(row: EventRow): string {
  if (row.normalizedProperties) {
    try {
      const p = JSON.parse(row.normalizedProperties) as Record<string, unknown>;
      for (const key of ["subject", "title", "name"]) {
        const value = p[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    } catch {
      // A malformed payload must not take the list down.
    }
  }
  return FALLBACK_SUMMARY[row.eventType] ?? "Activity";
}

const FALLBACK_SUMMARY: Record<string, string> = {
  "email.sent": "Email sent",
  "email.replied": "Reply received",
  "meeting.held": "Meeting held",
  "meeting.scheduled": "Meeting scheduled",
  "call.placed": "Call placed",
  "call.received": "Call received",
  "note.logged": "Note logged",
};

function toEvidence(row: EventRow): EvidenceRef | null {
  const kind = EVIDENCE_KIND[row.eventType];
  if (!kind) return null;
  return {
    eventId: row.id,
    source: row.source,
    sourceEventId: row.sourceEventId,
    kind,
    occurredAt: row.occurredAt,
    summary: summarize(row),
  };
}

export async function followUpTiming(orgId: string): Promise<FollowUpTiming> {
  const settings = await db.settings.findUnique({
    where: { orgId },
    select: { followUpQuoteDays: true, followUpQuietDays: true },
  });
  return {
    quietAfterQuoteDays: settings?.followUpQuoteDays ?? DEFAULT_TIMING.quietAfterQuoteDays,
    goneQuietDays: settings?.followUpQuietDays ?? DEFAULT_TIMING.goneQuietDays,
  };
}

export interface FollowUpListItem extends FollowUpItem {
  contact: { id: string; name: string; email: string } | null;
  /** An open draft for this deal, when one exists. */
  draftId: string | null;
}

/**
 * Today's follow-ups, ranked, with the handled ones removed.
 */
export async function getFollowUps(
  orgId: string,
  now: Date = new Date()
): Promise<FollowUpListItem[]> {
  const [opportunities, timing] = await Promise.all([
    db.opportunity.findMany({
      where: { orgId, stage: { in: [...OPEN_STAGES] } },
      select: {
        id: true,
        stage: true,
        dealValue: true,
        dealValueBasis: true,
        currency: true,
        nextStepDueAt: true,
        account: { select: { name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    }),
    followUpTiming(orgId),
  ]);
  if (opportunities.length === 0) return [];

  const ids = opportunities.map((o) => o.id);

  const [events, handled, drafts] = await Promise.all([
    db.revenueEvent.findMany({
      where: { orgId, opportunityId: { in: ids } },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        source: true,
        sourceEventId: true,
        eventType: true,
        occurredAt: true,
        actorType: true,
        normalizedProperties: true,
        opportunityId: true,
      },
    }),
    db.followUpAction.findMany({
      where: { orgId, opportunityId: { in: ids } },
      select: {
        opportunityId: true,
        rule: true,
        state: true,
        snoozedUntil: true,
        handledAgainst: true,
      },
    }),
    db.dealFollowUp.findMany({
      where: { orgId, opportunityId: { in: ids }, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      select: { id: true, opportunityId: true },
    }),
  ]);

  const byOpportunity = new Map<string, EventRow[]>();
  for (const e of events) {
    if (!e.opportunityId) continue;
    const list = byOpportunity.get(e.opportunityId) ?? [];
    list.push(e);
    byOpportunity.set(e.opportunityId, list);
  }

  const handledBy = new Map(handled.map((h) => [`${h.opportunityId}:${h.rule}`, h]));
  const draftBy = new Map<string, string>();
  for (const d of drafts) if (!draftBy.has(d.opportunityId)) draftBy.set(d.opportunityId, d.id);

  const items: FollowUpListItem[] = [];

  for (const opp of opportunities) {
    // Already ordered newest-first by the query.
    const rows = byOpportunity.get(opp.id) ?? [];
    const evidence = rows.map(toEvidence).filter((e): e is EvidenceRef => e !== null);

    const lastOutbound = evidence.find((e) => e.kind === "email_outbound") ?? null;
    const lastInbound = evidence.find((e) => e.kind === "email_inbound") ?? null;
    const lastActivity = evidence[0] ?? null;

    const facts: DealFacts = {
      opportunityId: opp.id,
      accountName: opp.account.name,
      // Only a figure a person put in the CRM is shown. An estimate would be
      // a number Selryn made up, which is what this layer exists to avoid.
      amount: opp.dealValueBasis === "user_entered" ? opp.dealValue : null,
      currency: opp.currency,
      stage: STAGE_LABELS[opp.stage as OpportunityStage] ?? opp.stage,
      lastOutbound,
      lastInbound,
      lastActivity,
      quoteSent: QUOTING_STAGES.has(opp.stage) ? lastOutbound : null,
      nextStepDueAt: opp.nextStepDueAt,
      nextStepEvidence: null,
    };

    const reason = evaluateFollowUp(facts, now, timing);
    if (!reason) continue;

    const newest = lastActivity?.occurredAt ?? null;
    if (isSuppressed(handledBy.get(`${opp.id}:${reason.rule}`) ?? null, newest, now)) {
      continue;
    }

    items.push({
      ...reason,
      opportunityId: opp.id,
      accountName: facts.accountName,
      amount: facts.amount,
      currency: facts.currency,
      stage: facts.stage,
      lastActivityAt: newest,
      contact: opp.primaryContact,
      draftId: draftBy.get(opp.id) ?? null,
    });
  }

  return rankFollowUps(items);
}

/** The records behind one reason, for the evidence panel. */
export async function getEvidence(orgId: string, eventIds: string[]) {
  if (eventIds.length === 0) return [];
  const rows = await db.revenueEvent.findMany({
    where: { orgId, id: { in: eventIds } },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      source: true,
      sourceEventId: true,
      eventType: true,
      occurredAt: true,
      actorType: true,
      normalizedProperties: true,
      opportunityId: true,
    },
  });
  return rows.map((r) => ({
    ...toEvidence(r),
    actorType: r.actorType,
    eventType: r.eventType,
  }));
}
