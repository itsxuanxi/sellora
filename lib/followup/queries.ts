import "server-only";
import { db } from "@/lib/db";
import { OPEN_STAGES, STAGE_LABELS, type OpportunityStage } from "@/lib/revenue/config";
import { identifyBlocker, type Blocker } from "@/lib/deal-facts/blockers";
import { factsForOpportunities } from "@/lib/deal-facts/queries";
import { riskFor } from "@/lib/risk/map";
import { loadFactsForOpportunities } from "@/lib/revenue/facts-load";
import type { FactSource } from "@/lib/revenue/facts";
import { buildCallOutline, type CallOutline } from "@/lib/followup/call-outline";
import { RISK_BASIS, type RiskBasis, type RiskKind } from "@/lib/risk/kinds";

/**
 * Days of one-way conversation after which a call beats another email.
 *
 * A judgement, not a measurement: nobody has calibrated it against reply
 * rates. It is here as a named constant so it can be argued with.
 */
const CALL_AFTER_SILENT_DAYS = 21;
import {
  DEFAULT_TIMING,
  buyerHasReplied,
  describeStaleness,
  evaluateFollowUp,
  isSuppressed,
  rankFollowUps,
  type DealFacts,
  type EvidenceKind,
  type EvidenceRef,
  type FollowUpItem,
  type FollowUpTiming,
} from "@/lib/followup/rules";

/**
 * Turning stored records into today's follow-up list.
 *
 * A thin adapter on purpose. Every judgement lives in `rules.ts`, which is
 * pure and tested; this file only loads rows, shapes them into `DealFacts`
 * and reports what the rules say. Pushing a decision down here would put it
 * somewhere no test can reach without a database.
 *
 * Every query filters on `orgId`. Workspaces share one Postgres, so a query
 * that reaches a deal by id alone is a cross-tenant read waiting to happen —
 * `lib/followup/__tests__/isolation.test.ts` asserts the filter is present in
 * every call in this file.
 */

/** Stages where an outbound email is fairly described as a quote. */
const QUOTING_STAGES = new Set(["PROPOSAL", "NEGOTIATION"]);

/** Provider event types, mapped to the evidence kinds the UI renders. */
const EVIDENCE_KIND: Record<string, EvidenceKind> = {
  "email.sent": "email_outbound",
  "email.replied": "email_inbound",
  "meeting.held": "meeting",
  "meeting.scheduled": "meeting",
  "call.placed": "call",
  "call.received": "call",
  "note.logged": "note",
};

interface EventRow {
  id: string;
  source: string;
  sourceEventId: string;
  eventType: string;
  occurredAt: Date;
  actorType: string;
  normalizedProperties: string | null;
  opportunityId: string | null;
}

