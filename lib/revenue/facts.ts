/**
 * The single source of fact about one opportunity.
 *
 * Every screen in Selryn used to answer "have they replied?" for itself.
 * `lib/revenue/opportunities.ts` asked the Email table; `lib/revenue/queries.ts`
 * asked Email *and* the event log; the deal timeline rendered Response rows
 * that neither of them read. So Cloudmint's detail page showed a "Replied"
 * entry in the timeline while the leak panel directly above it said they had
 * "never replied to you" — both true to their own source, and the pair of
 * them together a reason to stop believing the product.
 *
 * The fix is not to make the three agree by luck. It is to delete two of them.
 * Lists, detail pages, summaries, scores and recommendations all read the
 * facts this module derives, so a claim can only differ between screens if
 * the underlying records differ.
 *
 * Three properties the derivation has to have:
 *
 *  - **Every reply source counts.** A reply reaches Selryn as `Email.repliedAt`,
 *    as an inbound `RevenueEvent`, or as a `Response` row written by the
 *    outcome tracker. Reading two of the three is how bug #1 happened, and it
 *    would happen again with any subset.
 *
 *  - **"No reply" is three different claims.** Never replied at all; has
 *    replied before but not to the latest outreach; has not replied inside
 *    some window. Collapsing them produces the specific falsehood that the
 *    account has never engaged when the history says otherwise. They are
 *    distinct states here and distinct sentences in the UI.
 *
 *  - **Absence of evidence is reported, not scored.** An account with no email
 *    history has not "never replied" in the damning sense — nothing was ever
 *    sent. `coverage` carries what is missing so a screen can say "not enough
 *    evidence" instead of asserting silence.
 *
 * Pure. `now` is a parameter, Prisma lives in `facts-load.ts`, and duplicate
 * records are collapsed here rather than hoped against upstream.
 */

export type FactSource =
  /** Email.repliedAt / sentAt — the campaign mailer's own record. */
  | "email"
  /** RevenueEvent — the ingestion log, i.e. CRM, Gmail, calendar. */
  | "event"
  /** Response — the outcome tracker, which is what the deal timeline renders. */
  | "response"
  /** BuyingSignal — observed behaviour, never a message. */
  | "signal";

/**
 * What we can say about the buyer's side of the conversation.
 *
 * Ordered from least to most engaged. The names are deliberately literal:
 * `never_replied` means no inbound record of any kind exists, and nothing
 * weaker is allowed to borrow the phrase.
 */
export type ReplyState =
  /** Nothing has been sent to this account, so silence means nothing yet. */
  | "no_outreach_yet"
  /** Outreach went out and no inbound record of any kind exists. */
  | "never_replied"
  /** They have replied before; our latest message is unanswered. */
  | "awaiting_reply"
  /** The newest message in the thread is theirs. The ball is with us. */
  | "they_replied_last";

export type BuyerActivityKind =
  | "reply"
  | "meeting"
  | "proposal_view"
  | "email_open"
  | "site_visit"
  | "other_signal";

/** Buyer-initiated event types in the ingestion log. */
export const INBOUND_EVENT_TYPES = new Set([
  "email.replied",
  "call.received",
  "form.submitted",
]);

/** Seller-initiated event types in the ingestion log. */
export const OUTBOUND_EVENT_TYPES = new Set([
  "email.sent",
  "call.placed",
  "meeting.held",
]);

/**
 * Response rows that are a message from the buyer.
 *
 * `meeting_booked` counts: a buyer who books a slot has answered, whatever
 * the channel. `proposal_viewed` does not — opening a PDF is activity, not a
 * reply, and treating it as one is how a product starts telling sellers they
 * have been answered when nobody wrote back.
 */
export const INBOUND_RESPONSE_TYPES = new Set(["replied", "meeting_booked"]);

/** Response rows that are buyer activity without being a reply. */
export const ACTIVITY_RESPONSE_TYPES = new Set([
  "proposal_viewed",
  "stakeholder_added",
]);

// ── Inputs ────────────────────────────────────────────────────────────────

export interface EmailFactRow {
  id: string;
  prospectId: string;
  subject: string;
  sentAt: Date | null;
  openedAt: Date | null;
  repliedAt: Date | null;
}

export interface EventFactRow {
  id: string;
  source: string;
  sourceEventId: string;
  eventType: string;
  occurredAt: Date;
  actorType: string;
  contactId: string | null;
}

export interface ResponseFactRow {
  id: string;
  responseType: string;
  contactId: string | null;
  observedAt: Date;
  detail: string | null;
}

