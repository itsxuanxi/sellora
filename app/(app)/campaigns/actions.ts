"use server";

import { revalidatePath } from "next/cache";
import {
  generateCampaignEmail,
  generateFollowUps,
  type EmailDraft,
  type AiSource,
} from "@/lib/ai";
import { logActivity } from "@/lib/activity";
import { requireSession, type SessionContext } from "@/lib/auth";
import { checkPlanLimit } from "@/lib/billing";
import { db } from "@/lib/db";
import { sendEmail as deliverEmail } from "@/lib/email";
import { actionError, type ActionResult } from "@/lib/types";
import { campaignSchema, emailContentSchema, type CampaignInput } from "@/lib/validators";

function revalidateCampaignViews(id?: string) {
  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/campaigns/${id}`);
}

// ── Campaign CRUD ──────────────────────────────────────────────────────────

export async function createCampaign(
  input: CampaignInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = campaignSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const limitError = await checkPlanLimit(session.org, "campaigns");
    if (limitError) return { ok: false, error: limitError };
    const campaign = await db.campaign.create({
      data: { ...parsed.data, orgId: session.orgId },
    });
    await logActivity({
      orgId: session.orgId,
      type: "campaign_created",
      description: `Campaign “${campaign.name}” created`,
    });
    revalidateCampaignViews();
    return { ok: true, data: { id: campaign.id } };
  } catch (err) {
    return actionError(err, "Could not create the campaign. Please try again.");
  }
}

export async function updateCampaign(
  id: string,
  input: CampaignInput
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = campaignSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const { count } = await db.campaign.updateMany({
      where: { id, orgId: session.orgId },
      data: parsed.data,
    });
    if (count === 0) return { ok: false, error: "Campaign not found." };
    revalidateCampaignViews(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not update the campaign. Please try again.");
  }
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const { count } = await db.campaign.deleteMany({
      where: { id, orgId: session.orgId },
    });
    if (count === 0) return { ok: false, error: "Campaign not found." };
    revalidateCampaignViews();
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not delete the campaign. Please try again.");
  }
}

// ── Recipients ─────────────────────────────────────────────────────────────

export async function addProspectsToCampaign(
  campaignId: string,
  prospectIds: string[]
): Promise<ActionResult<{ added: number }>> {
  try {
    const session = await requireSession();
    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, orgId: session.orgId },
    });
    if (!campaign) return { ok: false, error: "Campaign not found." };

    const valid = await db.prospect.findMany({
      where: { id: { in: prospectIds }, orgId: session.orgId },
      select: { id: true },
    });
    const existing = await db.email.findMany({
      where: { campaignId, prospectId: { in: valid.map((p) => p.id) } },
      select: { prospectId: true },
    });
    const existingIds = new Set(existing.map((e) => e.prospectId));
    const toAdd = valid.filter((p) => !existingIds.has(p.id));

    if (toAdd.length > 0) {
      await db.email.createMany({
        data: toAdd.map((p) => ({
          orgId: session.orgId,
          campaignId,
          prospectId: p.id,
          subject: "",
          body: "",
          status: "DRAFT",
        })),
      });
    }
    revalidateCampaignViews(campaignId);
    return { ok: true, data: { added: toAdd.length } };
  } catch (err) {
    return actionError(err, "Could not add prospects. Please try again.");
  }
}

export async function removeEmailFromCampaign(
  emailId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const email = await db.email.findFirst({
      where: { id: emailId, orgId: session.orgId },
    });
    if (!email) return { ok: false, error: "Recipient not found." };
    if (email.status !== "DRAFT") {
      return { ok: false, error: "Sent emails can't be removed." };
    }
    await db.email.delete({ where: { id: emailId } });
    revalidateCampaignViews(email.campaignId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not remove the recipient. Please try again.");
  }
}

// ── AI generation ──────────────────────────────────────────────────────────

async function generateOne(session: SessionContext, emailId: string) {
  const email = await db.email.findFirst({
    where: { id: emailId, orgId: session.orgId },
    include: { prospect: true, campaign: true },
  });
  if (!email) throw new Error("Email not found");
  if (email.status !== "DRAFT") throw new Error("Only drafts can be regenerated");

  const { data, source } = await generateCampaignEmail(
    email.prospect,
    email.campaign,
    session.org,
    session.org.settings?.openaiApiKey
  );
  await db.email.update({
    where: { id: email.id },
    data: { subject: data.subject, body: data.body },
  });
  return { data, source, campaignId: email.campaignId };
}

export async function generateEmailForRecipient(
  emailId: string
): Promise<ActionResult<{ draft: EmailDraft; source: AiSource }>> {
  try {
    const session = await requireSession();
    const { data, source, campaignId } = await generateOne(session, emailId);
    revalidateCampaignViews(campaignId);
    return { ok: true, data: { draft: data, source } };
  } catch (err) {
    return actionError(err, "AI generation failed. Please try again.");
  }
}

export async function generateAllEmails(
  campaignId: string
): Promise<ActionResult<{ generated: number; source: AiSource }>> {
  try {
    const session = await requireSession();
    const drafts = await db.email.findMany({
      where: { campaignId, orgId: session.orgId, status: "DRAFT", subject: "" },
      select: { id: true },
      take: 50,
    });
    let source: AiSource = "local";
    for (const draft of drafts) {
      const result = await generateOne(session, draft.id);
      source = result.source;
    }
    if (drafts.length > 0) {
      await logActivity({
        orgId: session.orgId,
        type: "ai_generated",
        description: `AI emails generated for ${drafts.length} prospect${drafts.length === 1 ? "" : "s"}`,
      });
    }
    revalidateCampaignViews(campaignId);
    return { ok: true, data: { generated: drafts.length, source } };
  } catch (err) {
    return actionError(err, "Bulk generation failed. Please try again.");
  }
}

export async function updateEmailContent(
  emailId: string,
  content: { subject: string; body: string }
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = emailContentSchema.safeParse(content);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const email = await db.email.findFirst({
      where: { id: emailId, orgId: session.orgId },
    });
    if (!email) return { ok: false, error: "Email not found." };
    if (email.status !== "DRAFT") {
      return { ok: false, error: "Sent emails can't be edited." };
    }
    await db.email.update({ where: { id: emailId }, data: parsed.data });
    revalidateCampaignViews(email.campaignId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not save the email. Please try again.");
  }
}

// ── Sending & tracking ─────────────────────────────────────────────────────

async function sendOne(session: SessionContext, emailId: string) {
  const email = await db.email.findFirst({
    where: { id: emailId, orgId: session.orgId },
    include: { prospect: true, campaign: true },
  });
  if (!email) throw new Error("Email not found");
  if (email.status !== "DRAFT") throw new Error("Already sent");
  if (!email.subject.trim() || !email.body.trim()) {
    throw new Error("Generate or write the email before sending");
  }
  const limitError = await checkPlanLimit(session.org, "emailsPerMonth");
  if (limitError) throw new Error(limitError);

  const settings = session.org.settings;
  const from =
    session.org.senderEmail && session.org.senderName
      ? `${session.org.senderName} <${session.org.senderEmail}>`
      : null;
  const result = await deliverEmail({
    to: email.prospect.email,
    subject: email.subject,
    body: email.body,
    orgApiKey: settings?.resendApiKey,
    from,
  });

  await db.$transaction([
    db.email.update({
      where: { id: email.id },
      data: { status: "SENT", sentAt: new Date(), resendId: result.id },
    }),
    db.campaign.update({
      where: { id: email.campaignId },
      data: { status: "ACTIVE" },
    }),
    ...(email.prospect.stage === "NEW_LEAD"
      ? [
          db.prospect.update({
            where: { id: email.prospectId },
            data: { stage: "CONTACTED" },
          }),
        ]
      : []),
  ]);
  await logActivity({
    orgId: session.orgId,
    type: "email_sent",
    description: `Email sent to ${email.prospect.name} (${email.prospect.company})${result.simulated ? " — simulated" : ""}`,
    prospectId: email.prospectId,
  });
  return { simulated: result.simulated, campaignId: email.campaignId };
}

export async function sendCampaignEmail(
  emailId: string
): Promise<ActionResult<{ simulated: boolean }>> {
  try {
    const session = await requireSession();
    const { simulated, campaignId } = await sendOne(session, emailId);
    revalidateCampaignViews(campaignId);
    revalidatePath("/prospects");
    revalidatePath("/pipeline");
    return { ok: true, data: { simulated } };
  } catch (err) {
    const message =
      err instanceof Error &&
      (err.message.startsWith("Generate") || err.message.includes("plan limit"))
        ? err.message
        : "Sending failed. Please try again.";
    return actionError(err, message);
  }
}

export async function sendAllEmails(
  campaignId: string
): Promise<ActionResult<{ sent: number; simulated: boolean }>> {
  try {
    const session = await requireSession();
    const ready = await db.email.findMany({
      where: {
        campaignId,
        orgId: session.orgId,
        status: "DRAFT",
        NOT: { subject: "" },
      },
      select: { id: true },
      take: 100,
    });
    if (ready.length === 0) {
      return { ok: false, error: "No generated drafts ready to send." };
    }
    let simulated = false;
    let sent = 0;
    for (const email of ready) {
      const result = await sendOne(session, email.id);
      simulated = result.simulated;
      sent += 1;
    }
    revalidateCampaignViews(campaignId);
    revalidatePath("/prospects");
    revalidatePath("/pipeline");
    return { ok: true, data: { sent, simulated } };
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("plan limit")
        ? err.message
        : "Bulk send failed part-way. Refresh to see progress.";
    return actionError(err, message);
  }
}

export async function markEmailStatus(
  emailId: string,
  status: "OPENED" | "REPLIED"
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const email = await db.email.findFirst({
      where: { id: emailId, orgId: session.orgId },
      include: { prospect: true },
    });
    if (!email) return { ok: false, error: "Email not found." };
    if (email.status === "DRAFT") {
      return { ok: false, error: "This email hasn't been sent yet." };
    }

    const now = new Date();
    await db.email.update({
      where: { id: emailId },
      data:
        status === "OPENED"
          ? { status: "OPENED", openedAt: email.openedAt ?? now }
          : {
              status: "REPLIED",
              repliedAt: now,
              openedAt: email.openedAt ?? now,
            },
    });
    if (status === "REPLIED" && ["CONTACTED", "NEW_LEAD"].includes(email.prospect.stage)) {
      await db.prospect.update({
        where: { id: email.prospectId },
        data: { stage: "INTERESTED" },
      });
    }
    await logActivity({
      orgId: session.orgId,
      type: status === "OPENED" ? "email_opened" : "email_replied",
      description: `${email.prospect.name} ${status === "OPENED" ? "opened your email" : "replied to your email"}`,
      prospectId: email.prospectId,
    });
    revalidateCampaignViews(email.campaignId);
    revalidatePath("/prospects");
    revalidatePath("/pipeline");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not update the status. Please try again.");
  }
}

// ── Follow-ups ─────────────────────────────────────────────────────────────

export async function generateFollowUpSequence(
  emailId: string
): Promise<ActionResult<{ count: number; source: AiSource }>> {
  try {
    const session = await requireSession();
    const email = await db.email.findFirst({
      where: { id: emailId, orgId: session.orgId },
      include: { prospect: true },
    });
    if (!email) return { ok: false, error: "Email not found." };
    if (!email.subject.trim()) {
      return { ok: false, error: "Generate the original email first." };
    }

    const { data, source } = await generateFollowUps(
      { subject: email.subject, body: email.body },
      email.prospect,
      session.org,
      session.org.settings?.openaiApiKey
    );

    await db.$transaction([
      db.followUp.deleteMany({ where: { emailId, status: "DRAFT" } }),
      ...data.map((f) =>
        db.followUp.create({
          data: {
            emailId,
            sequence: f.sequence,
            tone: f.tone,
            cta: f.cta,
            subject: f.subject,
            body: f.body,
            status: "DRAFT",
          },
        })
      ),
    ]);
    revalidateCampaignViews(email.campaignId);
    return { ok: true, data: { count: data.length, source } };
  } catch (err) {
    return actionError(err, "Could not generate follow-ups. Please try again.");
  }
}

export async function updateFollowUpContent(
  followUpId: string,
  content: { subject: string; body: string }
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = emailContentSchema.safeParse(content);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const followUp = await db.followUp.findFirst({
      where: { id: followUpId, email: { orgId: session.orgId } },
      include: { email: true },
    });
    if (!followUp) return { ok: false, error: "Follow-up not found." };
    if (followUp.status === "SENT") {
      return { ok: false, error: "Sent follow-ups can't be edited." };
    }
    await db.followUp.update({ where: { id: followUpId }, data: parsed.data });
    revalidateCampaignViews(followUp.email.campaignId);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not save the follow-up. Please try again.");
  }
}

export async function sendFollowUp(
  followUpId: string
): Promise<ActionResult<{ simulated: boolean }>> {
  try {
    const session = await requireSession();
    const followUp = await db.followUp.findFirst({
      where: { id: followUpId, email: { orgId: session.orgId } },
      include: { email: { include: { prospect: true } } },
    });
    if (!followUp) return { ok: false, error: "Follow-up not found." };
    if (followUp.status === "SENT") {
      return { ok: false, error: "This follow-up was already sent." };
    }
    if (followUp.email.status === "DRAFT") {
      return { ok: false, error: "Send the original email first." };
    }
    if (followUp.email.status === "REPLIED") {
      return { ok: false, error: "The prospect already replied — sequence stopped." };
    }
    const limitError = await checkPlanLimit(session.org, "emailsPerMonth");
    if (limitError) return { ok: false, error: limitError };

    const from =
      session.org.senderEmail && session.org.senderName
        ? `${session.org.senderName} <${session.org.senderEmail}>`
        : null;
    const result = await deliverEmail({
      to: followUp.email.prospect.email,
      subject: followUp.subject,
      body: followUp.body,
      orgApiKey: session.org.settings?.resendApiKey,
      from,
    });

    await db.followUp.update({
      where: { id: followUpId },
      data: { status: "SENT", sentAt: new Date(), resendId: result.id },
    });
    await logActivity({
      orgId: session.orgId,
      type: "followup_sent",
      description: `Follow-up #${followUp.sequence} sent to ${followUp.email.prospect.name}${result.simulated ? " — simulated" : ""}`,
      prospectId: followUp.email.prospectId,
    });
    revalidateCampaignViews(followUp.email.campaignId);
    return { ok: true, data: { simulated: result.simulated } };
  } catch (err) {
    return actionError(err, "Could not send the follow-up. Please try again.");
  }
}
