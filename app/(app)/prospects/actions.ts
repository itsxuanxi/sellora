"use server";

import { revalidatePath } from "next/cache";
import { generatePersonalization, type AiSource, type Personalization } from "@/lib/ai";
import { logActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { checkPlanLimit } from "@/lib/billing";
import { STAGE_CONFIG, type PipelineStage, PIPELINE_STAGES } from "@/lib/constants";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { prospectSchema, type ProspectInput } from "@/lib/validators";

function revalidateProspectViews(id?: string) {
  revalidatePath("/prospects");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/prospects/${id}`);
}

export async function createProspect(
  input: ProspectInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = prospectSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const limitError = await checkPlanLimit(session.org, "prospects");
    if (limitError) return { ok: false, error: limitError };
    const prospect = await db.prospect.create({
      data: { ...parsed.data, orgId: session.orgId },
    });
    await logActivity({
      orgId: session.orgId,
      type: "prospect_created",
      description: `${prospect.name} (${prospect.company}) added to prospects`,
      prospectId: prospect.id,
    });
    revalidateProspectViews();
    return { ok: true, data: { id: prospect.id } };
  } catch (err) {
    return actionError(err, "Could not create the prospect. Please try again.");
  }
}

export async function updateProspect(
  id: string,
  input: ProspectInput
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = prospectSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const { count } = await db.prospect.updateMany({
      where: { id, orgId: session.orgId },
      data: parsed.data,
    });
    if (count === 0) return { ok: false, error: "Prospect not found." };
    revalidateProspectViews(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not update the prospect. Please try again.");
  }
}

export async function deleteProspect(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const { count } = await db.prospect.deleteMany({
      where: { id, orgId: session.orgId },
    });
    if (count === 0) return { ok: false, error: "Prospect not found." };
    revalidateProspectViews();
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not delete the prospect. Please try again.");
  }
}

export async function updateProspectStage(
  id: string,
  stage: PipelineStage
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!PIPELINE_STAGES.includes(stage)) {
      return { ok: false, error: "Invalid stage." };
    }
    const prospect = await db.prospect.findFirst({
      where: { id, orgId: session.orgId },
    });
    if (!prospect) return { ok: false, error: "Prospect not found." };
    if (prospect.stage === stage) return { ok: true, data: undefined };

    await db.prospect.update({ where: { id }, data: { stage } });
    await logActivity({
      orgId: session.orgId,
      type: "stage_changed",
      description: `${prospect.name} moved to ${STAGE_CONFIG[stage].label}`,
      prospectId: id,
    });
    revalidateProspectViews(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not move the prospect. Please try again.");
  }
}

export async function generateProspectAI(
  id: string
): Promise<ActionResult<{ personalization: Personalization; source: AiSource }>> {
  try {
    const session = await requireSession();
    const prospect = await db.prospect.findFirst({
      where: { id, orgId: session.orgId },
    });
    if (!prospect) return { ok: false, error: "Prospect not found." };

    const { data, source } = await generatePersonalization(
      prospect,
      session.org,
      session.org.settings?.openaiApiKey
    );

    await db.prospect.update({
      where: { id },
      data: { ...data, aiGeneratedAt: new Date() },
    });
    await logActivity({
      orgId: session.orgId,
      type: "ai_generated",
      description: `AI personalization generated for ${prospect.name} (${prospect.company})`,
      prospectId: id,
    });
    revalidatePath(`/prospects/${id}`);
    return { ok: true, data: { personalization: data, source } };
  } catch (err) {
    return actionError(err, "AI generation failed. Please try again.");
  }
}

export async function savePersonalization(
  id: string,
  fields: Personalization
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const clip = (s: string, max = 10000) => s.trim().slice(0, max);
    const { count } = await db.prospect.updateMany({
      where: { id, orgId: session.orgId },
      data: {
        companySummary: clip(fields.companySummary),
        icebreaker: clip(fields.icebreaker),
        outreachAngle: clip(fields.outreachAngle),
        coldEmailSubject: clip(fields.coldEmailSubject, 200),
        coldEmailBody: clip(fields.coldEmailBody),
        linkedinMessage: clip(fields.linkedinMessage, 1000),
      },
    });
    if (count === 0) return { ok: false, error: "Prospect not found." };
    revalidatePath(`/prospects/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not save changes. Please try again.");
  }
}
