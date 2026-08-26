"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { TONES } from "@/lib/constants";
import { SIGNAL_TYPES } from "@/lib/intent/config";
import { parseSignalsCsv } from "@/lib/intent/providers/csv-provider";
import { generateMockSignals, mockProvider } from "@/lib/intent/providers/mock-provider";
import { ingestDetectedSignals } from "@/lib/intent/import";
import {
  approveAndSendDraft,
  createOutreachDraftForAccount,
  editDraft,
  rejectDraft,
} from "@/lib/intent/drafts";
import { recordFeedback, type FeedbackLabel } from "@/lib/intent/feedback";
import { rescoreAccount } from "@/lib/intent/signals";

function revalidateIntent(campaignId?: string, accountId?: string) {
  revalidatePath("/intent");
  if (campaignId) revalidatePath(`/intent/${campaignId}`);
  if (accountId) revalidatePath(`/intent/company/${accountId}`);
}

const campaignSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(120),
  industries: z.string().trim().max(400).optional().or(z.literal("")),
  regions: z.string().trim().max(400).optional().or(z.literal("")),
  companySizes: z.string().trim().max(200).optional().or(z.literal("")),
  targetTitles: z.string().trim().max(400).optional().or(z.literal("")),
  mustHave: z.string().trim().max(1000).optional().or(z.literal("")),
  exclusions: z.string().trim().max(1000).optional().or(z.literal("")),
  signalTypes: z.array(z.enum(SIGNAL_TYPES as [string, ...string[]])).default([]),
  minIntentScore: z.coerce.number().int().min(0).max(100).default(50),
  tone: z.enum(TONES).default("professional"),
  cta: z.string().trim().max(300).optional().or(z.literal("")),
  dailyRecommendations: z.coerce.number().int().min(1).max(200).default(10),
  requireApproval: z.coerce.boolean().default(true),
});

export async function createIntentCampaign(
  input: z.infer<typeof campaignSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = campaignSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;

    const campaign = await db.intentCampaign.create({
      data: {
        orgId: session.orgId,
        name: d.name,
        industries: d.industries || null,
        regions: d.regions || null,
        companySizes: d.companySizes || null,
        targetTitles: d.targetTitles || null,
        mustHave: d.mustHave || null,
        exclusions: d.exclusions || null,
        signalTypes: d.signalTypes.length ? d.signalTypes.join(",") : null,
        minIntentScore: d.minIntentScore,
        tone: d.tone,
        cta: d.cta || null,
        dailyRecommendations: d.dailyRecommendations,
        requireApproval: true, // MVP: sending always requires approval, regardless of input
      },
    });
    revalidateIntent();
    return { ok: true, data: { id: campaign.id } };
  } catch (err) {
    return actionError(err, "Could not create the campaign.");
  }
}

/** CSV import — real, user-supplied data. See providers/csv-provider.ts for
 * the expected column format. */
export async function importSignalsCsv(
  campaignId: string,
  csvText: string
): Promise<ActionResult<{ created: number; matched: number; signals: number; deduped: number; errors: string[] }>> {
  try {
    const session = await requireSession();
    const campaign = await db.intentCampaign.findFirst({
      where: { id: campaignId, orgId: session.orgId },
    });
    if (!campaign) return { ok: false, error: "Campaign not found." };

    const { detected, errors } = parseSignalsCsv(csvText);
    if (detected.length === 0) {
      return {
        ok: false,
        error: errors[0]?.message ?? "No valid rows found in the CSV.",
      };
    }

    const summary = await ingestDetectedSignals(session, campaignId, detected);
    revalidateIntent(campaignId);
    return {
      ok: true,
      data: {
        created: summary.accountsCreated,
        matched: summary.accountsMatched,
        signals: summary.signalsCreated,
        deduped: summary.signalsDeduped,
        errors: errors.map((e) => `Row ${e.row}: ${e.message}`),
      },
    };
  } catch (err) {
    return actionError(err, "CSV import failed part-way — check the file and retry.");
  }
}

/** Demo-data detection — clearly labeled mock signals, never real facts.
 * Lets a user evaluate the full flow before wiring up a real provider. */
export async function runMockDetection(
  campaignId: string,
  companyNamesRaw: string
): Promise<ActionResult<{ created: number; matched: number; signals: number; deduped: number }>> {
  try {
    const session = await requireSession();
    const campaign = await db.intentCampaign.findFirst({
      where: { id: campaignId, orgId: session.orgId },
    });
    if (!campaign) return { ok: false, error: "Campaign not found." };

    const names = companyNamesRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 25);
    if (names.length === 0) {
      return { ok: false, error: "Enter at least one company name, one per line." };
    }

    const detected = generateMockSignals(names);
    const summary = await ingestDetectedSignals(session, campaignId, detected);

    await db.integration.upsert({
      where: { orgId_provider: { orgId: session.orgId, provider: mockProvider.key } },
      update: { lastRunAt: new Date(), status: "CONNECTED" },
      create: { orgId: session.orgId, provider: mockProvider.key, status: "CONNECTED", lastRunAt: new Date() },
    });

    revalidateIntent(campaignId);
    return {
      ok: true,
      data: {
        created: summary.accountsCreated,
        matched: summary.accountsMatched,
        signals: summary.signalsCreated,
        deduped: summary.signalsDeduped,
      },
    };
  } catch (err) {
    return actionError(err, "Demo detection failed — please retry.");
  }
}

export async function rescoreAccountNow(accountId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const account = await db.account.findFirst({ where: { id: accountId, orgId: session.orgId } });
    if (!account) return { ok: false, error: "Account not found." };
    await rescoreAccount(session, accountId);
    revalidateIntent(undefined, accountId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Scoring failed. Please try again.");
  }
}

export async function generateDraft(
  campaignId: string,
  accountId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const draft = await createOutreachDraftForAccount(session, campaignId, accountId);
    revalidateIntent(campaignId, accountId);
    return { ok: true, data: { id: draft.id } };
  } catch (err) {
    return actionError(err, "Could not generate an outreach draft.");
  }
}

export async function approveDraft(draftId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const draft = await approveAndSendDraft(session, draftId);
    revalidateIntent(draft.campaignId, draft.accountId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, err instanceof Error ? err.message : "Send failed.");
  }
}

export async function rejectDraftAction(draftId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const draft = await rejectDraft(session, draftId);
    revalidateIntent(draft.campaignId, draft.accountId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not reject the draft.");
  }
}

export async function editDraftAction(
  draftId: string,
  subject: string,
  body: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const draft = await editDraft(session, draftId, subject, body);
    revalidateIntent(draft.campaignId, draft.accountId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, err instanceof Error ? err.message : "Could not save edits.");
  }
}

export async function markFeedback(
  accountId: string,
  label: FeedbackLabel,
  draftId?: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await recordFeedback(session, accountId, label, { draftId });
    revalidateIntent(undefined, accountId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not save feedback.");
  }
}
