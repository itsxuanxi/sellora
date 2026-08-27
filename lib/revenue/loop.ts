import "server-only";
import { db } from "@/lib/db";
import type { Action, Recommendation, Response } from "@prisma/client";

/**
 * The closed loop, as a write path.
 *
 *   BuyingSignal → Recommendation → Action → Response → Outcome
 *
 * Every function here writes exactly one hop and links it to the previous
 * one. That is the whole point: the chain has to be recorded as it happens,
 * because none of it can be reconstructed afterwards. Whether a rep edited a
 * draft before sending it is knowable at the moment they click approve and
 * never again.
 *
 * Two rules this module holds to, both of which cost more code than ignoring
 * them would:
 *
 *   1. Nothing customer-facing executes without an explicit human approval
 *      step. `proposeAction` and `executeAction` are separate calls, and the
 *      status vocabulary makes an unapproved execution unrepresentable.
 *   2. A missing reaction is recorded, not left blank. `no_response` is a
 *      real Response row written by sweepNonResponses(), because "we asked
 *      and they ignored us" is a result and silence in a table is not.
 *
 * Nothing here trains anything. It records honestly; lib/revenue/learning.ts
 * reads it back and is equally careful about what that data can support.
 */

// How long after an action we wait before calling it a non-response. Chosen
// per channel: an unanswered email at 72h is meaningful, an unanswered
// LinkedIn message at 72h is normal.
const RESPONSE_WINDOW_HOURS: Record<string, number> = {
  email: 72,
  call: 48,
  linkedin: 120,
  meeting: 24,
  crm: 168,
  manual: 96,
};

export type ExecutionStatus =
  | "PROPOSED"
  | "APPROVED"
  | "EXECUTING"
  | "EXECUTED"
  | "FAILED"
  | "REJECTED"
  | "UNDONE";

export type ResponseType =
  | "replied"
  | "meeting_booked"
  | "proposal_viewed"
  | "stakeholder_added"
  | "no_response"
  | "unsubscribed"
  | "opportunity_advanced"
  | "opportunity_regressed";

/** Which reactions are good news, which are bad. Used for rate reporting;
 *  deliberately explicit rather than inferred from the name. */
export const RESPONSE_SENTIMENT: Record<ResponseType, "positive" | "neutral" | "negative"> = {
  replied: "positive",
  meeting_booked: "positive",
  proposal_viewed: "positive",
  stakeholder_added: "positive",
  opportunity_advanced: "positive",
  no_response: "negative",
  unsubscribed: "negative",
  opportunity_regressed: "negative",
};

export const RESPONSE_LABELS: Record<ResponseType, string> = {
  replied: "Replied",
  meeting_booked: "Meeting booked",
  proposal_viewed: "Proposal viewed",
  stakeholder_added: "New stakeholder joined",
  no_response: "No response",
  unsubscribed: "Unsubscribed",
  opportunity_advanced: "Deal advanced",
  opportunity_regressed: "Deal moved backwards",
};

/** A reaction that counts as the action having worked. */
export const POSITIVE_RESPONSES: ResponseType[] = [
  "replied",
  "meeting_booked",
  "proposal_viewed",
  "stakeholder_added",
  "opportunity_advanced",
];

// ── Action ────────────────────────────────────────────────────────────────

export interface ProposeActionInput {
  orgId: string;
  opportunityId: string;
  recommendationId?: string | null;
  contactId?: string | null;
  actionType: string;
  channel?: string;
  summary: string;
  content?: string | null;
}

/**
 * Stage 3a: a customer-facing move is put in front of a human.
 *
 * Creates the row in PROPOSED — never executed. Callers that want the whole
 * chain in one step (a rep clicking "Mark as done" on something they already
 * did offline) should use `recordCompletedAction`, which is explicit about
 * the fact that approval and execution happened outside the product.
 */
