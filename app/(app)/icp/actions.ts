"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { refineIcpFromText } from "@/lib/agent-ai";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";

const icpFieldsSchema = z.object({
  offering: z.string().trim().max(1000),
  idealCustomer: z.string().trim().max(1000),
  industries: z.string().trim().max(500),
  regions: z.string().trim().max(500),
  companySizes: z.string().trim().max(300),
  buyerTitles: z.string().trim().max(500),
  signals: z.string().trim().max(500),
  exclusions: z.string().trim().max(500),
  dealValueMin: z.number().int().min(0).nullable(),
  dealValueMax: z.number().int().min(0).nullable(),
});

export async function updateIcp(
  input: z.infer<typeof icpFieldsSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = icpFieldsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    await db.icpProfile.upsert({
      where: { orgId: session.orgId },
      create: { orgId: session.orgId, completed: true, ...parsed.data },
      update: { completed: true, ...parsed.data },
    });
    revalidatePath("/icp");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not save the ICP.");
  }
}

export async function refineIcp(
  instruction: string
): Promise<ActionResult<{ source: "openai" | "local" }>> {
  try {
    const session = await requireSession();
    const text = instruction.trim();
    if (!text) return { ok: false, error: "Describe the change you want." };
    const current = await db.icpProfile.findUnique({ where: { orgId: session.orgId } });
    if (!current) return { ok: false, error: "Complete onboarding first." };

    const { data, source } = await refineIcpFromText(
      current,
      text,
      session.org.settings?.openaiApiKey
    );
    await db.icpProfile.update({
      where: { orgId: session.orgId },
      data: {
        industries: data.industries,
        regions: data.regions,
        companySizes: data.companySizes,
        buyerTitles: data.buyerTitles,
        signals: data.signals,
        exclusions: data.exclusions,
        aiNotes: data.aiNotes,
      },
    });
    await db.agentAction.create({
      data: {
        orgId: session.orgId,
        type: "generate_icp",
        status: "DONE",
        title: "Refined ICP from natural language",
        detail: `Instruction: "${text.slice(0, 200)}"`,
        result: JSON.stringify({ source }),
        requestedBy: session.id,
        executedAt: new Date(),
      },
    });
    revalidatePath("/icp");
    return { ok: true, data: { source } };
  } catch (err) {
    return actionError(err, "Could not apply the refinement.");
  }
}

export async function setAutonomy(
  autonomy: "suggest" | "approve" | "autopilot"
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!["suggest", "approve", "autopilot"].includes(autonomy)) {
      return { ok: false, error: "Invalid mode." };
    }
    await db.icpProfile.upsert({
      where: { orgId: session.orgId },
      create: { orgId: session.orgId, autonomy },
      update: { autonomy },
    });
    revalidatePath("/icp");
    revalidatePath("/agent");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not update the agent mode.");
  }
}
