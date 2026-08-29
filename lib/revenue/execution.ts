import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { isSimulated } from "@/lib/sandbox";
import { recordAudit } from "@/lib/security/audit";
import { ACTION_LABELS, type ActionType } from "@/lib/revenue/config";
import type { EnrichedOpportunity } from "@/lib/revenue/queries";

/**
 * Turning a recommendation into something a person can approve.
 *
 * This is the step the product was missing. Selryn could say what to do and
 * could record that it had been done, but the doing itself happened somewhere
 * else — which meant the approval promise ("nothing customer-facing goes out
 * unreviewed") had nothing to review, and `humanEdited` was a field nothing
 * could ever set honestly.
 *
 * Three rules hold here:
 *
 *  1. The draft and the sent version are stored separately, so whether a
 *     human changed it is measured rather than asserted.
 *  2. Approval is a distinct, recorded act with an approver and a timestamp.
 *     Rejection records a reason, because a rejected recommendation is the
 *     most informative thing a user can tell the learning layer.
 *  3. Sending consults `lib/sandbox.ts` and nothing else. A sandbox workspace
 *     runs this whole path and delivers nothing.
 */

export interface DraftedAction {
  actionType: ActionType;
  channel: string;
  summary: string;
  subject: string;
  body: string;
  /** Who it is addressed to, and why them. */
  destination: string | null;
  recipientName: string | null;
  /** Present when there is no one to send to. */
  blocked: string | null;
}

const GREETING = (name: string | null) => (name ? `Hi ${name.split(/\s+/)[0]},` : "Hi,");

/**
 * Composes the message from the evidence already on the opportunity.
 *
 * Template-based on purpose. A model could write warmer prose, but every
 * sentence here has to be traceable to a signal the user can see on the same
 * screen — and a draft that quietly invents a detail is worse than a plain
 * one the rep edits. `lib/ai.ts` is the seam for improving this later.
 */
export function draftFor(opp: EnrichedOpportunity): DraftedAction {
  const action = opp.nextAction;
  const contact = opp.contact;
  const first = contact?.name.split(/\s+/)[0] ?? null;
  const leak = opp.primaryLeak;

  const why =
    leak?.summary ??
    opp.whyNow[0]?.replace(/^[+−-]\s*/, "") ??
    "the evaluation is still open";

  const bodies: Partial<Record<ActionType, { subject: string; body: string }>> = {
    follow_up: {
      subject: `Following up on ${opp.account.name}`,
      body: `${GREETING(contact?.name ?? null)}\n\nChecking in on where things stand — ${why.toLowerCase()}.\n\nIs there anything outstanding I can get to you, or a question the team still has open?\n\nHappy to jump on a short call if that is faster.`,
    },
    book_meeting: {
      subject: "Time for the next step?",
      body: `${GREETING(contact?.name ?? null)}\n\nWe have not got the next session in the diary yet — ${why.toLowerCase()}.\n\nWould later this week or early next suit you better? I will work around your team.`,
    },
    send_case_study: {
      subject: "A comparable rollout, if useful",
      body: `${GREETING(contact?.name ?? null)}\n\nThought this might help while you are evaluating — ${why.toLowerCase()}.\n\nI can share how a similar team ran their rollout, including what they got wrong first time. Worth a read?`,
    },
    send_proposal: {
      subject: `Proposal for ${opp.account.name}`,
      body: `${GREETING(contact?.name ?? null)}\n\nSending the proposal over — ${why.toLowerCase()}.\n\nIf anything in the scope or commercials needs adjusting, tell me and I will revise it rather than have you work around it.`,
    },
    reengage: {
      subject: "Still worth a conversation?",
      body: `${GREETING(contact?.name ?? null)}\n\nIt has gone quiet, and I would rather ask than assume — ${why.toLowerCase()}.\n\nIf the timing has moved, that is genuinely fine; just say and I will stop chasing. If it has not, I can pick up where we left off.`,
    },
  };

  const emailish = action.actionType !== "call";

  // A call is not a letter. Drafting "Hi Maya," for a phone call, and pasting
  // the internal rationale underneath it, produces something nobody would
  // ever say out loud — so calls get talking points addressed to the rep.
  const chosen = emailish
    ? bodies[action.actionType] ?? {
        subject: `${opp.account.name} — next step`,
        body: `${GREETING(contact?.name ?? null)}\n\n${action.rationale}\n\nLet me know how you would like to proceed.`,
      }
    : {
        subject: `Call ${contact?.name ?? opp.account.name}`,
        body: [
          `Call ${contact?.name ?? "the buyer"}${contact?.position ? ` (${contact.position})` : ""}.`,
          "",
          `Why now: ${why}`,
          "",
          "Talking points:",
          `· Reference the proposal directly rather than asking if they saw it.`,
          `· Ask what is outstanding internally — budget, security, or timing.`,
          `· Agree a specific next date before the call ends.`,
        ].join("\n"),
      };

  return {
    actionType: action.actionType,
    channel: emailish ? "email" : "call",
    summary: action.headline,
    subject: chosen.subject,
    body: chosen.body,
    destination: contact?.email ?? null,
    recipientName: first,
    blocked:
      emailish && !contact?.email
        ? `${opp.account.name} has no contact with an email address — add one before sending.`
        : null,
  };
}

