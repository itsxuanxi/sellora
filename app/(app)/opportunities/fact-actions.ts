"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { FACT_KINDS } from "@/lib/deal-facts/kinds";

/**
 * Correcting what Selryn thinks it knows.
 *
 * Three operations, and the distinction between them is the feature: confirm
 * says the suggestion was right, correct says it was wrong and here is the
 * truth, reject says there is nothing to record. A tool that only offered
 * "delete" would lose the difference between "no budget was discussed" and
 * "the budget is not what you guessed".
 *
 * Corrections keep what the extraction originally said. A fact that silently
 * becomes whatever was typed last cannot be audited, and the agency cannot
 * tell which figures came from a person and which from a model.
 */

const kindSchema = z.enum(FACT_KINDS);

async function assertOwned(orgId: string, opportunityId: string): Promise<boolean> {
  const found = await db.opportunity.findFirst({
    where: { orgId, id: opportunityId },
    select: { id: true },
  });
  return found !== null;
}

function revalidate(opportunityId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/opportunities/${opportunityId}`);
}

const confirmSchema = z.object({ factId: z.string().min(1) });

/** Marks a suggestion as right. */
export async function confirmFact(
  input: z.infer<typeof confirmSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const { factId } = confirmSchema.parse(input);

    const fact = await db.dealFact.findFirst({
      where: { orgId: session.orgId, id: factId },
      select: { id: true, opportunityId: true },
    });
    if (!fact) return { ok: false, error: "That detail no longer exists." };

    await db.dealFact.update({
      where: { id: fact.id },
      data: {
        status: "CONFIRMED",
        confirmedBy: session.id,
        confirmedAt: new Date(),
        rejectedAt: null,
        lastVerifiedAt: new Date(),
      },
    });

    revalidate(fact.opportunityId);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not confirm that detail.");
  }
}

const correctSchema = z.object({
  factId: z.string().min(1).optional(),
  opportunityId: z.string().min(1),
  kind: kindSchema,
  value: z.string().min(1).max(1_000),
});

/**
 * Replaces a value with what the agency says is true.
 *
 * Creates the row when there is none, so the same control works for "that is
 * wrong, it is actually X" and for filling in something never extracted.
 */
export async function correctFact(
  input: z.infer<typeof correctSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const data = correctSchema.parse(input);

    if (!(await assertOwned(session.orgId, data.opportunityId))) {
      return { ok: false, error: "That deal is not in this workspace." };
    }

    if (data.factId) {
      const existing = await db.dealFact.findFirst({
        where: { orgId: session.orgId, id: data.factId },
        select: { id: true, value: true, correctedFrom: true },
      });
      if (!existing) return { ok: false, error: "That detail no longer exists." };

      await db.dealFact.update({
        where: { id: existing.id },
        data: {
          value: data.value,
          status: "CONFIRMED",
          sourceKind: "user",
          // Keep the first machine answer, not the previous correction, so
          // the record shows what was extracted rather than a chain of edits.
          correctedFrom: existing.correctedFrom ?? existing.value,
          confirmedBy: session.id,
          confirmedAt: new Date(),
          rejectedAt: null,
          lastVerifiedAt: new Date(),
        },
      });
    } else {
      await db.dealFact.create({
        data: {
          orgId: session.orgId,
          opportunityId: data.opportunityId,
          kind: data.kind,
          value: data.value,
          status: "CONFIRMED",
          sourceKind: "user",
          confirmedBy: session.id,
          confirmedAt: new Date(),
          lastVerifiedAt: new Date(),
        },
      });
    }

    revalidate(data.opportunityId);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not save that correction.");
  }
}

const rejectSchema = z.object({ factId: z.string().min(1) });

/**
 * Says there is nothing to record here.
 *
 * The row is kept rather than deleted, so the same wrong guess is not
 * re-offered the next time extraction runs over the same emails.
 */
export async function rejectFact(
  input: z.infer<typeof rejectSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const { factId } = rejectSchema.parse(input);

    const fact = await db.dealFact.findFirst({
      where: { orgId: session.orgId, id: factId },
      select: { id: true, opportunityId: true },
    });
    if (!fact) return { ok: false, error: "That detail no longer exists." };

    await db.dealFact.update({
      where: { id: fact.id },
      data: { rejectedAt: new Date(), confirmedBy: session.id },
    });

    revalidate(fact.opportunityId);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not dismiss that detail.");
  }
}

const excludeSchema = z.object({
  opportunityId: z.string().min(1),
  reason: z.enum(["do_not_contact", "explicit_rejection", "user_excluded", "unsubscribed"]),
  note: z.string().max(500).optional(),
});

/** Takes a deal out of recovery for good. */
export async function excludeFromRecovery(
  input: z.infer<typeof excludeSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const data = excludeSchema.parse(input);

    if (!(await assertOwned(session.orgId, data.opportunityId))) {
      return { ok: false, error: "That deal is not in this workspace." };
    }

    await db.recoveryExclusion.upsert({
      where: {
        opportunityId_reason: {
          opportunityId: data.opportunityId,
          reason: data.reason,
        },
      },
      create: {
        orgId: session.orgId,
        opportunityId: data.opportunityId,
        reason: data.reason,
        note: data.note ?? null,
        excludedBy: session.id,
      },
      update: { note: data.note ?? null, excludedBy: session.id },
    });

    revalidatePath("/recovery");
    revalidate(data.opportunityId);
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not exclude that deal.");
  }
}
