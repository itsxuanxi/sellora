"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { sendEmail } from "@/lib/email";
import { isSimulated } from "@/lib/sandbox";
import { recordAudit } from "@/lib/security/audit";
import { generateFollowUpDraft } from "@/lib/followup/draft";
import { decideSend } from "@/lib/followup/send-guard";
import { RULE_ORDER, type FollowUpRule } from "@/lib/followup/rules";
import { getFollowUps } from "@/lib/followup/queries";

/**
 * The follow-up workbench's write side.
 *
 * Every action re-reads what it is about through `requireSession().orgId`
 * rather than trusting an id from the client. An opportunity id in a form
 * post is a request, not a permission.
 */

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");
}

// Derived from RULE_ORDER rather than listed again. A hand-written copy of
// this union silently rejected a new rule the moment one was added, so the
// card rendered and its buttons returned a validation error.
const ruleSchema = z.enum(RULE_ORDER as [FollowUpRule, ...FollowUpRule[]]);

/** Confirms the deal belongs to this workspace, and returns nothing else. */
async function assertOwned(orgId: string, opportunityId: string): Promise<boolean> {
  const found = await db.opportunity.findFirst({
    where: { orgId, id: opportunityId },
    select: { id: true },
  });
  return found !== null;
}

/** The newest activity Selryn knows about, which "done" is measured against. */
async function newestEvidenceAt(orgId: string, opportunityId: string) {
  const latest = await db.revenueEvent.findFirst({
    where: { orgId, opportunityId },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  return latest?.occurredAt ?? null;
}

const handleSchema = z.object({
  opportunityId: z.string().min(1),
  rule: ruleSchema,
  state: z.enum(["DONE", "SNOOZED", "IGNORED"]),
  snoozeDays: z.coerce.number().int().min(1).max(90).optional(),
  note: z.string().max(500).optional(),
});

/** Mark done, remind me later, or not interested. */
export async function handleFollowUp(
  input: z.infer<typeof handleSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const data = handleSchema.parse(input);

    if (!(await assertOwned(session.orgId, data.opportunityId))) {
      return { ok: false, error: "That deal is not in this workspace." };
    }

    const snoozedUntil =
      data.state === "SNOOZED"
        ? new Date(Date.now() + (data.snoozeDays ?? 3) * 86_400_000)
        : null;

    // Recorded at the moment of handling: anything newer than this brings the
    // deal back, and nothing else does.
    const handledAgainst =
      data.state === "DONE" ? await newestEvidenceAt(session.orgId, data.opportunityId) : null;

    const payload = {
      state: data.state,
      snoozedUntil,
      handledAgainst,
      note: data.note ?? null,
      actedBy: session.id,
    };

    await db.followUpAction.upsert({
      where: {
        opportunityId_rule: { opportunityId: data.opportunityId, rule: data.rule },
      },
      create: { ...payload, orgId: session.orgId, opportunityId: data.opportunityId, rule: data.rule },
      update: payload,
    });

    revalidate();
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not update that follow-up.");
  }
}

const draftSchema = z.object({
  opportunityId: z.string().min(1),
  rule: ruleSchema,
  /** True when the seller asked for a different version. */
  regenerate: z.boolean().optional(),
});

export interface DraftView {
  id: string;
  subject: string;
  body: string;
  toAddress: string;
  contactName: string | null;
  warnings: string[];
  aiSource: string;
}

/** Writes a draft for this deal. Never sends anything. */
export async function draftFollowUp(
  input: z.infer<typeof draftSchema>
): Promise<ActionResult<DraftView>> {
  try {
    const session = await requireSession();
    const data = draftSchema.parse(input);

    const opportunity = await db.opportunity.findFirst({
      where: { orgId: session.orgId, id: data.opportunityId },
      select: {
        id: true,
        account: { select: { name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    });
    if (!opportunity) return { ok: false, error: "That deal is not in this workspace." };
    if (!opportunity.primaryContact?.email) {
      return {
        ok: false,
        error: "This deal has no contact with an email address — add one first.",
      };
    }

    // The reason is taken from the live list rather than the client, so the
    // draft is grounded in what Selryn actually detected.
    const item = (await getFollowUps(session.orgId)).find(
      (i) => i.opportunityId === data.opportunityId
    );
    if (!item) {
      return { ok: false, error: "This deal no longer needs a follow-up." };
    }

    const settings = await db.settings.findUnique({
      where: { orgId: session.orgId },
      select: { openaiApiKey: true },
    });

    const generated = await generateFollowUpDraft(
      {
        accountName: opportunity.account.name,
        contactName: opportunity.primaryContact.name,
        reason: item.because,
        rule: item.rule,
        history: item.evidence,
        senderName: session.org.senderName ?? session.name,
        orgName: session.org.name,
        languageHint: null,
      },
      settings?.openaiApiKey
    );

    // One open draft per deal: regenerating replaces it rather than leaving
    // two drafts that could each be sent.
    await db.dealFollowUp.deleteMany({
      where: { orgId: session.orgId, opportunityId: opportunity.id, status: "DRAFT" },
    });

    const draft = await db.dealFollowUp.create({
      data: {
        orgId: session.orgId,
        opportunityId: opportunity.id,
        contactId: opportunity.primaryContact.id,
        rule: data.rule,
        reason: item.because,
        evidence: JSON.stringify(item.evidence.map((e) => e.eventId)),
        toAddress: opportunity.primaryContact.email,
        subject: generated.subject,
        body: generated.body,
        aiSource: generated.source,
      },
      select: { id: true, subject: true, body: true, toAddress: true },
    });

    revalidate();
    return {
      ok: true,
      data: {
        ...draft,
        contactName: opportunity.primaryContact.name,
        warnings: generated.warnings,
        aiSource: generated.source,
      },
    };
  } catch (e) {
    return actionError(e, "Could not draft that follow-up.");
  }
}

const editSchema = z.object({
  draftId: z.string().min(1),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20_000),
});

export async function editFollowUpDraft(
  input: z.infer<typeof editSchema>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const data = editSchema.parse(input);

    const updated = await db.dealFollowUp.updateMany({
      where: { orgId: session.orgId, id: data.draftId, status: "DRAFT" },
      data: { subject: data.subject, body: data.body, edited: true },
    });
    if (updated.count === 0) {
      return { ok: false, error: "That draft can no longer be edited." };
    }

    revalidate();
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not save your changes.");
  }
}

const sendSchema = z.object({
  draftId: z.string().min(1),
  /** The exact text shown when the button was pressed. */
  subject: z.string(),
  body: z.string(),
  /** The explicit click. Never defaulted. */
  confirmed: z.literal(true),
});

/**
 * Sends a drafted follow-up, once.
 *
 * The claim is written in a conditional update before the provider is called:
 * two concurrent clicks race on that row and exactly one wins, so the loser
 * cannot also send. Recording the send afterwards instead would leave a
 * window where both see an unsent draft.
 */
export async function sendFollowUp(
  input: z.infer<typeof sendSchema>
): Promise<ActionResult<string>> {
  try {
    const session = await requireSession();
    const data = sendSchema.parse(input);

    const draft = await db.dealFollowUp.findFirst({
      where: { orgId: session.orgId, id: data.draftId },
      select: {
        id: true,
        status: true,
        toAddress: true,
        subject: true,
        body: true,
        sendClaimedAt: true,
        sentAt: true,
        opportunityId: true,
        contactId: true,
      },
    });

    const decision = decideSend(draft, {
      confirmedBody: data.body,
      confirmedSubject: data.subject,
      confirmed: data.confirmed,
    });
    if (!decision.allowed) return { ok: false, error: decision.message };

    // Claim it. `sendClaimedAt: null` in the filter is the lock.
    const claimed = await db.dealFollowUp.updateMany({
      where: { orgId: session.orgId, id: draft!.id, status: "DRAFT", sendClaimedAt: null },
      data: { sendClaimedAt: new Date(), approvedBy: session.id },
    });
    if (claimed.count === 0) {
      return { ok: false, error: "This follow-up is already being sent." };
    }

    const sandbox = isSimulated({ orgIsSample: session.org.isSample });
    const settings = await db.settings.findUnique({
      where: { orgId: session.orgId },
      select: { resendApiKey: true },
    });

    try {
      const result = await sendEmail({
        to: draft!.toAddress!,
        subject: data.subject,
        body: data.body,
        orgApiKey: settings?.resendApiKey,
        sandbox,
      });

      // updateMany so the workspace filter is on the write itself. The read
      // and the claim above are both scoped, but a write that carries its own
      // filter cannot be made unsafe by someone rearranging the lines above it.
      await db.dealFollowUp.updateMany({
        where: { orgId: session.orgId, id: draft!.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.id,
          simulated: result.simulated,
        },
      });

      await recordAudit({
        orgId: session.orgId,
        actorId: session.id,
        actorType: "user",
        action: "action.executed",
        targetType: "deal_follow_up",
        targetId: draft!.id,
        metadata: {
          opportunityId: draft!.opportunityId,
          delivery: result.sandbox ? "simulated_sandbox" : result.simulated ? "simulated_no_key" : "resend",
        },
      });

      revalidate();
      return {
        ok: true,
        data: result.simulated
          ? "Recorded — not delivered, because this workspace simulates sending."
          : `Sent to ${draft!.toAddress}.`,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "The send failed.";
      // The text is kept so nothing the seller wrote is lost. The claim
      // stands: after a transport error we cannot know whether the provider
      // accepted the message, and sending again is the unrecoverable mistake.
      await db.dealFollowUp.updateMany({
        where: { orgId: session.orgId, id: draft!.id },
        data: { status: "FAILED", failureReason: reason.slice(0, 500) },
      });
      revalidate();
      return {
        ok: false,
        error: `${reason} Your draft has been kept — review it before trying again.`,
      };
    }
  } catch (e) {
    return actionError(e, "Could not send that follow-up.");
  }
}
