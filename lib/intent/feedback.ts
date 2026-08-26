import "server-only";
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/auth";

export const FEEDBACK_LABELS = [
  "relevant",
  "not_relevant",
  "meeting_booked",
  "qualified",
  "won",
] as const;
export type FeedbackLabel = (typeof FEEDBACK_LABELS)[number];

const OUTCOME_STAGE_MAP: Partial<Record<FeedbackLabel, string>> = {
  meeting_booked: "meeting_booked",
  qualified: "qualified",
  won: "won",
};

/**
 * Records the user's judgment on a recommendation — the training signal
 * for future scoring (which signal types actually led to relevant/won
 * outcomes). Funnel-stage labels also write an Outcome row so
 * "reply → meeting → qualified → won/lost" can be analyzed as a whole later.
 */
export async function recordFeedback(
  session: SessionContext,
  accountId: string,
  label: FeedbackLabel,
  opts?: { draftId?: string; note?: string }
) {
  const account = await db.account.findFirst({ where: { id: accountId, orgId: session.orgId } });
  if (!account) throw new Error("Account not found");

  const feedback = await db.userFeedback.create({
    data: {
      orgId: session.orgId,
      accountId,
      draftId: opts?.draftId ?? null,
      label,
      note: opts?.note ?? null,
      createdBy: session.id,
    },
  });

  const outcomeStage = OUTCOME_STAGE_MAP[label];
  if (outcomeStage) {
    await db.outcome.create({
      data: {
        orgId: session.orgId,
        accountId,
        draftId: opts?.draftId ?? null,
        stage: outcomeStage,
        detail: opts?.note ?? null,
      },
    });
  }

  await db.agentAction.create({
    data: {
      orgId: session.orgId,
      type: "record_intent_feedback",
      status: "DONE",
      title: `Marked ${account.name} as "${label}"`,
      accountId,
      requestedBy: session.id,
      decidedBy: session.id,
      decidedAt: new Date(),
      executedAt: new Date(),
    },
  });

  return feedback;
}

/** Explicit lost/won-outside-the-5-labels stage (e.g. from a CRM sync later). */
export async function recordOutcome(
  session: SessionContext,
  accountId: string,
  stage: "reply" | "meeting_booked" | "qualified" | "won" | "lost",
  detail?: string
) {
  const account = await db.account.findFirst({ where: { id: accountId, orgId: session.orgId } });
  if (!account) throw new Error("Account not found");
  return db.outcome.create({
    data: { orgId: session.orgId, accountId, stage, detail: detail ?? null },
  });
}
