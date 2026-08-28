"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { OPPORTUNITY_STAGES, isOpenStage } from "@/lib/revenue/config";
import { rescoreAllOpportunities, rescoreOpportunity, syncOpportunitiesFromAccounts } from "@/lib/revenue/opportunities";
import {
  approveAction,
  expireStaleRecommendations,
  recordCompletedAction,
  recordOutcome,
  recordResponse,
  rejectAction,
  sweepNonResponses,
  undoAction,
} from "@/lib/revenue/loop";
import {
  completeRecommendation,
  dismissRecommendation,
  ensureRecommendation,
  markOpportunityWon,
  snoozeRecommendation,
  syncRecommendations,
} from "@/lib/revenue/recommendations";

/** Every revenue screen reads the same derived data, so they all revalidate. */
function revalidateRevenue(opportunityId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  revalidatePath("/recover");
  revalidatePath("/signals");
  revalidatePath("/analytics");
  if (opportunityId) revalidatePath(`/opportunities/${opportunityId}`);
}

// ── Recommendations ───────────────────────────────────────────────────────

/**
 * Resolves the recommendation row to act on.
 *
 * The feed computes next actions live, so the first time a user acts on one
 * the ledger row may not exist yet. Rather than make them run a refresh
 * first, materialize it here from the opportunity's current next action.
 */
async function resolveRecommendation(
  orgId: string,
  ref: { recommendationId?: string | null; opportunityId?: string | null }
): Promise<string | null> {
  if (ref.recommendationId) return ref.recommendationId;
  if (ref.opportunityId) return ensureRecommendation(orgId, ref.opportunityId);
  return null;
}

export interface RecommendationRef {
  recommendationId?: string | null;
  opportunityId?: string | null;
}

export async function markRecommendationComplete(
  ref: RecommendationRef
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const id = await resolveRecommendation(session.orgId, ref);
    if (!id) return { ok: false, error: "There is no open action on this opportunity." };

    await completeRecommendation(session.orgId, id, session.id);
    revalidateRevenue(ref.opportunityId ?? undefined);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not mark that action complete.");
  }
}

export async function dismissRecommendationAction(
  ref: RecommendationRef,
  reason?: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const id = await resolveRecommendation(session.orgId, ref);
    if (!id) return { ok: false, error: "There is no open action on this opportunity." };

    await dismissRecommendation(session.orgId, id, reason);
    revalidateRevenue(ref.opportunityId ?? undefined);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not dismiss that recommendation.");
  }
}

export async function snoozeRecommendationAction(
  ref: RecommendationRef,
  days: number
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const id = await resolveRecommendation(session.orgId, ref);
    if (!id) return { ok: false, error: "There is no open action on this opportunity." };

    await snoozeRecommendation(session.orgId, id, days);
    revalidateRevenue(ref.opportunityId ?? undefined);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not snooze that recommendation.");
  }
}

// ── Opportunities ─────────────────────────────────────────────────────────

const dealSchema = z.object({
  opportunityId: z.string().min(1),
  dealValue: z.coerce.number().int().min(0).max(1_000_000_000),
});

/** Setting a real deal value flips the basis off "estimated" and rescores. */
export async function updateDealValue(
  input: z.infer<typeof dealSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = dealSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

    const owned = await db.opportunity.findFirst({
      where: { id: parsed.data.opportunityId, orgId: session.orgId },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "Opportunity not found." };

    await db.opportunity.update({
      where: { id: owned.id },
      data: { dealValue: parsed.data.dealValue, dealValueBasis: "user_entered" },
    });
    await rescoreOpportunity(session.orgId, owned.id);

    revalidateRevenue(owned.id);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not update the deal value.");
  }
}

const stageSchema = z.object({
  opportunityId: z.string().min(1),
  stage: z.enum(OPPORTUNITY_STAGES),
  lostReason: z.string().trim().max(500).optional(),
});

export async function updateOpportunityStage(
  input: z.infer<typeof stageSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = stageSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { opportunityId, stage, lostReason } = parsed.data;

    const owned = await db.opportunity.findFirst({
      where: { id: opportunityId, orgId: session.orgId },
      select: { id: true, accountId: true },
    });
    if (!owned) return { ok: false, error: "Opportunity not found." };

    // Winning goes through the attribution path so Impact stays truthful.
    if (stage === "WON") {
      await markOpportunityWon(session.orgId, owned.id);
      revalidateRevenue(owned.id);
      return { ok: true, data: undefined };
    }

    await db.opportunity.update({
      where: { id: owned.id },
      data: {
        stage,
        closedAt: isOpenStage(stage) ? null : new Date(),
        lostReason: stage === "LOST" ? (lostReason || null) : null,
      },
    });

    if (stage === "LOST") {
      await db.outcome.create({
        data: {
          orgId: session.orgId,
          accountId: owned.accountId,
          opportunityId: owned.id,
          stage: "lost",
          detail: lostReason || null,
        },
      });
    }

    await rescoreOpportunity(session.orgId, owned.id);
    revalidateRevenue(owned.id);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not update the stage.");
  }
}

