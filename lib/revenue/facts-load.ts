import "server-only";
import { db } from "@/lib/db";
import {
  deriveOpportunityFacts,
  emptyFacts,
  INBOUND_EVENT_TYPES,
  OUTBOUND_EVENT_TYPES,
  type FactInput,
  type OpportunityFacts,
} from "@/lib/revenue/facts";

/**
 * The database half of `facts.ts`.
 *
 * Kept separate so the derivation stays pure and testable without a database,
 * and so there is exactly one query path feeding it. Every screen that wants
 * reply facts calls `loadFactsForOpportunities`; nothing re-queries the Email
 * table for itself, which is the arrangement that produced two different
 * answers to "have they replied?" on the same page.
 *
 * Reads are scoped to the *account*, not the contact: engagement with anyone
 * at a company is evidence about the deal with that company. They are also
 * scoped to `orgId` on every table, including the ones reached through a
 * relation, so a missing join can never leak another tenant's history.
 */
export async function loadFactsForOpportunities(
  orgId: string,
  opportunities: { id: string; accountId: string }[]
): Promise<Map<string, OpportunityFacts>> {
  const out = new Map<string, OpportunityFacts>();
  if (opportunities.length === 0) return out;

  const accountIds = [...new Set(opportunities.map((o) => o.accountId))];
  const opportunityIds = opportunities.map((o) => o.id);
  const now = new Date();

  const [contacts, emails, events, responses, signals] = await Promise.all([
    db.prospect.findMany({
      where: { orgId, accountId: { in: accountIds } },
      select: { id: true, accountId: true },
    }),
    db.email.findMany({
      where: { orgId, prospect: { accountId: { in: accountIds } } },
      select: {
        id: true,
        subject: true,
        sentAt: true,
        openedAt: true,
        repliedAt: true,
        prospectId: true,
        prospect: { select: { accountId: true } },
      },
    }),
    // The ingestion log covers what Selryn did not send itself — a rep
    // emailing from HubSpot or Gmail. Without it a deal somebody has worked
    // all week reads as untouched.
    db.revenueEvent.findMany({
      where: {
        orgId,
        accountId: { in: accountIds },
        eventType: { in: [...OUTBOUND_EVENT_TYPES, ...INBOUND_EVENT_TYPES] },
      },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        accountId: true,
        source: true,
        sourceEventId: true,
        eventType: true,
        occurredAt: true,
        actorType: true,
        contactId: true,
      },
    }),
    // The outcome tracker. This is what the deal timeline renders, and the
    // table both previous derivations ignored.
    db.response.findMany({
      where: { orgId, opportunityId: { in: opportunityIds } },
      orderBy: { observedAt: "desc" },
      select: {
        id: true,
        opportunityId: true,
        responseType: true,
        contactId: true,
        observedAt: true,
        detail: true,
      },
    }),
    db.buyingSignal.findMany({
      where: { orgId, accountId: { in: accountIds }, expired: false },
      orderBy: { occurredAt: "desc" },
      select: { id: true, accountId: true, signalType: true, occurredAt: true, title: true },
    }),
  ]);

  const byAccount = <T>(rows: T[], key: (r: T) => string | null) => {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const id = key(r);
      if (!id) continue;
      const list = map.get(id);
      if (list) list.push(r);
      else map.set(id, [r]);
    }
    return map;
  };

  const contactsByAccount = byAccount(contacts, (c) => c.accountId);
  const emailsByAccount = byAccount(emails, (e) => e.prospect.accountId);
  const eventsByAccount = byAccount(events, (e) => e.accountId);
  const signalsByAccount = byAccount(signals, (s) => s.accountId);
  const responsesByOpportunity = byAccount(responses, (r) => r.opportunityId);

  for (const opp of opportunities) {
    const input: FactInput = {
      opportunityId: opp.id,
      contactIds: (contactsByAccount.get(opp.accountId) ?? []).map((c) => c.id),
      emails: emailsByAccount.get(opp.accountId) ?? [],
      events: eventsByAccount.get(opp.accountId) ?? [],
      responses: responsesByOpportunity.get(opp.id) ?? [],
      signals: signalsByAccount.get(opp.accountId) ?? [],
    };
    out.set(opp.id, deriveOpportunityFacts(input, now));
  }

  return out;
}

/** One opportunity's facts. Falls back to empty facts rather than throwing. */
export async function loadFactsForOpportunity(
  orgId: string,
  opportunityId: string
): Promise<OpportunityFacts> {
  const opp = await db.opportunity.findFirst({
    where: { id: opportunityId, orgId },
    select: { id: true, accountId: true },
  });
  if (!opp) return emptyFacts(opportunityId);
  const map = await loadFactsForOpportunities(orgId, [opp]);
  return map.get(opportunityId) ?? emptyFacts(opportunityId);
}
