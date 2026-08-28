import "server-only";
import { db } from "@/lib/db";
import { redact } from "@/lib/security/crypto";

/**
 * The audit log.
 *
 * Append-only by contract: nothing here updates or deletes. An audit trail the
 * application can rewrite is decoration, and the events most worth recording
 * are exactly the ones somebody might later want gone.
 *
 * Writes never throw. A failed audit write must not roll back the action it
 * was describing - losing the record of a successful CRM write is bad, but
 * failing the write because the record failed is worse. Failures are logged
 * loudly instead, so the gap is visible in monitoring.
 */

export type AuditAction =
  // Integrations - standing access to a customer's systems
  | "integration.connect_started"
  | "integration.connected"
  | "integration.reauth_required"
  | "integration.revoked"
  | "integration.sync_failed"
  // Anything reaching a buyer or writing to the customer's CRM
  | "action.approved"
  | "action.rejected"
  | "action.executed"
  | "action.execution_failed"
  | "action.undone"
  // Data leaving the tenant
  | "data.exported"
  | "org.deleted"
  // Access changes
  | "member.invited"
  | "member.role_changed"
  | "member.removed"
  // Identity decisions that alter what Selryn believes
  | "identity.manual_override";

export interface AuditEntry {
  orgId: string;
  action: AuditAction;
  actorId?: string | null;
  actorType?: "user" | "system" | "integration";
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  traceId?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        orgId: entry.orgId,
        action: entry.action,
        actorId: entry.actorId ?? null,
        actorType: entry.actorType ?? "user",
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        // Redacted on the way in, not on the way out. A token that reaches the
        // table is already leaked, whatever the reader does with it.
        metadata: entry.metadata ? JSON.stringify(redact(entry.metadata)) : null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 400) ?? null,
        traceId: entry.traceId ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] FAILED TO RECORD", {
      orgId: entry.orgId,
      action: entry.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Reads the trail for the settings screen. Tenant-scoped, newest first. */
export async function listAudit(
  orgId: string,
  opts: { limit?: number; action?: AuditAction } = {}
) {
  return db.auditLog.findMany({
    where: { orgId, ...(opts.action ? { action: opts.action } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.limit ?? 50, 200),
  });
}
