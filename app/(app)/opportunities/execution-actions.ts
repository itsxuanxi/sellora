"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { requirePermission } from "@/lib/security/rbac";
import { loadEnrichedOpportunities } from "@/lib/revenue/queries";
import {
  ALWAYS_AVAILABLE,
  approveAndExecute,
  draftFor,
  rejectAction,
} from "@/lib/revenue/execution";
import { ensureRecommendation } from "@/lib/revenue/recommendations";
import { rescoreOpportunity } from "@/lib/revenue/opportunities";

/**
 * Draft → approve → execute, as server actions.
 *
 * Every one of these re-derives the opportunity from the session's org rather
 * than trusting an id from the client, so an action id from another workspace
 * resolves to nothing instead of to someone else's deal.
 */

function revalidateRevenue(opportunityId: string) {
  for (const path of ["/dashboard", "/opportunities", "/recover", "/analytics"]) {
    revalidatePath(path);
  }
  revalidatePath(`/opportunities/${opportunityId}`);
}

/**
 * Prepares the recommended action for review.
 *
 * Idempotent: a PROPOSED action for this opportunity is returned as-is rather
 * than replaced, so double-clicking "Prepare" cannot bury the edits someone
 * has already made in a second draft.
 */
export async function prepareAction(
  opportunityId: string,
  actionType?: string
): Promise<ActionResult<string>> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "action:approve");

    const existing = await db.action.findFirst({
      where: { orgId: session.orgId, opportunityId, executionStatus: "PROPOSED" },
      select: { id: true, actionType: true },
    });
    // Switching action type replaces the untouched proposal rather than
    // stacking a second one; picking the same type again is a no-op.
    if (existing) {
      if (!actionType || existing.actionType === actionType) {
        return { ok: true, data: existing.id };
      }
      await db.action.delete({ where: { id: existing.id } });
    }

    const [opp] = await loadEnrichedOpportunities(session.orgId).then((all) =>
      all.filter((o) => o.id === opportunityId)
    );
    if (!opp) return { ok: false, error: "That opportunity is not in this workspace." };

    const override = ALWAYS_AVAILABLE.find((t) => t === actionType);
    if (actionType && !override) {
      return { ok: false, error: "That is not an action Selryn can prepare." };
    }
    const draft = draftFor(opp, override);
    if (draft.blocked) return { ok: false, error: draft.blocked };

    // Attribution: link the draft to the recommendation it came from, so the
    // learning layer can tell prompted actions from unprompted ones.
    const recommendationId = await ensureRecommendation(session.orgId, opportunityId);

    const action = await db.action.create({
      data: {
        orgId: session.orgId,
        opportunityId,
        recommendationId,
        contactId: opp.contact?.id ?? null,
        actionType: draft.actionType,
        channel: draft.channel,
        summary: draft.summary,
        draftSubject: draft.subject,
        draftBody: draft.body,
        destination: draft.destination,
        executionStatus: "PROPOSED",
      },
      select: { id: true },
    });

    revalidateRevenue(opportunityId);
    return { ok: true, data: action.id };
  } catch (e) {
    return actionError(e, "Could not prepare that action.");
  }
}

const approveInput = z.object({
  actionId: z.string().min(1),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10_000),
});

export async function approveAction(
  input: z.input<typeof approveInput>
): Promise<ActionResult<{ simulated: boolean; humanEdited: boolean }>> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "action:execute");
    const parsed = approveInput.parse(input);

    const owned = await db.action.findFirst({
      where: { id: parsed.actionId, orgId: session.orgId },
      select: { id: true, opportunityId: true },
    });
    if (!owned) return { ok: false, error: "That action is not in this workspace." };

    const settings = await db.settings.findUnique({
      where: { orgId: session.orgId },
      select: { resendApiKey: true },
    });

    const result = await approveAndExecute({
      orgId: session.orgId,
      userId: session.id,
      actionId: parsed.actionId,
      subject: parsed.subject,
      body: parsed.body,
      orgIsSample: session.org.isSample,
      resendApiKey: settings?.resendApiKey,
      userName: session.name,
      orgName: session.org.name,
    });

    // Acting is evidence: the deal has been touched, so the silence clock and
    // everything derived from it should reflect that immediately.
    await rescoreOpportunity(session.orgId, owned.opportunityId);
    revalidateRevenue(owned.opportunityId);

    return {
      ok: true,
      data: { simulated: result.simulated, humanEdited: result.humanEdited },
    };
  } catch (e) {
    return actionError(e, "Could not send that action.");
  }
}

const rejectInput = z.object({
  actionId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export async function rejectActionAction(
  input: z.input<typeof rejectInput>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "action:approve");
    const parsed = rejectInput.parse(input);

    const owned = await db.action.findFirst({
      where: { id: parsed.actionId, orgId: session.orgId },
      select: { id: true, opportunityId: true },
    });
    if (!owned) return { ok: false, error: "That action is not in this workspace." };

    await rejectAction({
      orgId: session.orgId,
      userId: session.id,
      actionId: parsed.actionId,
      reason: parsed.reason,
    });

    revalidateRevenue(owned.opportunityId);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not reject that action.");
  }
}
