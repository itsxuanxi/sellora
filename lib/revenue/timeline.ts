import "server-only";
import { db } from "@/lib/db";
import { SIGNAL_LABELS, signalFamily, type SignalType } from "@/lib/intent/config";
import { ACTION_LABELS, type ActionType } from "@/lib/revenue/config";
import { RESPONSE_LABELS, type ResponseType } from "@/lib/revenue/loop";

/**
 * One deal's history as a single chronological stream.
 *
 *   Signal → Recommendation → Action → Response → Outcome
 *
 * The five tables are merged here rather than rendered as five stacked
 * panels, because the question a rep actually has is "what happened on this
 * deal, in order" — and the answer to "did that recommendation work?" is only
 * legible when the action and the customer's reaction sit next to it.
 *
 * Everything is read from stored rows. Nothing on this timeline is inferred:
 * if a link between an action and a response is not in the database, the
 * timeline shows them as separate events rather than guessing they are
 * related because the timestamps are close.
 */

export type TimelineKind =
  | "signal"
  | "recommendation"
  | "action"
  | "response"
  | "outcome";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: Date;
  /** Short type label, e.g. "Pricing page viewed" or "Send a follow-up". */
  label: string;
  /** The one-line description shown as the event body. */
  title: string;
  detail?: string | null;
  /** Verifiable specifics, when the row carries them. */
  evidence?: string | null;
  /** good / bad / neutral, for the rail colour. */
  tone: "positive" | "negative" | "neutral";
  /** Ids of events this one follows from, for the "because of" links. */
  causedBy?: string[];
  /** Extra per-kind fields the UI renders inline. */
  meta?: Record<string, string | number | null>;
}

/** Human-readable outcome stage names. */
const OUTCOME_LABELS: Record<string, string> = {
  reply: "Replied",
  meeting_booked: "Meeting booked",
  qualified: "Qualified",
  won: "Closed won",
  lost: "Closed lost",
  stalled: "Stalled",
};

const EXECUTION_TONE: Record<string, "positive" | "negative" | "neutral"> = {
  EXECUTED: "positive",
  FAILED: "negative",
  REJECTED: "negative",
  UNDONE: "negative",
  PROPOSED: "neutral",
  APPROVED: "neutral",
  EXECUTING: "neutral",
};

/**
 * Loads the full chain for one opportunity, newest first.
 *
 * Signals are matched to the deal directly *or* through the account, because
 * firmographic signals (a funding round) belong to the company and are still
 * part of this deal's story. `occurredAt` — when the real-world event
 * happened — orders signals, not `detectedAt`, so a backfilled import lands
 * in the right place in history rather than all at once at the top.
 */
