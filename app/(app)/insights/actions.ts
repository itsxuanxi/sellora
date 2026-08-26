"use server";

import { revalidatePath } from "next/cache";
import { generateInsights, type AiSource } from "@/lib/ai";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildInsightsContext } from "@/lib/insights";
import { actionError, type ActionResult } from "@/lib/types";

export async function refreshInsights(): Promise<
  ActionResult<{ count: number; source: AiSource }>
> {
  try {
    const session = await requireSession();
    const context = await buildInsightsContext(session.orgId);
    const { data, source } = await generateInsights(
      context,
      session.org.settings?.openaiApiKey
    );

    await db.$transaction([
      db.insight.deleteMany({ where: { orgId: session.orgId } }),
      db.insight.createMany({
        data: data.map((insight) => ({
          orgId: session.orgId,
          kind: insight.kind,
          title: insight.title,
          body: insight.body,
        })),
      }),
    ]);
    revalidatePath("/insights");
    return { ok: true, data: { count: data.length, source } };
  } catch (err) {
    return actionError(err, "Could not generate insights. Please try again.");
  }
}

export async function dismissInsight(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const { count } = await db.insight.updateMany({
      where: { id, orgId: session.orgId },
      data: { dismissed: true },
    });
    if (count === 0) return { ok: false, error: "Insight not found." };
    revalidatePath("/insights");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not dismiss the insight. Please try again.");
  }
}