export interface SignalFactRow {
  id: string;
  signalType: string;
  occurredAt: Date;
  title: string;
}

export interface FactInput {
  opportunityId: string;
  /** Every contact known at the account, so "which of them replied" is answerable. */
  contactIds: string[];
  emails: EmailFactRow[];
  events: EventFactRow[];
  responses: ResponseFactRow[];
  signals: SignalFactRow[];
  /** Newest write from each connected source, for the freshness judgement. */
  lastSyncedAt?: Date | null;
}

// ── Outputs ───────────────────────────────────────────────────────────────

/** One record behind one claim. Enough to find it in the source system. */
export interface FactEvidence {
  id: string;
  source: FactSource;
  kind: BuyerActivityKind | "outbound";
  at: Date;
  /** The real subject, title or detail. Never generated prose. */
  summary: string;
  contactId: string | null;
  /**
   * The source system's own id for this event, where it has one.
   *
   * Distinct from `id`, which is our row id: a provider that redelivers an
   * event writes two rows with two ids and one `identity`. Redelivery is
   * normal — webhooks retry, backfills overlap — so identity is checked
   * before any time heuristic.
   */
  identity?: string;
}

/** The conversation with one person, so advice can name the right one. */
export interface ContactFacts {
  contactId: string;
  lastOutboundAt: Date | null;
  lastReplyAt: Date | null;
  replyCount: number;
}

/**
 * What the facts rest on — the honest answer to "how much of this do you
 * actually know?".
 *
 * `sources` is which record types contributed anything at all. A workspace
 * with CRM deals and no inbox connected has `email: false`, and any screen
 * about reply behaviour there should say so rather than report silence as a
 * finding.
 */
export interface FactCoverage {
  hasContacts: boolean;
  hasOutbound: boolean;
  hasAnyRecord: boolean;
  sources: Record<FactSource, boolean>;
  /** Newest record of any kind. The real "as of" for everything here. */
  newestRecordAt: Date | null;
  /** Days since that record, or null when there is none. */
  recordAgeDays: number | null;
  /** True when nothing has arrived for long enough that absence proves little. */
  stale: boolean;
  /** Why the facts may be incomplete, in plain words. Empty when they are sound. */
  caveats: string[];
}

export interface OpportunityFacts {
  opportunityId: string;

  // Reply
  replyState: ReplyState;
  lastReplyAt: Date | null;
  lastReplyVia: FactSource | null;
  lastReplyContactId: string | null;
  replyCount: number;
  daysSinceReply: number | null;

  // Outbound
  lastOutboundAt: Date | null;
  lastOutboundVia: FactSource | null;
  lastOutboundSummary: string | null;
  outboundSinceLastReply: number;
  daysSinceOutbound: number | null;

  // Buyer activity — wider than replies
  lastBuyerActivityAt: Date | null;
  lastBuyerActivityKind: BuyerActivityKind | null;
  daysSinceBuyerActivity: number | null;

  // Anything at all
  lastActivityAt: Date | null;
  lastActivityKind: BuyerActivityKind | "outbound" | null;
  daysSinceAnyActivity: number | null;

  // Counts, all deduplicated
  emailsSent: number;
  emailsOpened: number;
  emailsReplied: number;
  meetingsHeld: number;
  proposalViews: number;
  siteVisits: number;

  contacts: ContactFacts[];
  coverage: FactCoverage;
  /** Newest first, capped. The records any claim above can cite. */
  evidence: FactEvidence[];
}

/** Records older than this make "they have gone quiet" unreliable. */
export const STALE_RECORD_DAYS = 30;

const SITE_VISIT_SIGNALS = new Set([
  "pricing_page_visit",
  "website_visit",
  "docs_visit",
  "repeat_visit",
]);
const MEETING_SIGNALS = new Set(["meeting_attended", "meeting_booked"]);
const PROPOSAL_SIGNALS = new Set(["proposal_opened", "proposal_viewed"]);

function wholeDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function newest<T extends { at: Date }>(rows: T[]): T | null {
  let best: T | null = null;
  for (const r of rows) if (!best || r.at > best.at) best = r;
  return best;
}

/**
 * How far apart two records from different systems may be and still describe
 * the same real-world event.
 *
 * Inbound gets the wider window because the sources disagree about what the
 * timestamp means: `Email.repliedAt` is when the reply landed, a provider
 * event is when the provider saw it, and `Response.observedAt` is when the
 * outcome tracker noticed — which can be hours later. Outbound gets a
 * narrower one because a sequence legitimately sends twice in a day and
 * merging those would undercount the unanswered messages.
 *
 * Both are judgements, not measurements. See the calibration note in the
 * audit report.
 */
