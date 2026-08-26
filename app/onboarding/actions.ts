"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { generateIcp } from "@/lib/agent-ai";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";

const answersSchema = z.object({
  offering: z.string().trim().min(1, "Tell us what you sell").max(1000),
  idealCustomer: z.string().trim().min(1, "Describe your ideal customer").max(1000),
  dealValueMin: z.number().int().min(0).nullable(),
  dealValueMax: z.number().int().min(0).nullable(),
  regionsRaw: z.string().trim().max(300),
  autonomy: z.enum(["suggest", "approve", "autopilot"]),
});

export async function completeBusinessOnboarding(
  input: z.infer<typeof answersSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = answersSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const a = parsed.data;

    const { data: icp, source } = await generateIcp(
      {
        offering: a.offering,
        idealCustomer: a.idealCustomer,
        dealValueMin: a.dealValueMin,
        dealValueMax: a.dealValueMax,
        regionsRaw: a.regionsRaw,
      },
      session.org.settings?.openaiApiKey
    );

    await db.icpProfile.upsert({
      where: { orgId: session.orgId },
      create: {
        orgId: session.orgId,
        completed: true,
        offering: a.offering,
        idealCustomer: a.idealCustomer,
        dealValueMin: a.dealValueMin,
        dealValueMax: a.dealValueMax,
        regions: icp.regions,
        industries: icp.industries,
        companySizes: icp.companySizes,
        buyerTitles: icp.buyerTitles,
        signals: icp.signals,
        exclusions: icp.exclusions,
        autonomy: a.autonomy,
        aiNotes: icp.aiNotes,
      },
      update: {
        completed: true,
        offering: a.offering,
        idealCustomer: a.idealCustomer,
        dealValueMin: a.dealValueMin,
        dealValueMax: a.dealValueMax,
        regions: icp.regions,
        industries: icp.industries,
        companySizes: icp.companySizes,
        buyerTitles: icp.buyerTitles,
        signals: icp.signals,
        exclusions: icp.exclusions,
        autonomy: a.autonomy,
        aiNotes: icp.aiNotes,
      },
    });

    // Audit: the ICP generation is itself an agent action (already executed).
    await db.agentAction.create({
      data: {
        orgId: session.orgId,
        type: "generate_icp",
        status: "DONE",
        title: "Generated Ideal Customer Profile from onboarding",
        detail: `Autonomy set to "${a.autonomy}". Source: ${source === "openai" ? "GPT" : "local rules (no AI key)"}.`,
        result: JSON.stringify({ source }),
        requestedBy: session.id,
        executedAt: new Date(),
      },
    });
  } catch (err) {
    return actionError(err, "Could not finish onboarding. Please try again.");
  }
  redirect("/icp?welcome=1");
}

export async function skipBusinessOnboarding(): Promise<void> {
  const session = await requireSession();
  await db.icpProfile.upsert({
    where: { orgId: session.orgId },
    create: { orgId: session.orgId, completed: false },
    update: {},
  });
  redirect("/dashboard");
}
