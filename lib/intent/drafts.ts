import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import type { SessionContext } from "@/lib/auth";
import { generateIntentBrief, type EvidenceItem } from "@/lib/intent/ai";

const DECISION_TITLE_HINTS = [
  "ceo",
  "founder",
  "president",
  "owner",
  "head of talent",
  "head of people",
  "head of hr",
  "vp people",
  "vp talent",
  "vp hr",
  "director of talent",
  "director of hr",
  "director of people",
  "talent acquisition",
  "recruiting manager",
  "hr manager",
];

/** Picks the contact most likely to own a hiring/vendor decision. Falls
 * back to the first linked contact, or null if the account has none yet. */
export async function pickRecommendedContact(accountId: string) {
  const contacts = await db.prospect.findMany({ where: { accountId } });
  if (contacts.length === 0) return null;
  const scored = contacts
    .map((c) => ({
      contact: c,
      score: DECISION_TITLE_HINTS.some((hint) => c.position?.toLowerCase().includes(hint)) ? 1 : 0,
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0].contact;
}

async function logIntentAudit(
  orgId: string,
  type: string,
  title: string,
  detail: string | undefined,
  accountId: string | undefined,
  requestedBy: string
) {
  return db.agentAction.create({
    data: {
      orgId,
      type,
      status: "DONE",
      title,
      detail: detail ?? null,
      accountId: accountId ?? null,
      requestedBy,
      decidedBy: requestedBy,
      decidedAt: new Date(),
      executedAt: new Date(),
    },
  });
}

/**
 * Builds (or rebuilds) the outreach draft for one account inside a
 * campaign, grounded in its currently-active buying signals. Never sends
 * anything — this only ever creates a DRAFT row.
 */
export async function createOutreachDraftForAccount(
  session: SessionContext,
  campaignId: string,
  accountId: string
) {
  const [campaign, account, contact, signals, latestSnapshot] = await Promise.all([
    db.intentCampaign.findFirstOrThrow({ where: { id: campaignId, orgId: session.orgId } }),
    db.account.findFirstOrThrow({ where: { id: accountId, orgId: session.orgId } }),
    pickRecommendedContact(accountId),
    db.buyingSignal.findMany({
      where: { orgId: session.orgId, accountId, expired: false },
      orderBy: { occurredAt: "desc" },
      include: { source: true },
      take: 6,
    }),
    db.intentScoreSnapshot.findFirst({
      where: { orgId: session.orgId, accountId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const evidence: EvidenceItem[] = signals.map((s) => ({
    signalType: s.signalType,
    title: s.title,
    evidence: s.evidence,
    occurredAt: s.occurredAt.toISOString(),
    confidence: s.confidence,
    isMockData: s.source?.kind === "mock",
  }));

  const { data, source } = await generateIntentBrief(
    account,
    contact,
    session.org,
    evidence,
    campaign.cta,
    campaign.tone,
    session.org.settings?.openaiApiKey
  );

  const draft = await db.outreachDraft.create({
    data: {
      orgId: session.orgId,
      campaignId,
      accountId,
      prospectId: contact?.id ?? null,
      scoreSnapshotId: latestSnapshot?.id ?? null,
      subject: data.subject,
      body: data.body,
      accountSummary: data.accountSummary,
      recommendedAngle: data.recommendedAngle,
      status: "DRAFT",
      evidenceUsed: JSON.stringify(signals.map((s) => s.id)),
      insufficientEvidence: data.insufficientEvidence,
      aiSource: source,
    },
  });

  await logIntentAudit(
    session.orgId,
    "draft_intent_outreach",
    `Drafted outreach for ${account.name}`,
    data.insufficientEvidence
      ? "Insufficient evidence — draft withheld, not sendable."
      : `Grounded in ${signals.length} active signal(s).`,
    accountId,
    "agent"
  );

  return draft;
}

/** Sends an approved draft. Always requires this explicit call — nothing in
 * the app calls sendEmail() for an intent draft on its own. */
export async function approveAndSendDraft(session: SessionContext, draftId: string) {
  const draft = await db.outreachDraft.findFirst({
    where: { id: draftId, orgId: session.orgId },
    include: { account: true, prospect: true },
  });
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "DRAFT") throw new Error(`Draft is already ${draft.status.toLowerCase()}`);
  if (draft.insufficientEvidence) {
    throw new Error("This draft has insufficient evidence and cannot be sent.");
  }
  if (!draft.prospect?.email) {
    throw new Error("No contact email on file for this account — add a contact first.");
  }

  const result = await sendEmail({
    to: draft.prospect.email,
    subject: draft.subject,
    body: draft.body,
    orgApiKey: session.org.settings?.resendApiKey,
  });

  const updated = await db.outreachDraft.update({
    where: { id: draftId },
    data: {
      status: "SENT",
      approvedBy: session.id,
      approvedAt: new Date(),
      sentAt: new Date(),
    },
  });

  await logIntentAudit(
    session.orgId,
    "send_intent_outreach",
    `Sent outreach to ${draft.account.name}`,
    result.simulated ? "Simulated send (no Resend key configured)." : "Sent via Resend.",
    draft.accountId,
    session.id
  );

  return updated;
}

export async function rejectDraft(session: SessionContext, draftId: string) {
  const draft = await db.outreachDraft.findFirst({ where: { id: draftId, orgId: session.orgId } });
  if (!draft) throw new Error("Draft not found");
  const updated = await db.outreachDraft.update({
    where: { id: draftId },
    data: { status: "REJECTED", approvedBy: session.id, approvedAt: new Date() },
  });
  await logIntentAudit(
    session.orgId,
    "reject_intent_outreach",
    `Rejected draft for account`,
    undefined,
    draft.accountId,
    session.id
  );
  return updated;
}

export async function editDraft(
  session: SessionContext,
  draftId: string,
  subject: string,
  body: string
) {
  const draft = await db.outreachDraft.findFirst({ where: { id: draftId, orgId: session.orgId } });
  if (!draft) throw new Error("Draft not found");
  if (draft.status !== "DRAFT") throw new Error("Only draft-status recommendations can be edited");
  return db.outreachDraft.update({
    where: { id: draftId },
    data: { subject, body, insufficientEvidence: false },
  });
}