export async function loadOpportunityTimeline(
  orgId: string,
  opportunityId: string
): Promise<TimelineEvent[]> {
  const opp = await db.opportunity.findFirst({
    where: { id: opportunityId, orgId },
    select: { id: true, accountId: true },
  });
  if (!opp) return [];

  const [signals, recommendations, actions, responses, outcomes] = await Promise.all([
    db.buyingSignal.findMany({
      where: {
        orgId,
        OR: [{ opportunityId }, { accountId: opp.accountId, opportunityId: null }],
      },
      orderBy: { occurredAt: "desc" },
      take: 60,
    }),
    db.recommendation.findMany({
      where: { orgId, opportunityId },
      orderBy: { createdAt: "desc" },
    }),
    db.action.findMany({
      where: { orgId, opportunityId },
      orderBy: { proposedAt: "desc" },
    }),
    db.response.findMany({
      where: { orgId, opportunityId },
      orderBy: { observedAt: "desc" },
    }),
    db.outcome.findMany({
      where: { orgId, opportunityId },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const s of signals) {
    events.push({
      id: `signal:${s.id}`,
      kind: "signal",
      at: s.occurredAt,
      label: SIGNAL_LABELS[s.signalType as SignalType] ?? s.signalType,
      title: s.title,
      detail: s.description,
      evidence: s.evidence,
      // Importance is magnitude; the sign of the underlying weight is what
      // says whether this is good news, so negative-weight signals (a
      // no-show, prolonged silence) read as setbacks rather than progress.
      tone:
        s.signalType === "meeting_no_show" || s.signalType === "no_activity"
          ? "negative"
          : signalFamily(s.signalType) === "behavioural"
            ? "positive"
            : "neutral",
      meta: {
        confidence: s.confidence,
        importance: s.importanceScore,
        source: s.sourceId ? "connected source" : "manual",
      },
    });
  }

  for (const r of recommendations) {
    events.push({
      id: `recommendation:${r.id}`,
      kind: "recommendation",
      at: r.createdAt,
      label: ACTION_LABELS[r.actionType as ActionType] ?? r.actionType,
      title: r.headline,
      detail: r.rationale,
      tone: "neutral",
      causedBy: parseIds(r.supportingSignals).map((id) => `signal:${id}`),
      meta: {
        urgency: r.urgency,
        priority: r.priorityScore,
        confidence: r.confidence,
        status: r.status,
        expectedValue: r.expectedValue,
      },
    });
  }

  for (const a of actions) {
    // The moment that matters is when it went out; before that, when a human
    // approved it; failing both, when it was proposed.
    const at = a.executedAt ?? a.approvedAt ?? a.proposedAt;
    events.push({
      id: `action:${a.id}`,
      kind: "action",
      at,
      label: ACTION_LABELS[a.actionType as ActionType] ?? a.actionType,
      title: a.summary,
      detail: a.errorMessage ?? a.content,
      tone: EXECUTION_TONE[a.executionStatus] ?? "neutral",
      causedBy: a.recommendationId ? [`recommendation:${a.recommendationId}`] : [],
      meta: {
        channel: a.channel,
        status: a.executionStatus,
        edited: a.humanEdited ? "yes" : "no",
        approvedBy: a.approvedBy,
      },
    });
  }

  for (const r of responses) {
    events.push({
      id: `response:${r.id}`,
      kind: "response",
      at: r.observedAt,
      label: RESPONSE_LABELS[r.responseType as ResponseType] ?? r.responseType,
      title: RESPONSE_LABELS[r.responseType as ResponseType] ?? r.responseType,
      detail: r.detail,
      tone: r.sentiment === "positive" ? "positive" : r.sentiment === "negative" ? "negative" : "neutral",
      causedBy: r.actionId ? [`action:${r.actionId}`] : [],
      meta: { hoursToRespond: r.hoursToRespond },
    });
  }

  for (const o of outcomes) {
    events.push({
      id: `outcome:${o.id}`,
      kind: "outcome",
      at: o.occurredAt,
      label: OUTCOME_LABELS[o.stage] ?? o.stage,
      title: OUTCOME_LABELS[o.stage] ?? o.stage,
      detail: o.detail,
      tone: o.stage === "won" ? "positive" : o.stage === "lost" || o.stage === "stalled" ? "negative" : "neutral",
      meta: {
        revenue: o.revenueAmount,
        salesCycleDays: o.salesCycleDays,
        lossReason: o.lossReason,
      },
    });
  }

  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * Collapses the timeline into the loop's five stages, for the compact
 * "where is this deal in the loop" strip. A stage with no events is reported
 * as empty rather than skipped, because a deal with signals and advice but no
 * action is exactly the gap worth showing.
 */
export function summarizeLoop(events: TimelineEvent[]) {
  const stages: { kind: TimelineKind; label: string }[] = [
    { kind: "signal", label: "Signal" },
    { kind: "recommendation", label: "Recommendation" },
    { kind: "action", label: "Action" },
    { kind: "response", label: "Response" },
    { kind: "outcome", label: "Outcome" },
  ];

  return stages.map((stage) => {
    const matching = events.filter((e) => e.kind === stage.kind);
    return {
      ...stage,
      count: matching.length,
      latest: matching[0]?.at ?? null,
      complete: matching.length > 0,
    };
  });
}

function parseIds(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