const CROSS_SOURCE_WINDOW_MS = { inbound: 6 * 3_600_000, outbound: 2 * 3_600_000 };

/**
 * Collapses records from *different* systems that describe the same event.
 *
 * One reply reaches Selryn up to three times: as `Email.repliedAt`, as an
 * inbound `RevenueEvent` from the CRM or Gmail connector, and as a `Response`
 * row from the outcome tracker. Counting it three times inflates `replyCount`
 * and `emailsReplied`, and those move a score — so the same buyer behaviour
 * would score differently depending on how many connectors a workspace
 * happens to have enabled.
 *
 * Deliberately *not* deduplicated on the summary text: the three systems
 * describe the same reply as "Proposal for Q2", "email.replied" and whatever
 * the tracker recorded, so matching on text merges nothing. Also deliberately
 * not deduplicated within a single source — two rows in one table with
 * different ids are two records, and collapsing them would hide a real
 * ingestion fault rather than fix it.
 */
function dedupe(rows: FactEvidence[], direction: "inbound" | "outbound"): FactEvidence[] {
  const window = CROSS_SOURCE_WINDOW_MS[direction];
  const kept: FactEvidence[] = [];
  const identities = new Set<string>();

  // Newest first, so the survivor of a merge is the most recent record.
  for (const row of [...rows].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    // Exact identity first. A redelivered webhook is the same event however
    // far apart the two timestamps happen to be, so this must not be a
    // time-window judgement.
    if (row.identity) {
      const key = `${row.source}:${row.identity}`;
      if (identities.has(key)) continue;
      identities.add(key);
    }

    const duplicate = kept.some(
      (k) =>
        k.source !== row.source &&
        k.kind === row.kind &&
        k.contactId === row.contactId &&
        Math.abs(k.at.getTime() - row.at.getTime()) <= window
    );
    if (!duplicate) kept.push(row);
  }
  return kept;
}

/**
 * Derives every fact about one opportunity from its raw records.
 *
 * The shape of the work: fold all four record types into one evidence list
 * tagged by direction and kind, deduplicate it, and read the answers off that
 * single list. Nothing below consults a table directly, which is what makes
 * it impossible for two facts here to disagree with each other.
 */
