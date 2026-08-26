import "server-only";
import type { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/activity";
import { researchAccount, scoreAccount } from "@/lib/agent-ai";
import type { SessionContext } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * The agent action engine. Every agent operation is an AgentAction row —
 * the approval queue and the audit trail are the same data.
 *
 * Autonomy modes (IcpProfile.autonomy):
 *  - "suggest":   actions are created as SUGGESTED and never auto-executed
 *  - "approve":   actions wait as PENDING_APPROVAL until a human decides
 *  - "autopilot": actions execute immediately (still fully audited)
 */

export type AgentActionType =
  | "research_account"
  | "score_account"
  | "send_email"
  | "generate_icp"
  | "import_accounts";

export const EXECUTABLE_STATUSES = ["PENDING_APPROVAL", "SUGGESTED"] as const;

export async function getAutonomy(orgId: string): Promise<string> {
  const icp = await db.icpProfile.findUnique({ where: { orgId } });
  return icp?.autonomy ?? "approve";
}

/** Creates an action honoring the org's autonomy mode; executes it when allowed. */
export async function createAgentAction(
  session: SessionContext,
  input: {
    type: AgentActionType;
    title: string;
    detail?: string;
    payload?: Record<string, unknown>;
    accountId?: string;
    prospectId?: string;
    requestedBy?: string;
    /** Force immediate execution regardless of autonomy (used for explicit user clicks). */
    executeNow?: boolean;
  }
) {
  const autonomy = await getAutonomy(session.orgId);
  const initialStatus = input.executeNow
    ? "RUNNING"
    : autonomy === "autopilot"
      ? "RUNNING"
      : autonomy === "suggest"
        ? "SUGGESTED"
        : "PENDING_APPROVAL";

  const action = await db.agentAction.create({
    data: {
      orgId: session.orgId,
      type: input.type,
      status: initialStatus,
      title: input.title,
      detail: input.detail ?? null,
      payload: input.payload ? JSON.stringify(input.payload) : null,
      accountId: input.accountId ?? null,
      prospectId: input.prospectId ?? null,
      requestedBy: input.requestedBy ?? session.id,
      ...(initialStatus === "RUNNING" ? { decidedBy: "autopilot", decidedAt: new Date() } : {}),
    },
  });

  if (initialStatus === "RUNNING") {
    return executeAction(session, action.id);
  }
  return action;
}

/** Approves a queued action and executes it. */
export async function approveAction(session: SessionContext, actionId: string) {
  const action = await db.agentAction.findFirst({
    where: { id: actionId, orgId: session.orgId },
  });
  if (!action) throw new Error("Action not found");
  if (!EXECUTABLE_STATUSES.includes(action.status as (typeof EXECUTABLE_STATUSES)[number])) {
    throw new Error(`Action is ${action.status.toLowerCase()} — nothing to approve`);
  }
  await db.agentAction.update({
    where: { id: actionId },
    data: { status: "RUNNING", decidedBy: session.id, decidedAt: new Date() },
  });
  return executeAction(session, actionId);
}

export async function rejectAction(session: SessionContext, actionId: string) {
  const { count } = await db.agentAction.updateMany({
    where: {
      id: actionId,
      orgId: session.orgId,
      status: { in: [...EXECUTABLE_STATUSES] },
    },
    data: { status: "CANCELED", decidedBy: session.id, decidedAt: new Date() },
  });
  if (count === 0) throw new Error("Action not found or already decided");
}

export async function retryAction(session: SessionContext, actionId: string) {
  const action = await db.agentAction.findFirst({
    where: { id: actionId, orgId: session.orgId, status: "FAILED" },
  });
  if (!action) throw new Error("Only failed actions can be retried");
  await db.agentAction.update({
    where: { id: actionId },
    data: { status: "RUNNING", error: null, decidedBy: session.id, decidedAt: new Date() },
  });
  return executeAction(session, actionId);
}

/**
 * Undo: reverts effects where genuinely reversible (research/score restore
 * the previous field values stashed at execution time). Sent emails cannot
 * be unsent — undo is not offered for those.
 */
export async function undoAction(session: SessionContext, actionId: string) {
  const action = await db.agentAction.findFirst({
    where: { id: actionId, orgId: session.orgId, status: "DONE" },
  });
  if (!action) throw new Error("Only completed actions can be undone");
  if (!["research_account", "score_account"].includes(action.type)) {
    throw new Error("This action type can't be undone");
  }
  const payload = action.payload ? JSON.parse(action.payload) : {};
  const prev = payload.prev as Record<string, unknown> | undefined;
  if (action.accountId && prev) {
    await db.account.update({ where: { id: action.accountId }, data: prev });
  }
  await db.agentAction.update({
    where: { id: actionId },
    data: { status: "UNDONE", undoneAt: new Date() },
  });
}

/** Executes a RUNNING action. Failures are recorded, never thrown to the UI. */
export async function executeAction(session: SessionContext, actionId: string) {
  const action = await db.agentAction.findFirst({
    where: { id: actionId, orgId: session.orgId },
  });
  if (!action) throw new Error("Action not found");

  try {
    let result: Record<string, unknown> = {};
    const payload = action.payload ? JSON.parse(action.payload) : {};

    if (action.type === "research_account" && action.accountId) {
      const account = await db.account.findUniqueOrThrow({ where: { id: action.accountId } });
      const contacts = await db.prospect.findMany({ where: { accountId: account.id } });
      const icp = await db.icpProfile.findUnique({ where: { orgId: session.orgId } });
      const { data, source } = await researchAccount(
        account,
        contacts,
        icp,
        session.org,
        session.org.settings?.openaiApiKey
      );
      // stash previous values for undo
      payload.prev = {
        summary: account.summary,
        painHypotheses: account.painHypotheses,
        recommendedAngle: account.recommendedAngle,
        signals: account.signals,
        sources: account.sources,
        confidence: account.confidence,
        researchedAt: account.researchedAt,
      };
      await db.account.update({
        where: { id: account.id },
        data: {
          summary: data.summary,
          painHypotheses: data.painHypotheses,
          recommendedAngle: data.recommendedAngle,
          signals: JSON.stringify(data.signals),
          sources: data.sources,
          confidence: data.confidence,
          researchedAt: new Date(),
        },
      });
      result = { source, confidence: data.confidence };
      await logActivity({
        orgId: session.orgId,
        type: "ai_generated",
        description: `Agent researched ${account.name} (confidence: ${data.confidence})`,
      });
    } else if (action.type === "score_account" && action.accountId) {
      const account = await db.account.findUniqueOrThrow({ where: { id: action.accountId } });
      const contacts = await db.prospect.findMany({
        where: { accountId: account.id },
        include: { emails: { select: { status: true } } },
      });
      const icp = await db.icpProfile.findUnique({ where: { orgId: session.orgId } });
      const emails = contacts.flatMap((c) => c.emails);
      const engagement = {
        sent: emails.filter((e) => e.status !== "DRAFT").length,
        opened: emails.filter((e) => ["OPENED", "REPLIED"].includes(e.status)).length,
        replied: emails.filter((e) => e.status === "REPLIED").length,
        meetings: contacts.filter((c) => ["MEETING", "PROPOSAL", "WON"].includes(c.stage)).length,
      };
      const score = scoreAccount(account, icp, engagement);
      payload.prev = {
        fitScore: account.fitScore,
        intentScore: account.intentScore,
        scoreRationale: account.scoreRationale,
        scoredAt: account.scoredAt,
      };
      await db.account.update({
        where: { id: account.id },
        data: {
          fitScore: score.fitScore,
          intentScore: score.intentScore,
          scoreRationale: score.rationale,
          scoredAt: new Date(),
        },
      });
      result = { fitScore: score.fitScore, intentScore: score.intentScore };
    } else {
      throw new Error(`Unknown or incomplete action: ${action.type}`);
    }

    return db.agentAction.update({
      where: { id: actionId },
      data: {
        status: "DONE",
        executedAt: new Date(),
        payload: JSON.stringify(payload),
        result: JSON.stringify(result),
      },
    });
  } catch (err) {
    console.error(`[agent] action ${action.type} failed:`, err);
    return db.agentAction.update({
      where: { id: actionId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message.slice(0, 500) : "Unknown error",
      },
    });
  }
}

/** Command Center data: one query pass over the agent + CRM state. */
export async function getCommandCenterData(session: SessionContext) {
  const orgId = session.orgId;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const staleCutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const [
    doneToday,
    running,
    pending,
    suggested,
    failed,
    hotAccounts,
    recentReplies,
    meetings,
    stalled,
    icp,
    accountCount,
  ] = await Promise.all([
    db.agentAction.findMany({
      where: { orgId, status: "DONE", executedAt: { gte: todayStart } },
      orderBy: { executedAt: "desc" },
      take: 8,
      include: { account: { select: { name: true } } },
    }),
    db.agentAction.findMany({
      where: { orgId, status: "RUNNING" },
      take: 5,
      include: { account: { select: { name: true } } },
    }),
    db.agentAction.findMany({
      where: { orgId, status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: { account: { select: { name: true } } },
    }),
    db.agentAction.findMany({
      where: { orgId, status: "SUGGESTED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { account: { select: { name: true } } },
    }),
    db.agentAction.count({ where: { orgId, status: "FAILED" } }),
    db.account.findMany({
      where: { orgId, fitScore: { not: null } },
      orderBy: [{ intentScore: { sort: "desc", nulls: "last" } }, { fitScore: "desc" }],
      take: 5,
      include: { _count: { select: { prospects: true } } },
    }),
    db.email.findMany({
      where: { orgId, status: "REPLIED" },
      orderBy: { repliedAt: "desc" },
      take: 5,
      include: { prospect: { select: { name: true, company: true, id: true } } },
    }),
    db.prospect.count({ where: { orgId, stage: { in: ["MEETING", "PROPOSAL"] } } }),
    db.prospect.findMany({
      where: {
        orgId,
        stage: { in: ["CONTACTED", "INTERESTED"] },
        updatedAt: { lt: staleCutoff },
      },
      orderBy: { updatedAt: "asc" },
      take: 5,
    }),
    db.icpProfile.findUnique({ where: { orgId } }),
    db.account.count({ where: { orgId } }),
  ]);

  return {
    doneToday,
    running,
    pending,
    suggested,
    failed,
    hotAccounts,
    recentReplies,
    meetings,
    stalled,
    icp,
    accountCount,
  };
}
