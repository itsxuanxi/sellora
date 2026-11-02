import "server-only";
import { db } from "@/lib/db";
import { classifyInbound, type InboundCandidate } from "@/lib/followup/reply-match";

/**
 * Matching what came back to the follow-up that went out.
 *
 * Runs after a sync, because the evidence lives in the CRM: a reply is an
 * inbound email HubSpot recorded, a meeting is a meeting it recorded. None of
 * it is inferred from the fact that Selryn sent something — that inference is
 * the one this product must never make, because it would report progress on a
 * deal that is actually silent.
 *
 * Idempotent: it only ever fills in a timestamp that is still null, so running
 * it twice changes nothing the second time.
 */

export interface ReconcileReport {
  checked: number;
  repliesMatched: number;
  meetingsMatched: number;
  stageChangesMatched: number;
}

/** Event types that count as a meeting actually having taken place. */
const MEETING_EVENTS = new Set(["meeting.held", "meeting.scheduled"]);

export async function reconcileFollowUps(orgId: string): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    checked: 0,
    repliesMatched: 0,
    meetingsMatched: 0,
    stageChangesMatched: 0,
  };

  // Only sent follow-ups that have not already been resolved.
  const pending = await db.dealFollowUp.findMany({
    where: { orgId, status: "SENT", sentAt: { not: null }, repliedAt: null },
    select: { id: true, opportunityId: true, sentAt: true },
  });
  if (pending.length === 0) return report;
  report.checked = pending.length;

  const events = await db.revenueEvent.findMany({
    where: {
      orgId,
      opportunityId: { in: pending.map((p) => p.opportunityId) },
      occurredAt: { gte: new Date(Math.min(...pending.map((p) => p.sentAt!.getTime()))) },
    },
    orderBy: { occurredAt: "asc" },
    select: {
      id: true,
      eventType: true,
      actorType: true,
      occurredAt: true,
      opportunityId: true,
      normalizedProperties: true,
    },
  });

  const byOpportunity = new Map<string, typeof events>();
  for (const e of events) {
    if (!e.opportunityId) continue;
    const list = byOpportunity.get(e.opportunityId) ?? [];
    list.push(e);
    byOpportunity.set(e.opportunityId, list);
  }

  for (const followUp of pending) {
    const candidates = byOpportunity.get(followUp.opportunityId) ?? [];

    const reply = candidates.find((e) => {
      const candidate: InboundCandidate = {
        actorType: e.actorType,
        eventType: e.eventType,
        occurredAt: e.occurredAt,
        subject: subjectOf(e.normalizedProperties),
        opportunityId: e.opportunityId,
      };
      return classifyInbound(candidate, {
        sentAt: followUp.sentAt,
        opportunityId: followUp.opportunityId,
      }).isReply;
    });

    const meeting = candidates.find(
      (e) => MEETING_EVENTS.has(e.eventType) && e.occurredAt >= followUp.sentAt!
    );
    const stageChange = candidates.find(
      (e) => e.eventType === "deal.stage_changed" && e.occurredAt >= followUp.sentAt!
    );

    if (!reply && !meeting && !stageChange) continue;

    await db.dealFollowUp.updateMany({
      // The null guards keep this idempotent and stop a later sync from
      // overwriting the first reply with a second one.
      where: { id: followUp.id, orgId, repliedAt: null },
      data: {
        ...(reply ? { repliedAt: reply.occurredAt, replyEventId: reply.id } : {}),
      },
    });

    if (reply) report.repliesMatched++;
    if (meeting) report.meetingsMatched++;
    if (stageChange) report.stageChangesMatched++;
  }

  return report;
}

function subjectOf(normalized: string | null): string | null {
  if (!normalized) return null;
  try {
    const p = JSON.parse(normalized) as Record<string, unknown>;
    const subject = p.subject ?? p.title;
    return typeof subject === "string" ? subject : null;
  } catch {
    return null;
  }
}
