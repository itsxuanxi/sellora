import "server-only";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/security/audit";

/**
 * What happens to synced CRM data when a customer disconnects.
 *
 * The policy is written here rather than implied by whatever the code does,
 * because "we delete your data on disconnect" and "we keep it" are both
 * defensible and only one of them can be true. Stating it in the module that
 * implements it is the only way the two stay in step.
 *
 * The wording lives in `retention-policy.ts` so the dialog the customer reads
 * and the code that deletes cannot drift apart.
 *
 * ── Stated policy ──
 *
 * Disconnecting always destroys the credentials, immediately and
 * irreversibly. That is the thing a customer revoking access is actually
 * asking for, and it is never optional.
 *
 * Records already synced are kept by default. They are the agency's own
 * pipeline — companies, contacts, deals they have since worked inside Selryn
 * — and silently deleting them because a token was revoked would destroy
 * work that has nothing to do with the credential.
 *
 * A customer may instead ask for them to be erased, and then they are, along
 * with the Selryn records attached to them: a drafted follow-up or an
 * extracted fact cannot outlive the deal it describes. The audit log is
 * retained in both cases — it records that the deletion happened and is the
 * one thing that would be worth least if it could be deleted on request.
 */

export { RETENTION_POLICY } from "@/lib/integrations/retention-policy";

export interface PurgeReport {
  opportunities: number;
  accounts: number;
  prospects: number;
  events: number;
}

/**
 * Erases everything that came from one provider.
 *
 * Deletes in dependency order. Opportunities and accounts cascade to the
 * Selryn rows that hang off them (follow-ups, extracted facts, signals), so
 * those are removed as a consequence rather than needing to be hunted down —
 * and a record that cannot be traced to a deal is not left behind pointing
 * at nothing.
 */
export async function purgeSyncedRecords(
  orgId: string,
  provider: string,
  opts: { actorId?: string | null } = {}
): Promise<PurgeReport> {
  // Events first: they reference deals and contacts, and keeping orphans
  // would leave the "why now" evidence citing records that no longer exist.
  const events = await db.revenueEvent.deleteMany({ where: { orgId, source: provider } });

  const opportunities = await db.opportunity.deleteMany({
    where: { orgId, externalSource: provider },
  });

  // Prospects carry two sources from HubSpot — contacts and the Leads
  // object — so both are matched rather than only the provider name.
  const prospects = await db.prospect.deleteMany({
    where: { orgId, externalSource: { startsWith: provider } },
  });

  const accounts = await db.account.deleteMany({
    where: { orgId, externalSource: provider },
  });

  const report: PurgeReport = {
    opportunities: opportunities.count,
    accounts: accounts.count,
    prospects: prospects.count,
    events: events.count,
  };

  await recordAudit({
    orgId,
    actorId: opts.actorId ?? null,
    actorType: "user",
    action: "data.exported",
    targetType: "integration",
    targetId: provider,
    // Counts only. The audit log records that a deletion happened and how
    // much it covered, never the contents of what was deleted.
    metadata: { deleted: report, reason: "disconnect_with_erase" },
  });

  return report;
}
