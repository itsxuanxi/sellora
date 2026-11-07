import "server-only";
import { db } from "@/lib/db";

/**
 * Writing a synced mailbox into a workspace.
 *
 * Every write is keyed on `(orgId, source, externalId)`, which the schema
 * enforces as unique — the same contract the deal import and the event layer
 * use. A re-sync of an overlapping window updates what is already there
 * instead of doubling a conversation, which matters more here than anywhere
 * else in the product: mailbox syncs overlap by design, because the only safe
 * way to catch a message that arrived during the last run is to ask for a
 * window that reaches back behind it.
 *
 * Linking is by address, and only to contacts this workspace already has.
 * A message is attached to a deal when one of its participants is a known
 * contact; a message from someone Selryn has never heard of is stored
 * unlinked rather than guessed at, and surfaces nowhere until a contact with
 * that address exists. The alternative — creating contacts from whoever
 * appears in an inbox — turns a sales tool into an address book of
 * recruiters, suppliers and newsletters within a day.
 */

export interface IncomingMessage {
  source: string;
  externalId: string;
  threadId?: string | null;
  direction: "inbound" | "outbound";
  subject?: string | null;
  body?: string | null;
  snippet?: string | null;
  fromEmail: string;
  fromName?: string | null;
  toEmails?: string[] | null;
  occurredAt: Date;
}

export interface IngestReport {
  created: number;
  updated: number;
  /** Stored, but matched no contact in this workspace. */
  unlinked: number;
  failures: { externalId: string; message: string }[];
}

const normalize = (email: string) => email.trim().toLowerCase();

/**
 * Every address on a message, lowercased.
 *
 * Both ends are considered: an inbound message is matched on its sender, an
 * outbound one on its recipients, and checking all of them avoids a direction
 * bug silently unlinking half a mailbox.
 */
function addressesOf(message: IncomingMessage): string[] {
  return [...new Set([message.fromEmail, ...(message.toEmails ?? [])].map(normalize))].filter(
    Boolean
  );
}

export async function ingestMessages(
  orgId: string,
  messages: IncomingMessage[]
): Promise<IngestReport> {
  const report: IngestReport = { created: 0, updated: 0, unlinked: 0, failures: [] };
  if (messages.length === 0) return report;

  // One query for every address in the batch, rather than one per message.
  const everyAddress = [...new Set(messages.flatMap(addressesOf))];
  const contacts = await db.prospect.findMany({
    where: { orgId, email: { in: everyAddress } },
    select: { id: true, email: true, accountId: true },
  });
  const contactByEmail = new Map(
    contacts.filter((c) => c.email).map((c) => [normalize(c.email), c])
  );

  // The open deal to hang a message on, per account. A company with two live
  // deals is ambiguous and is left at the account: attaching a message to the
  // wrong opportunity is worse than attaching it to none, because the deal
  // page would then show evidence from a conversation about something else.
  const accountIds = [...new Set(contacts.map((c) => c.accountId).filter(Boolean))] as string[];
  const openDeals = accountIds.length
    ? await db.opportunity.findMany({
        where: { orgId, accountId: { in: accountIds }, stage: { notIn: ["WON", "LOST"] } },
        select: { id: true, accountId: true },
      })
    : [];
  const dealsByAccount = new Map<string, string[]>();
  for (const deal of openDeals) {
    const list = dealsByAccount.get(deal.accountId) ?? [];
    list.push(deal.id);
    dealsByAccount.set(deal.accountId, list);
  }

  for (const message of messages) {
    try {
      const contact = addressesOf(message)
        .map((address) => contactByEmail.get(address))
        .find(Boolean);

      const accountId = contact?.accountId ?? null;
      const candidates = accountId ? (dealsByAccount.get(accountId) ?? []) : [];
      const opportunityId = candidates.length === 1 ? candidates[0] : null;

      if (!contact) report.unlinked++;

      const data = {
        threadId: message.threadId ?? null,
        direction: message.direction,
        subject: message.subject ?? null,
        body: message.body ?? null,
        snippet: message.snippet ?? null,
        fromEmail: normalize(message.fromEmail),
        fromName: message.fromName ?? null,
        toEmails: message.toEmails?.length ? message.toEmails.map(normalize).join(",") : null,
        occurredAt: message.occurredAt,
        accountId,
        opportunityId,
        contactId: contact?.id ?? null,
      };

      const existing = await db.message.findUnique({
        where: {
          orgId_source_externalId: {
            orgId,
            source: message.source,
            externalId: message.externalId,
          },
        },
        select: { id: true },
      });

      if (existing) {
        await db.message.update({ where: { id: existing.id }, data });
        report.updated++;
      } else {
        await db.message.create({
          data: { orgId, source: message.source, externalId: message.externalId, ...data },
        });
        report.created++;
      }
    } catch (err) {
      report.failures.push({
        externalId: message.externalId,
        message: err instanceof Error ? err.message : "Could not store this message.",
      });
    }
  }

  return report;
}

/**
 * Attaches messages that arrived before the contact they belong to did.
 *
 * A mailbox sync routinely runs before a CRM sync, or before someone imports
 * the spreadsheet that creates the contact. Without this, those messages stay
 * invisible for ever — stored, matching nothing, and silently absent from the
 * evidence on a deal that has every reason to show them.
 */
export async function relinkOrphanMessages(orgId: string): Promise<number> {
  const orphans = await db.message.findMany({
    where: { orgId, contactId: null },
    select: { id: true, fromEmail: true, toEmails: true },
    take: 2000,
  });
  if (orphans.length === 0) return 0;

  const addresses = [
    ...new Set(
      orphans.flatMap((m) => [m.fromEmail, ...(m.toEmails?.split(",") ?? [])].map(normalize))
    ),
  ].filter(Boolean);

  const contacts = await db.prospect.findMany({
    where: { orgId, email: { in: addresses } },
    select: { id: true, email: true, accountId: true },
  });
  if (contacts.length === 0) return 0;
  const contactByEmail = new Map(
    contacts.filter((c) => c.email).map((c) => [normalize(c.email), c])
  );

  let linked = 0;
  for (const orphan of orphans) {
    const match = [orphan.fromEmail, ...(orphan.toEmails?.split(",") ?? [])]
      .map((a) => contactByEmail.get(normalize(a)))
      .find(Boolean);
    if (!match) continue;
    await db.message.update({
      where: { id: orphan.id },
      data: { contactId: match.id, accountId: match.accountId },
    });
    linked++;
  }
  return linked;
}
