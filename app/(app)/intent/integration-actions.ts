"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { requirePermission } from "@/lib/security/rbac";
import { recordAudit } from "@/lib/security/audit";
import { HUBSPOT_PROVIDER, revokeConnection } from "@/lib/integrations/hubspot/oauth";
import { enqueueSync } from "@/lib/integrations/sync-runner";

/**
 * Operating a live integration: resync and disconnect.
 *
 * Both are permissioned as `integration:connect` — the same authority that
 * granted the access. Someone who may not connect a CRM may not disconnect
 * one either, because severing a data source is as disruptive as adding one.
 */

const SYNCED_OBJECTS = ["owners", "companies", "contacts", "deals"] as const;

/**
 * Queues a fresh incremental pass over every object type.
 *
 * Incremental rather than a full backfill: a customer clicking "Sync now"
 * wants to see today's changes, not to re-read forty thousand deals and burn
 * their API quota. The queue de-duplicates, so double-clicking is harmless.
 */
export async function resyncHubspot(): Promise<ActionResult<string>> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    if (session.org.isSample) {
      return { ok: false, error: "Sandbox workspaces have no CRM connected." };
    }

    const connection = await db.integrationConnection.findFirst({
      where: { orgId: session.orgId, provider: HUBSPOT_PROVIDER },
      select: { id: true, status: true },
    });
    if (!connection) return { ok: false, error: "HubSpot is not connected." };
    if (connection.status !== "ACTIVE") {
      return {
        ok: false,
        error: "The HubSpot connection needs to be re-authorized before it can sync.",
      };
    }

    for (const objectType of SYNCED_OBJECTS) {
      await enqueueSync({
        orgId: session.orgId,
        connectionId: connection.id,
        objectType,
        kind: "incremental",
      });
    }

    revalidatePath("/intent");
    return { ok: true, data: "Sync queued — it runs within the hour." };
  } catch (e) {
    return actionError(e, "Could not queue a sync.");
  }
}

/**
 * Disconnects HubSpot and forgets the tokens.
 *
 * Records already synced are kept: they are the customer's own data, now part
 * of their Selryn pipeline, and silently deleting them because a credential
 * was revoked would destroy work. Removing them is a separate, explicit act.
 */
export async function disconnectHubspot(): Promise<ActionResult<string>> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    await revokeConnection(session.orgId);

    await recordAudit({
      orgId: session.orgId,
      actorId: session.id,
      actorType: "user",
      action: "integration.revoked",
      targetType: "integration",
      targetId: HUBSPOT_PROVIDER,
      metadata: { keptSyncedRecords: true },
    });

    revalidatePath("/intent");
    return {
      ok: true,
      data: "HubSpot disconnected. Records already synced are kept.",
    };
  } catch (e) {
    return actionError(e, "Could not disconnect HubSpot.");
  }
}