export function deriveOpportunityFacts(input: FactInput, now: Date): OpportunityFacts {
  const inbound: FactEvidence[] = [];
  const outbound: FactEvidence[] = [];
  const activity: FactEvidence[] = [];

  // ── Email table ──
  for (const e of input.emails) {
    if (e.sentAt) {
      outbound.push({
        id: e.id,
        source: "email",
        kind: "outbound",
        at: e.sentAt,
        summary: e.subject,
        contactId: e.prospectId,
      });
    }
    if (e.openedAt) {
      activity.push({
        id: `${e.id}:open`,
        source: "email",
        kind: "email_open",
        at: e.openedAt,
        summary: e.subject,
        contactId: e.prospectId,
      });
    }
    if (e.repliedAt) {
      inbound.push({
        id: `${e.id}:reply`,
        source: "email",
        kind: "reply",
        at: e.repliedAt,
        summary: e.subject,
        contactId: e.prospectId,
      });
    }
  }

  // ── Ingestion log ──
  for (const ev of input.events) {
    const base = {
      id: ev.id,
      source: "event" as FactSource,
      at: ev.occurredAt,
      summary: ev.eventType,
      contactId: ev.contactId,
      identity: `${ev.eventType}:${ev.sourceEventId}`,
    };
    if (INBOUND_EVENT_TYPES.has(ev.eventType) || ev.actorType === "buyer") {
      inbound.push({ ...base, kind: "reply" });
    } else if (OUTBOUND_EVENT_TYPES.has(ev.eventType)) {
      // A held meeting is a two-sided fact, but it is not the buyer writing
      // back, so it counts as activity and never as a reply.
      if (ev.eventType === "meeting.held") {
        activity.push({ ...base, kind: "meeting" });
      } else {
        outbound.push({ ...base, kind: "outbound" });
      }
    }
  }

  // ── Outcome tracker — the source the timeline renders, and the one the
  //    old derivations ignored. ──
  for (const r of input.responses) {
    const base = {
      id: r.id,
      source: "response" as FactSource,
      at: r.observedAt,
      summary: r.detail ?? r.responseType,
      contactId: r.contactId,
    };
    if (INBOUND_RESPONSE_TYPES.has(r.responseType)) {
      inbound.push({
        ...base,
        kind: r.responseType === "meeting_booked" ? "meeting" : "reply",
      });
    } else if (ACTIVITY_RESPONSE_TYPES.has(r.responseType)) {
      activity.push({
        ...base,
        kind: r.responseType === "proposal_viewed" ? "proposal_view" : "other_signal",
      });
    }
    // no_response / unsubscribed / opportunity_* are not buyer messages.
  }

  // ── Observed behaviour ──
  for (const s of input.signals) {
    const kind: BuyerActivityKind = MEETING_SIGNALS.has(s.signalType)
      ? "meeting"
      : PROPOSAL_SIGNALS.has(s.signalType)
        ? "proposal_view"
        : SITE_VISIT_SIGNALS.has(s.signalType)
          ? "site_visit"
          : "other_signal";
    activity.push({
      id: s.id,
      source: "signal",
      kind,
      at: s.occurredAt,
      summary: s.title,
      contactId: null,
    });
  }

  const inboundDeduped = dedupe(inbound, "inbound");
  const outboundDeduped = dedupe(outbound, "outbound");
  const activityDeduped = dedupe(activity, "inbound");

  // A reply is specifically a message back. A booked meeting counts as one
  // (see INBOUND_RESPONSE_TYPES); it is listed under meetings too.
  const replies = inboundDeduped.filter((r) => r.kind === "reply" || r.kind === "meeting");

  const lastReply = newest(replies);
  const lastOutbound = newest(outboundDeduped);
  const lastBuyerActivity = newest([...replies, ...activityDeduped]);
  const lastAnything = newest([...replies, ...activityDeduped, ...outboundDeduped]);

  // ── Reply state ──
  // Order matters. "Nothing was sent" has to be checked before "never
  // replied", or every untouched deal is reported as an account that ignores
  // us — the exact overclaim this module exists to prevent.
  let replyState: ReplyState;
  if (replies.length === 0) {
    replyState = outboundDeduped.length === 0 ? "no_outreach_yet" : "never_replied";
  } else if (!lastOutbound || lastReply!.at >= lastOutbound.at) {
    replyState = "they_replied_last";
  } else {
    replyState = "awaiting_reply";
  }

  const outboundSinceLastReply = lastReply
    ? outboundDeduped.filter((o) => o.at > lastReply.at).length
    : outboundDeduped.length;

  const sources: Record<FactSource, boolean> = {
    email: input.emails.length > 0,
    event: input.events.length > 0,
    response: input.responses.length > 0,
    signal: input.signals.length > 0,
  };

  const recordAgeDays = lastAnything ? wholeDays(lastAnything.at, now) : null;
  const caveats: string[] = [];
  if (input.contactIds.length === 0) {
    caveats.push("No contacts are recorded on this account.");
  }
  if (!sources.email && !sources.event) {
    caveats.push("No email or CRM activity has been synced for this account.");
  }
  if (outboundDeduped.length === 0) {
    caveats.push("Nothing has been sent to this account, so silence is not a signal.");
  }
  if (recordAgeDays != null && recordAgeDays > STALE_RECORD_DAYS) {
    caveats.push(
      `The newest record here is ${recordAgeDays} days old, so current behaviour is unknown.`
    );
  }

  const coverage: FactCoverage = {
    hasContacts: input.contactIds.length > 0,
    hasOutbound: outboundDeduped.length > 0,
    hasAnyRecord: lastAnything != null,
    sources,
    newestRecordAt: lastAnything?.at ?? null,
    recordAgeDays,
    stale: recordAgeDays != null && recordAgeDays > STALE_RECORD_DAYS,
    caveats,
  };

  // ── Per contact ──
  // Keyed off the account's contact list rather than off whoever happens to
  // appear in a record, so a contact who has never been written to is visible
  // as exactly that instead of silently absent.
  const contacts: ContactFacts[] = input.contactIds.map((contactId) => {
    const theirReplies = replies.filter((r) => r.contactId === contactId);
    return {
      contactId,
      lastOutboundAt: newest(outboundDeduped.filter((o) => o.contactId === contactId))?.at ?? null,
      lastReplyAt: newest(theirReplies)?.at ?? null,
      replyCount: theirReplies.length,
    };
  });

  return {
    opportunityId: input.opportunityId,

    replyState,
    lastReplyAt: lastReply?.at ?? null,
    lastReplyVia: lastReply?.source ?? null,
    lastReplyContactId: lastReply?.contactId ?? null,
    replyCount: replies.length,
    daysSinceReply: lastReply ? wholeDays(lastReply.at, now) : null,

    lastOutboundAt: lastOutbound?.at ?? null,
    lastOutboundVia: lastOutbound?.source ?? null,
    lastOutboundSummary: lastOutbound?.summary ?? null,
    outboundSinceLastReply,
    daysSinceOutbound: lastOutbound ? wholeDays(lastOutbound.at, now) : null,

    lastBuyerActivityAt: lastBuyerActivity?.at ?? null,
    lastBuyerActivityKind: (lastBuyerActivity?.kind as BuyerActivityKind) ?? null,
    daysSinceBuyerActivity: lastBuyerActivity ? wholeDays(lastBuyerActivity.at, now) : null,

    lastActivityAt: lastAnything?.at ?? null,
    lastActivityKind: lastAnything?.kind ?? null,
    daysSinceAnyActivity: lastAnything ? wholeDays(lastAnything.at, now) : null,

    emailsSent: outboundDeduped.filter((o) => o.source === "email").length,
    emailsOpened: activityDeduped.filter((a) => a.kind === "email_open").length,
    emailsReplied: replies.filter((r) => r.kind === "reply").length,
    meetingsHeld: activityDeduped.filter((a) => a.kind === "meeting").length
      + replies.filter((r) => r.kind === "meeting").length,
    proposalViews: activityDeduped.filter((a) => a.kind === "proposal_view").length,
    siteVisits: activityDeduped.filter((a) => a.kind === "site_visit").length,

    contacts,
    coverage,
    evidence: [...replies, ...activityDeduped, ...outboundDeduped]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 30),
  };
}