export async function proposeAction(input: ProposeActionInput): Promise<Action> {
  return db.action.create({
    data: {
      orgId: input.orgId,
      opportunityId: input.opportunityId,
      recommendationId: input.recommendationId ?? null,
      contactId: input.contactId ?? null,
      actionType: input.actionType,
      channel: input.channel ?? "manual",
      summary: input.summary,
      content: input.content ?? null,
      executionStatus: "PROPOSED",
      proposedAt: new Date(),
    },
  });
}

/**
 * Stage 3b: a human approves. `editedContent` being present is what sets
 * `humanEdited` — the single most useful quality signal Sellora gets, because
 * heavy editing means the draft was wrong in a way no rating scale captures.
 */
export async function approveAction(
  orgId: string,
  actionId: string,
  opts: { approvedBy?: string | null; editedContent?: string | null } = {}
): Promise<Action> {
  const action = await db.action.findFirst({ where: { id: actionId, orgId } });
  if (!action) throw new Error("Action not found.");
  if (action.executionStatus !== "PROPOSED") {
    throw new Error(`Cannot approve an action that is ${action.executionStatus}.`);
  }

  const edited =
    opts.editedContent != null && opts.editedContent.trim() !== (action.content ?? "").trim();

  return db.action.update({
    where: { id: actionId },
    data: {
      executionStatus: "APPROVED",
      approvedAt: new Date(),
      approvedBy: opts.approvedBy ?? null,
      content: opts.editedContent ?? action.content,
      humanEdited: edited,
    },
  });
}

export async function rejectAction(
  orgId: string,
  actionId: string,
  reason?: string | null
): Promise<Action> {
  const action = await db.action.findFirst({ where: { id: actionId, orgId } });
  if (!action) throw new Error("Action not found.");
  return db.action.update({
    where: { id: actionId },
    data: { executionStatus: "REJECTED", errorMessage: reason ?? null },
  });
}

/**
 * Stage 3c: the move actually goes out.
 *
 * `perform` is the side effect (send the email, write to the CRM). It runs
 * between EXECUTING and EXECUTED so a crash mid-send leaves a row that says
 * EXECUTING rather than a lie in either direction — §6 forbids reporting a
 * send that did not happen, and this is where that is enforced.
 */