/** The subject or title the provider recorded, never a generated one. */
function summarize(row: EventRow): string {
  if (row.normalizedProperties) {
    try {
      const p = JSON.parse(row.normalizedProperties) as Record<string, unknown>;
      for (const key of ["subject", "title", "name"]) {
        const value = p[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    } catch {
      // A malformed payload must not take the list down.
    }
  }
  return FALLBACK_SUMMARY[row.eventType] ?? "Activity";
}

const FALLBACK_SUMMARY: Record<string, string> = {
  "email.sent": "Email sent",
  "email.replied": "Reply received",
  "meeting.held": "Meeting held",
  "meeting.scheduled": "Meeting scheduled",
  "call.placed": "Call placed",
  "call.received": "Call received",
  "note.logged": "Note logged",
};

function toEvidence(row: EventRow): EvidenceRef | null {
  const kind = EVIDENCE_KIND[row.eventType];
  if (!kind) return null;
  return {
    eventId: row.id,
    source: row.source,
    sourceEventId: row.sourceEventId,
    kind,
    occurredAt: row.occurredAt,
    summary: summarize(row),
  };
}

export async function followUpTiming(orgId: string): Promise<FollowUpTiming> {
  const settings = await db.settings.findUnique({
    where: { orgId },
    select: { followUpQuoteDays: true, followUpQuietDays: true },
  });
  return {
    quietAfterQuoteDays: settings?.followUpQuoteDays ?? DEFAULT_TIMING.quietAfterQuoteDays,
    goneQuietDays: settings?.followUpQuietDays ?? DEFAULT_TIMING.goneQuietDays,
    noNextStepDays: DEFAULT_TIMING.noNextStepDays,
  };
}

/**
 * An `EvidenceRef` for something the shared facts saw and the event log did
 * not — a reply recorded by the outcome tracker, say.
 *
 * `eventId` is prefixed rather than left blank: these ids do not resolve
 * through `getEvidence`, which queries RevenueEvent, and a blank one would
 * look like a row that failed to load instead of one that lives elsewhere.
 */
function refFromFacts(
  at: Date | null,
  kind: EvidenceKind,
  via: FactSource | null,
  summary: string | null
): EvidenceRef | null {
  if (!at) return null;
  return {
    eventId: `facts:${via ?? "unknown"}:${at.getTime()}`,
    source: via ?? "selryn",
    sourceEventId: "",
    kind,
    occurredAt: at,
    summary: summary ?? "",
  };
}

function newerOf(a: EvidenceRef | null, b: EvidenceRef | null): EvidenceRef | null {
  if (!a) return b;
  if (!b) return a;
  return b.occurredAt > a.occurredAt ? b : a;
}

export interface FollowUpListItem extends FollowUpItem {
  contact: { id: string; name: string; email: string } | null;
  /**
   * The risk this item represents, in the product's one public vocabulary.
   *
   * Derived here rather than in the component so Today, the deal page and the
   * marketing copy cannot each pick a different word for the same situation.
   */
  risk: RiskKind;
  /** Whether the claim is read off the records or reasoned from them. */
  basis: RiskBasis;
  /** Whether a call is the better opening move than an email. */
  preferCall: boolean;
  /** The outline to use if the seller calls instead. Always built — it costs
   *  nothing, traces entirely to records, and the seller may prefer to call
   *  on a deal where Selryn would have drafted. */
  callOutline: CallOutline;
  /** An open draft for this deal, when one exists. */
  draftId: string | null;
  /**
   * What is actually in the way. Richer than the silence rules alone, because
   * it can see the extracted facts — an unanswered pricing question rather
   * than "they have not replied".
   */
  blocker: Blocker;
}

/**
 * Today's follow-ups, ranked, with the handled ones removed.
 */
export async function getFollowUps(
  orgId: string,
  now: Date = new Date()
): Promise<FollowUpListItem[]> {
  const [opportunities, timing] = await Promise.all([
    db.opportunity.findMany({
      where: { orgId, stage: { in: [...OPEN_STAGES] } },
      select: {
        id: true,
        accountId: true,
        lastInteractionAt: true,
        stage: true,
        dealValue: true,
        dealValueBasis: true,
        currency: true,
        nextStepDueAt: true,
        account: { select: { name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    }),
    followUpTiming(orgId),
  ]);
  if (opportunities.length === 0) return [];

  const ids = opportunities.map((o) => o.id);

  const [events, handled, drafts, factsByOpportunity, sharedFacts] = await Promise.all([
    db.revenueEvent.findMany({
      where: { orgId, opportunityId: { in: ids } },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        source: true,
        sourceEventId: true,
        eventType: true,
        occurredAt: true,
        actorType: true,
        normalizedProperties: true,
        opportunityId: true,
      },
    }),
    db.followUpAction.findMany({
      where: { orgId, opportunityId: { in: ids } },
      select: {
        opportunityId: true,
        rule: true,
        state: true,
        snoozedUntil: true,
        handledAgainst: true,
      },
    }),
    db.dealFollowUp.findMany({
      where: { orgId, opportunityId: { in: ids }, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      select: { id: true, opportunityId: true },
    }),
    factsForOpportunities(orgId, ids),
    loadFactsForOpportunities(
      orgId,
      opportunities.map((o) => ({ id: o.id, accountId: o.accountId }))
    ),
  ]);

  const byOpportunity = new Map<string, EventRow[]>();
  for (const e of events) {
    if (!e.opportunityId) continue;
    const list = byOpportunity.get(e.opportunityId) ?? [];
    list.push(e);
    byOpportunity.set(e.opportunityId, list);
  }

  const handledBy = new Map(handled.map((h) => [`${h.opportunityId}:${h.rule}`, h]));
  const draftBy = new Map<string, string>();
  for (const d of drafts) if (!draftBy.has(d.opportunityId)) draftBy.set(d.opportunityId, d.id);

  const items: FollowUpListItem[] = [];

  for (const opp of opportunities) {
    // Already ordered newest-first by the query.
    const rows = byOpportunity.get(opp.id) ?? [];
    const evidence = rows.map(toEvidence).filter((e): e is EvidenceRef => e !== null);

    // Reply and activity facts come from the one shared derivation.
    //
    // This list used to read them off the RevenueEvent rows above and nothing
    // else — a fourth derivation of "have they replied?", after the three
    // that lib/revenue/facts.ts replaced. It was the worst place for one to
    // survive: a reply recorded by the outcome tracker rather than the event
    // log left Today telling a seller to chase a thread the buyer had already
    // answered, on the product's main screen.
    //
    // The event rows are still used for the evidence panel, because they are
    // the records with ids that `getEvidence` can resolve. What changed is
    // that the *claim* no longer comes from a subset of the sources.
    const shared = sharedFacts.get(opp.id) ?? null;
    const eventOutbound = evidence.find((e) => e.kind === "email_outbound") ?? null;
    const eventInbound = evidence.find((e) => e.kind === "email_inbound") ?? null;

    // The deal's own "last contacted" field, as a last resort.
    //
    // A workspace whose only data is a spreadsheet import has no activity
    // *records* at all — the importer writes provenance events, not emails —
    // so every rule that needs `lastActivity` found nothing and Today came up
    // empty straight after the primary onboarding path. The CRM field is a
    // real stored date and a perfectly good basis for "nothing has happened
    // for 70 days"; what it lacks is an individual record to click through
    // to, which the evidence panel already says plainly.
    const crmTouch: EvidenceRef | null = opp.lastInteractionAt
      ? {
          eventId: `crm:${opp.id}`,
          source: "crm_field",
          sourceEventId: "",
          kind: "crm_field",
          occurredAt: opp.lastInteractionAt,
          summary: "Last contacted, from the deal record",
        }
      : null;

    const lastOutbound = newerOf(eventOutbound, refFromFacts(shared?.lastOutboundAt ?? null, "email_outbound", shared?.lastOutboundVia ?? null, shared?.lastOutboundSummary ?? null));
    const lastInbound = newerOf(eventInbound, refFromFacts(shared?.lastReplyAt ?? null, "email_inbound", shared?.lastReplyVia ?? null, null));
    const lastActivity =
      newerOf(newerOf(newerOf(evidence[0] ?? null, lastInbound), lastOutbound), crmTouch);

    const facts: DealFacts = {
      opportunityId: opp.id,
      accountName: opp.account.name,
      // Only a figure a person put in the CRM is shown. An estimate would be
      // a number Selryn made up, which is what this layer exists to avoid.
      amount: opp.dealValueBasis === "user_entered" ? opp.dealValue : null,
      currency: opp.currency,
      stage: STAGE_LABELS[opp.stage as OpportunityStage] ?? opp.stage,
      stageKey: opp.stage,
      lastOutbound,
      lastInbound,
      lastActivity,
      // With no email record, the deal's own last-contacted date is what the
      // quote rule has to work from. It is weaker evidence and the card says
      // so — but refusing to raise a silent proposal because the proposal
      // itself was not sent through Selryn is the wrong trade.
      quoteSent: QUOTING_STAGES.has(opp.stage) ? (lastOutbound ?? crmTouch) : null,
      nextStepDueAt: opp.nextStepDueAt,
      nextStepEvidence: null,
      // How old the evidence is, so a reason can disclose it rather than
      // presenting a two-month-old record with the confidence of this
      // morning's sync.
      dataAgeDays: lastActivity
        ? Math.floor((now.getTime() - lastActivity.occurredAt.getTime()) / 86_400_000)
        : null,
    };

    const reason = evaluateFollowUp(facts, now, timing);

    const blocker = identifyBlocker({
      deal: facts,
      facts: factsByOpportunity.get(opp.id) ?? {},
      evidenceById: new Map(evidence.map((e) => [e.eventId, e])),
      silenceReason: reason,
      buyerReplied: buyerHasReplied(facts),
      hasExtractedFacts: Object.keys(factsByOpportunity.get(opp.id) ?? {}).length > 0,
    });
    // No blocker means nothing specific is wrong — the deal is simply being
    // worked, and putting it on a list of problems would be noise.
    if (!blocker) continue;

    const risk = riskFor({ blockerKind: blocker.kind, rule: reason?.rule ?? null });

    const newest = lastActivity?.occurredAt ?? null;
    const handledKey = reason?.rule ?? blocker.kind;
    if (isSuppressed(handledBy.get(`${opp.id}:${handledKey}`) ?? null, newest, now)) {
      continue;
    }

    items.push({
      // A deal with a blocker but no silence rule still needs the shared
      // shape; the blocker supplies the words.
      rule: reason?.rule ?? "gone_quiet",
      action: blocker.recommendedAction,
      because: blocker.because,
      evidence: blocker.evidence,
      daysOverdue: reason?.daysOverdue ?? 0,
      // Read from the facts, not from the reason. An item can reach this list
      // on a blocker alone, with no silence rule behind it, and those items
      // were shipping with no freshness caveat at all — including a deal
      // whose newest record was seventy days old.
      staleness: reason?.staleness ?? describeStaleness(facts),
      risk,
      basis: RISK_BASIS[risk],
      // A fourth unanswered email is not the move. When the thread has gone
      // one-way for a while, or there is no email history to reply into, the
      // outline for a call is the more useful thing to hand someone — so the
      // card offers that instead of another draft.
      preferCall:
        facts.lastInbound == null &&
        (reason?.rule === "gone_quiet" ||
          (facts.dataAgeDays != null && facts.dataAgeDays >= CALL_AFTER_SILENT_DAYS)),
      callOutline: buildCallOutline(
        {
          accountName: facts.accountName,
          contactName: opp.primaryContact?.name ?? null,
          risk,
          rule: reason?.rule ?? null,
          because: blocker.because,
          // Only the blocker layer sees the extracted facts, and only a fact
          // actually on record becomes a line in the outline.
          openQuestion:
            blocker.kind === "unanswered_pricing" || blocker.kind === "unclear_scope"
              ? blocker.because
              : null,
          lastOutbound: facts.lastOutbound,
          lastInbound: facts.lastInbound,
          lastActivity: facts.lastActivity,
          nextStepDueAt: facts.nextStepDueAt,
        },
        now
      ),
      blocker,
      opportunityId: opp.id,
      accountName: facts.accountName,
      amount: facts.amount,
      currency: facts.currency,
      stage: facts.stage,
      stageKey: facts.stageKey,
      lastActivityAt: newest,
      contact: opp.primaryContact,
      draftId: draftBy.get(opp.id) ?? null,
    });
  }

  return rankFollowUps(items);
}

/** The records behind one reason, for the evidence panel. */
export async function getEvidence(orgId: string, eventIds: string[]) {
  if (eventIds.length === 0) return [];
  const rows = await db.revenueEvent.findMany({
    where: { orgId, id: { in: eventIds } },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      source: true,
      sourceEventId: true,
      eventType: true,
      occurredAt: true,
      actorType: true,
      normalizedProperties: true,
      opportunityId: true,
    },
  });
  return rows.map((r) => ({
    ...toEvidence(r),
    actorType: r.actorType,
    eventType: r.eventType,
  }));
}
