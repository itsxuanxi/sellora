import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { isSimulated } from "@/lib/sandbox";
import type { SessionContext } from "@/lib/auth";
import { generateIntentBrief, type EvidenceItem } from "@/lib/intent/ai";

/**
 * Fallback decision-maker titles, used only when the workspace has not filled
 * in its own ICP.
 *
 * This list used to be eleven variations of Head of Talent, which silently
 * assumed every Selryn customer sold recruiting services. For anyone else it
 * ranked the least relevant contact at an account first. The list below is
 * deliberately generic — the people who sign for anything in a small company
 * — and the real answer comes from the seller's own ICP, below.
 */
const DECISION_TITLE_HINTS = [
  "ceo",
  "founder",
  "president",
  "owner",
  "managing director",
  "partner",
  "chief",
  "vp ",
  "head of",
  "director",
];

/** Comma-separated ICP titles → lowercase hints. Empty list when unset. */
export function titleHints(buyerTitles: string | null | undefined): string[] {
  return (buyerTitles ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Picks the contact most likely to own the buying decision at an account.
 *
 * Prefers the titles the seller named in their own ICP, because they know who
 * signs for what they sell and a hard-coded list cannot. Only when no ICP has
 * been filled in does it fall back to the generic hints above. An ICP title
 * match outranks a generic one, so a workspace that has done the setup never
 * loses to the fallback.
 *
 * Returns the first linked contact when nothing matches, or null if the
 * account has none yet.
 */
export async function pickRecommendedContact(accountId: string) {
  const contacts = await db.prospect.findMany({ where: { accountId } });
  if (contacts.length === 0) return null;

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { orgId: true },
  });
  const icp = account
    ? await db.icpProfile.findUnique({
        where: { orgId: account.orgId },
        select: { buyerTitles: true },
      })
    : null;

  const icpHints = titleHints(icp?.buyerTitles);

  const scored = contacts
    .map((c) => {
      const position = c.position?.toLowerCase() ?? "";
      const matches = (hints: string[]) =>
        hints.some((hint) => position.includes(hint));
      // 2 beats 1 beats 0: a title the seller named outranks a generic one.
      const score = matches(icpHints) ? 2 : matches(DECISION_TITLE_HINTS) ? 1 : 0;
      return { contact: c, score };
    })
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

  // Either a sandbox workspace or a sample contact suppresses the send. The
  // rest of this function is unchanged, so the draft still transitions to
  // SENT and the audit trail still records it — the demo exercises the real
  // code path, it just never reaches a real inbox.
  const sandbox = isSimulated({
    orgIsSample: session.org.isSample,
    recordIsSample: draft.prospect.isSample,
  });

  const result = await sendEmail({
    to: draft.prospect.email,
    subject: draft.subject,
    body: draft.body,
    orgApiKey: session.org.settings?.resendApiKey,
    sandbox,
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
    result.sandbox
      ? "Simulated send — sample data is never delivered to a real inbox."
      : result.simulated
        ? "Simulated send (no Resend key configured)."
        : "Sent via Resend.",
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