export async function executeAction(
  orgId: string,
  actionId: string,
  perform?: () => Promise<void>
): Promise<Action> {
  const action = await db.action.findFirst({ where: { id: actionId, orgId } });
  if (!action) throw new Error("Action not found.");
  if (action.executionStatus !== "APPROVED") {
    throw new Error("Actions must be approved by a human before they execute.");
  }

  await db.action.update({
    where: { id: actionId },
    data: { executionStatus: "EXECUTING" },
  });

  try {
    if (perform) await perform();
  } catch (err) {
    return db.action.update({
      where: { id: actionId },
      data: {
        executionStatus: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
  }

  const executed = await db.action.update({
    where: { id: actionId },
    data: { executionStatus: "EXECUTED", executedAt: new Date(), errorMessage: null },
  });

  // The deal has now been touched. Keeping this current is what makes the
  // silence-based leak rules trustworthy.
  await db.opportunity.update({
    where: { id: action.opportunityId },
    data: {
      lastInteractionAt: new Date(),
      lastInteractionKind: action.channel === "email" ? "email_sent" : action.channel,
    },
  });

  return executed;
}

/**
 * Records something the rep already did outside Sellora. Approval and
 * execution are stamped together because they genuinely happened together,
 * off-platform — pretending there was a separate approval step would put a
 * fiction in the audit log.
 */
export async function recordCompletedAction(
  input: ProposeActionInput & { approvedBy?: string | null }
): Promise<Action> {
  const now = new Date();
  const action = await db.action.create({
    data: {
      orgId: input.orgId,
      opportunityId: input.opportunityId,
      recommendationId: input.recommendationId ?? null,
      contactId: input.contactId ?? null,
      actionType: input.actionType,
      channel: input.channel ?? "manual",
      summary: input.summary,
      content: input.content ?? null,
      executionStatus: "EXECUTED",
      proposedAt: now,
      approvedAt: now,
      executedAt: now,
      approvedBy: input.approvedBy ?? null,
    },
  });

  await db.opportunity.update({
    where: { id: input.opportunityId },
    data: { lastInteractionAt: now, lastInteractionKind: input.channel ?? "manual" },
  });

  return action;
}

/** Reverses an action. The row is kept and marked, never deleted — an undo
 *  that erases its own evidence is not an audit log. */
export async function undoAction(orgId: string, actionId: string): Promise<Action> {
  const action = await db.action.findFirst({ where: { id: actionId, orgId } });
  if (!action) throw new Error("Action not found.");
  if (action.executionStatus === "EXECUTED" && action.channel === "email") {
    // Be honest about the limit: a sent email cannot be recalled. The row is
    // marked so the timeline shows the correction, but nothing claims the
    // message was retrieved.
    throw new Error("A sent email can't be unsent. Log a correction instead.");
  }
  return db.action.update({
    where: { id: actionId },
    data: { executionStatus: "UNDONE", undoneAt: new Date() },
  });
}

// ── Response ──────────────────────────────────────────────────────────────

export interface RecordResponseInput {
  orgId: string;
  opportunityId: string;
  actionId?: string | null;
  recommendationId?: string | null;
  contactId?: string | null;
  signalId?: string | null;
  responseType: ResponseType;
  detail?: string | null;
  observedAt?: Date;
}

/**
 * Stage 4: what the customer did about it.
 *
 * `hoursToRespond` is computed from the action's execution time rather than
 * taken from the caller, so speed-to-reply is measured the same way
 * everywhere and cannot be back-dated by whoever writes the row.
 */
export async function recordResponse(input: RecordResponseInput): Promise<Response> {
  const observedAt = input.observedAt ?? new Date();

  let hoursToRespond: number | null = null;
  let recommendationId = input.recommendationId ?? null;

  if (input.actionId) {
    const action = await db.action.findFirst({
      where: { id: input.actionId, orgId: input.orgId },
      select: { executedAt: true, recommendationId: true },
    });
    if (action?.executedAt && input.responseType !== "no_response") {
      hoursToRespond = Math.max(
        0,
        Math.round((observedAt.getTime() - action.executedAt.getTime()) / 3_600_000)
      );
    }
    recommendationId ??= action?.recommendationId ?? null;
  }

  return db.response.create({
    data: {
      orgId: input.orgId,
      opportunityId: input.opportunityId,
      actionId: input.actionId ?? null,
      recommendationId,
      contactId: input.contactId ?? null,
      signalId: input.signalId ?? null,
      responseType: input.responseType,
      detail: input.detail ?? null,
      sentiment: RESPONSE_SENTIMENT[input.responseType] ?? "neutral",
      hoursToRespond,
      observedAt,
    },
  });
}

/**
 * Writes `no_response` for executed actions whose reply window has closed
 * with nothing recorded against them.
 *
 * This exists because the alternative — treating absence as missing data —
 * silently inflates every effectiveness rate in the product. An action nobody
 * answered has to be counted as an action nobody answered.
 */
export async function sweepNonResponses(orgId: string): Promise<number> {
  const candidates = await db.action.findMany({
    where: {
      orgId,
      executionStatus: "EXECUTED",
      executedAt: { not: null },
      responses: { none: {} },
    },
    select: {
      id: true,
      opportunityId: true,
      contactId: true,
      recommendationId: true,
      channel: true,
      executedAt: true,
    },
  });

  const now = Date.now();
  let written = 0;

  for (const action of candidates) {
    const windowHours = RESPONSE_WINDOW_HOURS[action.channel] ?? 96;
    const elapsedHours = (now - action.executedAt!.getTime()) / 3_600_000;
    if (elapsedHours < windowHours) continue;

    await recordResponse({
      orgId,
      opportunityId: action.opportunityId,
      actionId: action.id,
      recommendationId: action.recommendationId,
      contactId: action.contactId,
      responseType: "no_response",
      detail: `No reaction within ${windowHours}h of a ${action.channel} action.`,
      observedAt: new Date(action.executedAt!.getTime() + windowHours * 3_600_000),
    });
    written += 1;
  }

  return written;
}

// ── Outcome ───────────────────────────────────────────────────────────────

export interface RecordOutcomeInput {
  orgId: string;
  opportunityId: string;
  accountId: string;
  stage: "reply" | "meeting_booked" | "qualified" | "won" | "lost" | "stalled";
  detail?: string | null;
  revenueAmount?: number | null;
  lossReason?: string | null;
  occurredAt?: Date;
}

/**
 * Stage 5: the commercial result.
 *
 * `salesCycleDays` is measured from the opportunity's creation, and
 * `revenueAmount` defaults to the deal value on a win only because that is
 * the best available figure — it is stored on the Outcome rather than read
 * from Opportunity.dealValue at report time so that later edits to the
 * estimate cannot retroactively rewrite what was booked.
 */
export async function recordOutcome(input: RecordOutcomeInput) {
  const occurredAt = input.occurredAt ?? new Date();
  const opp = await db.opportunity.findFirst({
    where: { id: input.opportunityId, orgId: input.orgId },
    select: { createdAt: true, dealValue: true },
  });

  const salesCycleDays = opp
    ? Math.max(
        0,
        Math.round((occurredAt.getTime() - opp.createdAt.getTime()) / 86_400_000)
      )
    : null;

  const revenueAmount =
    input.stage === "won" ? (input.revenueAmount ?? opp?.dealValue ?? null) : null;

  return db.outcome.create({
    data: {
      orgId: input.orgId,
      accountId: input.accountId,
      opportunityId: input.opportunityId,
      stage: input.stage,
      detail: input.detail ?? null,
      revenueAmount,
      salesCycleDays: ["won", "lost", "stalled"].includes(input.stage)
        ? salesCycleDays
        : null,
      lossReason: input.stage === "lost" ? (input.lossReason ?? null) : null,
      occurredAt,
    },
  });
}

// ── Recommendation lifecycle ──────────────────────────────────────────────

/**
 * Closes out advice that has passed its own expiry.
 *
 * "Follow up within 24 hours of the demo" is not merely late after a week —
 * it is wrong, and leaving it OPEN would both mislead the rep and poison the
 * acceptance-rate statistics with tasks nobody could reasonably have done.
 */
export async function expireStaleRecommendations(orgId: string): Promise<number> {
  const { count } = await db.recommendation.updateMany({
    where: { orgId, status: "OPEN", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return count;
}

/** The full chain for one recommendation, for the "explain" panel. */
export async function loadRecommendationChain(orgId: string, recommendationId: string) {
  const rec = await db.recommendation.findFirst({
    where: { id: recommendationId, orgId },
    include: {
      actions: { orderBy: { proposedAt: "asc" } },
      responses: { orderBy: { observedAt: "asc" } },
      opportunity: { select: { id: true, name: true, stage: true, accountId: true } },
    },
  });
  if (!rec) return null;

  const signalIds = parseSupportingSignals(rec);
  const signals = signalIds.length
    ? await db.buyingSignal.findMany({
        where: { id: { in: signalIds }, orgId },
        orderBy: { occurredAt: "desc" },
      })
    : [];

  return { recommendation: rec, signals };
}

/** Supporting signal ids, tolerating the column being absent or malformed —
 *  rows written before the field existed must not break the detail page. */
export function parseSupportingSignals(rec: Pick<Recommendation, "supportingSignals">): string[] {
  if (!rec.supportingSignals) return [];
  try {
    const parsed: unknown = JSON.parse(rec.supportingSignals);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
