"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { apiKeysSchema, companySchema, profileSchema } from "@/lib/validators";
import { z } from "zod";

export async function updateProfile(
  input: z.infer<typeof profileSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    await db.user.update({
      where: { id: session.id },
      data: { name: parsed.data.name },
    });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not update your profile. Please try again.");
  }
}

const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Please tell us your name").max(120),
  orgName: z.string().trim().min(1, "Workspace name is required").max(120),
});

/** First-login setup for accounts created via OTP (no name yet). */
export async function completeOnboarding(
  input: z.infer<typeof onboardingSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = onboardingSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    await db.$transaction([
      db.user.update({
        where: { id: session.id },
        data: { name: parsed.data.name },
      }),
      db.organization.update({
        where: { id: session.orgId },
        data: { name: parsed.data.orgName },
      }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not save your details. Please try again.");
  }
}

export async function updateCompany(
  input: z.infer<typeof companySchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = companySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    await db.organization.update({
      where: { id: session.orgId },
      data: parsed.data,
    });
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not update the company. Please try again.");
  }
}

export async function updateApiKeys(
  input: z.infer<typeof apiKeysSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = apiKeysSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    // Empty string clears a key; undefined leaves it untouched.
    const normalize = (value: string | null | undefined) =>
      value === undefined ? undefined : value?.trim() || null;
    await db.settings.upsert({
      where: { orgId: session.orgId },
      create: {
        orgId: session.orgId,
        openaiApiKey: normalize(parsed.data.openaiApiKey) ?? null,
        resendApiKey: normalize(parsed.data.resendApiKey) ?? null,
      },
      update: {
        openaiApiKey: normalize(parsed.data.openaiApiKey),
        resendApiKey: normalize(parsed.data.resendApiKey),
      },
    });
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not save the API keys. Please try again.");
  }
}