// ── The three "no reply" questions, asked properly ────────────────────────

/**
 * No inbound record of any kind, ever, from anyone at the account — and we
 * did write to them. The strongest of the three claims, and the only one
 * allowed to be phrased as "they have never replied".
 */
export function hasNeverReplied(f: OpportunityFacts): boolean {
  return f.replyState === "never_replied";
}

/** They have replied before, but our latest message is unanswered. */
export function awaitingReplyToLatestOutreach(f: OpportunityFacts): boolean {
  return f.replyState === "awaiting_reply";
}

/**
 * No reply inside a stated window.
 *
 * Returns false when nothing was sent: a window with no outreach in it is not
 * evidence of anything. An account that has never replied at all satisfies
 * any window, provided we did reach out.
 */
export function noReplyWithinDays(
  f: OpportunityFacts,
  days: number,
  _now?: Date
): boolean {
  if (!f.coverage.hasOutbound) return false;
  if (f.daysSinceReply == null) return true;
  return f.daysSinceReply >= days;
}

/**
 * The sentence the UI shows. One function, so no screen can phrase this
 * differently from the screen next to it — which is the whole of bug #1.
 */
export function describeReplyState(f: OpportunityFacts): string {
  switch (f.replyState) {
    case "no_outreach_yet":
      return "Nothing has been sent to this account yet.";
    case "never_replied":
      return f.outboundSinceLastReply === 1
        ? "They have not replied to the one message sent to them."
        : `They have not replied to any of the ${f.outboundSinceLastReply} messages sent to them.`;
    case "awaiting_reply": {
      const n = f.outboundSinceLastReply;
      const since =
        f.daysSinceReply != null ? ` Their last reply was ${f.daysSinceReply} days ago.` : "";
      return n === 1
        ? `They have replied before but have not answered your latest message.${since}`
        : `They have replied before but have not answered your last ${n} messages.${since}`;
    }
    case "they_replied_last":
      return f.daysSinceReply != null && f.daysSinceReply > 0
        ? `They replied ${f.daysSinceReply} days ago and are waiting on you.`
        : "They replied and are waiting on you.";
  }
}

/** Short label for a list column or badge. */
export function replyStateLabel(state: ReplyState): string {
  switch (state) {
    case "no_outreach_yet":
      return "Not contacted";
    case "never_replied":
      return "No reply yet";
    case "awaiting_reply":
      return "Awaiting reply";
    case "they_replied_last":
      return "They replied";
  }
}

/** Facts for an opportunity we have no records for at all. */
export function emptyFacts(opportunityId: string): OpportunityFacts {
  return deriveOpportunityFacts(
    { opportunityId, contactIds: [], emails: [], events: [], responses: [], signals: [] },
    new Date()
  );
}
