"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { requirePermission } from "@/lib/security/rbac";
import { recordAudit } from "@/lib/security/audit";
import {
  readConfig,
  revokeSlack,
  SLACK_PROVIDER,
} from "@/lib/integrations/slack/oauth";
import { listChannels, type SlackChannel } from "@/lib/integrations/slack/client";
import { composeDailyDigest } from "@/lib/notifications/digest";
import { deliverNotification } from "@/lib/notifications/send";

/** Channels the installed bot can post to. */
export async function slackChannels(): Promise<ActionResult<SlackChannel[]>> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");
    return { ok: true, data: await listChannels(session.orgId) };
  } catch (e) {
    return actionError(e, "Could not read your Slack channels.");
  }
}

const channelInput = z.object({
  channelId: z.string().min(1).max(64),
  channelName: z.string().min(1).max(120),
});

export async function setSlackChannel(
  input: z.input<typeof channelInput>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");
    const parsed = channelInput.parse(input);

    const connection = await db.integrationConnection.findUnique({
      where: { orgId_provider: { orgId: session.orgId, provider: SLACK_PROVIDER } },
      select: { id: true, config: true },
    });
    if (!connection) return { ok: false, error: "Slack is not connected." };

    await db.integrationConnection.update({
      where: { id: connection.id },
      data: {
        config: JSON.stringify({
          ...readConfig(connection.config),
          channelId: parsed.channelId,
          channelName: parsed.channelName,
        }),
      },
    });

    revalidatePath("/intent");
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not save the channel.");
  }
}

/**
 * Posts the current digest to the chosen channel.
 *
 * Runs the real composer and the real delivery path — including the dedupe
 * key, the daily ceiling and the sandbox rule — so a test post cannot look
 * different from a scheduled one. Only the dedupe key differs, because a
 * test is deliberately a second copy.
 */
export async function sendSlackTest(): Promise<ActionResult<string>> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    const message = await composeDailyDigest({ orgId: session.orgId, timezone: "UTC" });
    if (!message) {
      return {
        ok: false,
        error: "There is nothing to report yet — add accounts or run an analysis first.",
      };
    }

    const outcome = await deliverNotification({
      orgId: session.orgId,
      userId: session.id,
      channel: "slack",
      toAddress: "slack",
      workspaceName: session.org.name,
      orgIsSample: session.org.isSample,
      message: { ...message, dedupeKey: `slack-test:${Date.now()}` },
    });

    revalidatePath("/intent");
    switch (outcome.status) {
      case "sent":
        return {
          ok: true,
          data: outcome.simulated
            ? "Composed and recorded — not posted, because this workspace simulates sending."
            : "Posted to your Slack channel.",
        };
      case "rate_limited":
        return { ok: false, error: "You have hit today's notification limit." };
      case "duplicate":
        return { ok: false, error: "That post has already been sent." };
      case "failed":
        return { ok: false, error: outcome.reason };
    }
  } catch (e) {
    return actionError(e, "Could not post to Slack.");
  }
}

export async function disconnectSlack(): Promise<ActionResult<string>> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    await revokeSlack(session.orgId);
    await recordAudit({
      orgId: session.orgId,
      actorId: session.id,
      actorType: "user",
      action: "integration.revoked",
      targetType: "integration",
      targetId: "slack",
    });

    revalidatePath("/intent");
    return { ok: true, data: "Slack disconnected." };
  } catch (e) {
    return actionError(e, "Could not disconnect Slack.");
  }
}