const nextStepSchema = z.object({
  opportunityId: z.string().min(1),
  /** ISO date, or empty string to clear. */
  dueAt: z.string().trim().max(40),
});

export async function setNextStep(
  input: z.infer<typeof nextStepSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = nextStepSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

    const owned = await db.opportunity.findFirst({
      where: { id: parsed.data.opportunityId, orgId: session.orgId },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "Opportunity not found." };

    const due = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
    if (due && Number.isNaN(due.getTime()))
      return { ok: false, error: "That date could not be read." };

    await db.opportunity.update({
      where: { id: owned.id },
      data: { nextStepDueAt: due },
    });

    revalidateRevenue(owned.id);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not set the next step.");
  }
}

/** Logs a manual touch — the thing that actually stops a deal going cold. */
export async function logInteraction(
  opportunityId: string,
  kind: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const owned = await db.opportunity.findFirst({
      where: { id: opportunityId, orgId: session.orgId },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "Opportunity not found." };

    await db.opportunity.update({
      where: { id: owned.id },
      data: { lastInteractionAt: new Date(), lastInteractionKind: kind },
    });
    await rescoreOpportunity(session.orgId, owned.id);

    revalidateRevenue(owned.id);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not log that interaction.");
  }
}

// ── Workspace-level refresh ───────────────────────────────────────────────

/**
 * Backfills opportunities from existing accounts, rescores everything, and
 * regenerates the recommendation set. This is what the "Refresh intelligence"
 * button runs, and what a scheduled job would call in production.
 */
export async function refreshRevenueIntelligence(): Promise<
  ActionResult<{ created: number; scored: number }>
> {
  try {
    const session = await requireSession();
    const created = await syncOpportunitiesFromAccounts(session);
    const scored = await rescoreAllOpportunities(session.orgId);
    await syncRecommendations(session.orgId);

    revalidateRevenue();
    return { ok: true, data: { created, scored } };
  } catch (e) {
    return actionError(e, "Could not refresh revenue intelligence.");
  }
}

// ── The closed loop: action → response → outcome ──────────────────────────
//
// These are the write endpoints for lib/revenue/loop.ts. Every one of them
// requires an explicit human click: §6's rule is that nothing customer-facing
// leaves Selryn unreviewed, and the way that is guaranteed is that no code
// path executes an action except this one, called from a button.

const actionInput = z.object({
  opportunityId: z.string().min(1),
  recommendationId: z.string().min(1).nullable().optional(),
  contactId: z.string().min(1).nullable().optional(),
  actionType: z.string().min(1).max(64),
  channel: z.enum(["email", "call", "linkedin", "meeting", "crm", "manual"]),
  summary: z.string().min(1).max(300),
  content: z.string().max(20_000).nullable().optional(),
});

/**
 * Logs work the rep already did — the "Mark as done" path.
 *
 * Approval and execution are stamped together because they genuinely happened
 * together, off-platform. Recording a separate approval step would put a
 * fiction in the audit log.
 */
export async function logAction(
  input: z.input<typeof actionInput>
): Promise<ActionResult<{ actionId: string }>> {
  try {
    const session = await requireSession();
    const parsed = actionInput.parse(input);

    const opp = await db.opportunity.findFirst({
      where: { id: parsed.opportunityId, orgId: session.orgId },
      select: { id: true },
    });
    if (!opp) return { ok: false, error: "Opportunity not found." };

    const action = await recordCompletedAction({
      orgId: session.orgId,
      opportunityId: parsed.opportunityId,
      recommendationId: parsed.recommendationId ?? null,
      contactId: parsed.contactId ?? null,
      actionType: parsed.actionType,
      channel: parsed.channel,
      summary: parsed.summary,
      content: parsed.content ?? null,
      approvedBy: session.id,
    });

    revalidateRevenue(parsed.opportunityId);
    return { ok: true, data: { actionId: action.id } };
  } catch (err) {
    return actionError(err, "Could not log that action.");
  }
}

/**
 * Approves a proposed action, optionally with edits.
 *
 * `editedContent` is compared against the original inside approveAction, so
 * `humanEdited` reflects a real change rather than the mere presence of a
 * textarea in the form.
 */