export interface ApproveInput {
  orgId: string;
  userId: string;
  actionId: string;
  /** What the human actually wants sent, after any edits. */
  subject: string;
  body: string;
  orgIsSample: boolean;
  resendApiKey?: string | null;
}

export async function approveAndExecute(input: ApproveInput) {
  const action = await db.action.findFirst({
    where: { id: input.actionId, orgId: input.orgId },
    include: { contact: { select: { email: true, isSample: true, name: true } } },
  });
  if (!action) throw new Error("That action no longer exists.");
  if (action.executionStatus !== "PROPOSED") {
    throw new Error(`This action is already ${action.executionStatus.toLowerCase()}.`);
  }

  const edited =
    input.subject.trim() !== (action.draftSubject ?? "").trim() ||
    input.body.trim() !== (action.draftBody ?? "").trim();

  // Either the workspace or the recipient being sample data suppresses the
  // send. The second half is what protects a real customer who loaded sample
  // data from mailing a person who does not exist.
  const sandbox = isSimulated({
    orgIsSample: input.orgIsSample,
    recordIsSample: action.contact?.isSample,
  });

  const now = new Date();
  let simulated = sandbox;

  if (action.channel === "email") {
    if (!action.contact?.email) {
      throw new Error("There is no contact email on this opportunity.");
    }
    const result = await sendEmail({
      to: action.contact.email,
      subject: input.subject,
      body: input.body,
      orgApiKey: input.resendApiKey,
      sandbox,
    });
    simulated = result.simulated;
  }

  const executed = await db.action.update({
    where: { id: action.id },
    data: {
      executionStatus: "EXECUTED",
      approvedAt: now,
      approvedBy: input.userId,
      executedAt: now,
      humanEdited: edited,
      sentSubject: input.subject,
      content: input.body,
      simulated,
    },
  });

  await recordAudit({
    orgId: input.orgId,
    actorId: input.userId,
    actorType: "user",
    action: "action.executed",
    targetType: "action",
    targetId: action.id,
    metadata: {
      actionType: action.actionType,
      channel: action.channel,
      destination: action.destination,
      humanEdited: edited,
      simulated,
    },
  });

  return { action: executed, simulated, humanEdited: edited };
}

export async function rejectAction(input: {
  orgId: string;
  userId: string;
  actionId: string;
  reason: string;
}) {
  const action = await db.action.findFirst({
    where: { id: input.actionId, orgId: input.orgId },
    select: { id: true, executionStatus: true, actionType: true },
  });
  if (!action) throw new Error("That action no longer exists.");
  if (action.executionStatus !== "PROPOSED") {
    throw new Error(`This action is already ${action.executionStatus.toLowerCase()}.`);
  }

  const rejected = await db.action.update({
    where: { id: action.id },
    data: {
      executionStatus: "REJECTED",
      decisionReason: input.reason.slice(0, 500),
      approvedBy: input.userId,
      approvedAt: new Date(),
    },
  });

  await recordAudit({
    orgId: input.orgId,
    actorId: input.userId,
    actorType: "user",
    action: "action.rejected",
    targetType: "action",
    targetId: action.id,
    metadata: { actionType: action.actionType, reason: input.reason.slice(0, 500) },
  });

  return rejected;
}

/** One line describing what a drafted action will do, for the approval UI. */
export function executionSummary(draft: DraftedAction, sandbox: boolean): string {
  if (draft.blocked) return draft.blocked;
  const label = ACTION_LABELS[draft.actionType] ?? "Take the action";
  if (draft.channel !== "email") {
    return `${label} — logged against this opportunity. Nothing is sent.`;
  }
  return sandbox
    ? `Simulated send to ${draft.destination}. No email will actually be delivered.`
    : `Sends to ${draft.destination} from your workspace's sending address.`;
}
