import "server-only";
import { db } from "@/lib/db";
import { ingestEvents } from "@/lib/events/ingest";
import type { ParsedDeal } from "@/lib/import/deals";

/**
 * Writing an imported pipeline into a workspace.
 *
 * Every write is keyed on `(orgId, externalSource, externalId)`, which the
 * schema already enforces as unique. That is the whole idempotency story: a
 * customer who fixes two rows and uploads the same file again updates the
 * deals they already have instead of doubling their pipeline, and the natural
 * recovery from a failed import stops being destructive.
 *
 * Provenance is recorded rather than implied. Each imported deal writes a
 * RevenueEvent carrying where it came from, when the real-world contact
 * happened (`occurredAt`) and when Selryn received it (`receivedAt`), so the
 * freshness warnings and the evidence panels have something true to read.
 */

export const IMPORT_SOURCE = "csv_import";

export interface ApplyReport {
  created: number;
  updated: number;
  accountsCreated: number;
  contactsCreated: number;
  /** Rows that parsed but could not be written, with the reason. */
  failures: { row: number; message: string }[];
}

/** Stable per workspace, so re-importing the same company reuses its account. */
function accountKey(company: string): string {
  return company.trim().toLowerCase();
}

export async function applyImportedDeals(
  orgId: string,
  deals: ParsedDeal[],
  opts: { importedAt?: Date } = {}
): Promise<ApplyReport> {
  const importedAt = opts.importedAt ?? new Date();
  const report: ApplyReport = {
    created: 0,
    updated: 0,
    accountsCreated: 0,
    contactsCreated: 0,
    failures: [],
  };
  if (deals.length === 0) return report;

  const events: Parameters<typeof ingestEvents>[0] = [];

  for (const deal of deals) {
    try {
      // ── Account ──
      const account = await db.account.upsert({
        where: {
          orgId_externalSource_externalId: {
            orgId,
            externalSource: IMPORT_SOURCE,
            externalId: accountKey(deal.company),
          },
        },
        update: { name: deal.company },
        create: {
          orgId,
          externalSource: IMPORT_SOURCE,
          externalId: accountKey(deal.company),
          name: deal.company,
          source: "imported",
        },
        select: { id: true, createdAt: true, updatedAt: true },
      });
      if (account.createdAt.getTime() === account.updatedAt.getTime()) {
        report.accountsCreated++;
      }

      // ── Contact ──
      // Only when an address is present: Prospect requires one, and inventing
      // a placeholder would put an unsendable address in a contact list.
      let contactId: string | null = null;
      if (deal.contactEmail) {
        const contact = await db.prospect.upsert({
          where: {
            orgId_externalSource_externalId: {
              orgId,
              externalSource: IMPORT_SOURCE,
              externalId: deal.contactEmail,
            },
          },
          update: {
            name: deal.contactName ?? undefined,
            accountId: account.id,
          },
          create: {
            orgId,
            externalSource: IMPORT_SOURCE,
            externalId: deal.contactEmail,
            name: deal.contactName ?? deal.contactEmail.split("@")[0],
            company: deal.company,
            email: deal.contactEmail,
            accountId: account.id,
          },
          select: { id: true, createdAt: true, updatedAt: true },
        });
        contactId = contact.id;
        if (contact.createdAt.getTime() === contact.updatedAt.getTime()) {
          report.contactsCreated++;
        }
      }

      // ── Opportunity ──
      const existing = await db.opportunity.findUnique({
        where: {
          orgId_externalSource_externalId: {
            orgId,
            externalSource: IMPORT_SOURCE,
            externalId: deal.externalId,
          },
        },
        select: {
          id: true,
          stage: true,
          dealValue: true,
          currency: true,
          lastInteractionAt: true,
          nextStepDueAt: true,
        },
      });

      const shared = {
        name: `${deal.company} — ${deal.externalId}`,
        stage: deal.stage,
        currency: deal.currency,
        lastInteractionAt: deal.lastContactedAt,
        nextStepDueAt: deal.nextStepAt,
        accountId: account.id,
        primaryContactId: contactId,
        closedAt: deal.stage === "WON" || deal.stage === "LOST" ? importedAt : null,
      };

      // A blank amount leaves whatever is on record alone rather than
      // overwriting a known figure with nothing.
      const amountFields =
        deal.amount === null
          ? {}
          : { dealValue: deal.amount, dealValueBasis: "user_entered" as const };

      const opportunity = existing
        ? await db.opportunity.update({
            where: { id: existing.id },
            data: { ...shared, ...amountFields },
            select: { id: true, accountId: true },
          })
        : await db.opportunity.create({
            data: {
              orgId,
              externalSource: IMPORT_SOURCE,
              externalId: deal.externalId,
              source: "imported",
              dealValue: deal.amount ?? 0,
              dealValueBasis: deal.amount === null ? "icp_midpoint" : "user_entered",
              ...shared,
            },
            select: { id: true, accountId: true },
          });

      if (existing) report.updated++;
      else report.created++;

      // Only record a change when something changed. Re-uploading the same
      // file is the normal way to fix two rows, and writing an identical
      // "updated" event every time would fill the provenance log with
      // repetitions of a thing that did not happen.
      const changed =
        !existing ||
        existing.stage !== deal.stage ||
        existing.currency !== deal.currency ||
        (deal.amount !== null && existing.dealValue !== deal.amount) ||
        existing.lastInteractionAt?.getTime() !== deal.lastContactedAt?.getTime() ||
        existing.nextStepDueAt?.getTime() !== deal.nextStepAt?.getTime();

      if (!changed) continue;

      events.push({
        orgId,
        accountId: opportunity.accountId,
        contactId,
        opportunityId: opportunity.id,
        source: IMPORT_SOURCE,
        sourceEventId: `${deal.externalId}:${deal.stage}`,
        eventType: existing ? "deal.updated" : "deal.imported",
        // When the contact actually happened, falling back to the import
        // itself when the file says nothing — never a guess at a date.
        occurredAt: deal.lastContactedAt ?? importedAt,
        actorType: "system",
        normalizedProperties: {
          stage: deal.stage,
          amount: deal.amount,
          currency: deal.currency,
          importedAt: importedAt.toISOString(),
          row: deal.row,
        },
      });
    } catch (err) {
      report.failures.push({
        row: deal.row,
        message: err instanceof Error ? err.message : "Could not save this row.",
      });
    }
  }

  if (events.length > 0) await ingestEvents(events);
  return report;
}
