"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { OPPORTUNITY_STAGES, isOpenStage } from "@/lib/revenue/config";
import { rescoreAllOpportunities, rescoreOpportunity, syncOpportunitiesFromAccounts } from "@/lib/revenue/opportunities";
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
