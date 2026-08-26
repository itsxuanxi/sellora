"use server";

import { revalidatePath } from "next/cache";
import {
  approveAction as approve,
  rejectAction as reject,
  retryAction as retry,
  undoAction as undo,
} from "@/lib/agent";
import { requireSession } from "@/lib/auth";
import { actionError, type ActionResult } from "@/lib/types";

function revalidateAgentViews() {
  revalidatePath("/agent");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}

async function run(fn: () => Promise<unknown>, fallback: string): Promise<ActionResult> {
  try {
    await fn();
    revalidateAgentViews();
    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : fallback;
    return actionError(err, message);
  }
}

export async function approveAgentAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  return run(() => approve(session, id), "Could not approve the action.");
}

export async function rejectAgentAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  return run(() => reject(session, id), "Could not reject the action.");
}

export async function retryAgentAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  return run(() => retry(session, id), "Could not retry the action.");
}

export async function undoAgentAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  return run(() => undo(session, id), "Could not undo the action.");
}