export async function approveProposedAction(input: {
  actionId: string;
  editedContent?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const action = await approveAction(session.orgId, input.actionId, {
      approvedBy: session.id,
      editedContent: input.editedContent ?? null,
    });
    revalidateRevenue(action.opportunityId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not approve that action.");
  }
}

export async function rejectProposedAction(input: {
  actionId: string;
  reason?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const action = await rejectAction(session.orgId, input.actionId, input.reason ?? null);
    revalidateRevenue(action.opportunityId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not reject that action.");
  }
}

/**
 * Reverses an action. Fails loudly for a sent email rather than pretending —
 * §6 forbids claiming a send was retrieved when SMTP has no such concept.
 */
export async function undoLoggedAction(input: {
  actionId: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const action = await undoAction(session.orgId, input.actionId);
    revalidateRevenue(action.opportunityId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not undo that action.");
  }
}

const responseInput = z.object({
  opportunityId: z.string().min(1),
  actionId: z.string().min(1).nullable().optional(),
  contactId: z.string().min(1).nullable().optional(),
  responseType: z.enum([
    "replied",
    "meeting_booked",
    "proposal_viewed",
    "stakeholder_added",
    "no_response",
    "unsubscribed",
    "opportunity_advanced",
    "opportunity_regressed",
  ]),
  detail: z.string().max(2000).nullable().optional(),
});

/** Records how the customer reacted. */
export async function logResponse(
  input: z.input<typeof responseInput>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = responseInput.parse(input);

    const opp = await db.opportunity.findFirst({
      where: { id: parsed.opportunityId, orgId: session.orgId },
      select: { id: true },
    });
    if (!opp) return { ok: false, error: "Opportunity not found." };

    await recordResponse({
      orgId: session.orgId,
      opportunityId: parsed.opportunityId,
      actionId: parsed.actionId ?? null,
      contactId: parsed.contactId ?? null,
      responseType: parsed.responseType,
      detail: parsed.detail ?? null,
    });

    revalidateRevenue(parsed.opportunityId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not record that response.");
  }
}

const outcomeInput = z.object({
  opportunityId: z.string().min(1),
  stage: z.enum(["reply", "meeting_booked", "qualified", "won", "lost", "stalled"]),
  detail: z.string().max(2000).nullable().optional(),
  revenueAmount: z.number().int().min(0).nullable().optional(),
  lossReason: z
    .enum(["price", "timing", "competitor", "no_decision", "no_budget", "churn_risk", "other"])
    .nullable()
    .optional(),
});

/** Records the commercial result and closes the deal where the stage is terminal. */
export async function logOutcome(
  input: z.input<typeof outcomeInput>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = outcomeInput.parse(input);

    const opp = await db.opportunity.findFirst({
      where: { id: parsed.opportunityId, orgId: session.orgId },
      select: { id: true, accountId: true },
    });
    if (!opp) return { ok: false, error: "Opportunity not found." };

    await recordOutcome({
      orgId: session.orgId,
      opportunityId: parsed.opportunityId,
      accountId: opp.accountId,
      stage: parsed.stage,
      detail: parsed.detail ?? null,
      revenueAmount: parsed.revenueAmount ?? null,
      lossReason: parsed.lossReason ?? null,
    });

    // Terminal outcomes move the deal itself, so the pipeline and the ledger
    // never disagree about whether something is closed.
    if (parsed.stage === "won" || parsed.stage === "lost") {
      await db.opportunity.update({
        where: { id: parsed.opportunityId },
        data: {
          stage: parsed.stage === "won" ? "WON" : "LOST",
          closedAt: new Date(),
          winProbability: parsed.stage === "won" ? 100 : 0,
          lostReason: parsed.lossReason ?? null,
        },
      });
    }

    revalidateRevenue(parsed.opportunityId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not record that outcome.");
  }
}

/**
 * Housekeeping the loop needs to stay honest: expire advice that has gone
 * stale, and write no_response rows for actions whose reply window closed
 * with nothing recorded. Called from the refresh button alongside rescoring.
 */
export async function runLoopMaintenance(): Promise<
  ActionResult<{ expired: number; nonResponses: number }>
> {
  try {
    const session = await requireSession();
    const [expired, nonResponses] = await Promise.all([
      expireStaleRecommendations(session.orgId),
      sweepNonResponses(session.orgId),
    ]);
    revalidateRevenue();
    return { ok: true, data: { expired, nonResponses } };
  } catch (err) {
    return actionError(err, "Could not run loop maintenance.");
  }
}
