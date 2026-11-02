/**
 * Why a deal needs following up today — as rules a person can check.
 *
 * This is deliberately not the scoring engine in `lib/revenue/`. That engine
 * multiplies deal value by a win probability it estimates, and a probability
 * Selryn invented is not something a seller can argue with. Here every reason
 * is a fact with a date attached: you sent a quote on the 3rd and they have
 * not answered; you said you would call back on the 7th and it is the 9th;
 * nothing at all has happened for three weeks.
 *
 * Three consequences, all intentional:
 *
 *  - **No score is produced.** Not a win rate, not expected revenue, not a
 *    risk number. Ordering comes from the rules themselves (see `compareFollowUps`).
 *  - **Amount is reported, never estimated.** It is whatever the CRM holds,
 *    or null. A deal with no amount is still worth following up.
 *  - **Every reason cites records.** `evidence` holds real event ids, so the
 *    UI can show the email or CRM entry the claim rests on rather than asking
 *    the seller to trust a sentence.
 *
 * Pure: no Prisma, no network, no clock of its own. `now` is always passed in,
 * which is what makes the whole file testable.
 */

/** The three situations this version detects. Each maps to one spec trigger. */
export type FollowUpRule =
  /** We quoted and they have not answered. */
  | "quote_no_reply"
  /** The follow-up date agreed in the CRM has passed. */
  | "followup_due"
  /** Nothing has happened on the deal for a long time. */
  | "gone_quiet";

/** A pointer back to the record a claim rests on. */
export interface EvidenceRef {
  /** RevenueEvent.id — what the UI loads to show the record. */
  eventId: string;
  /** hubspot | gmail | manual … */
  source: string;
  /** The provider's own id, so a record can be found in the source system. */
  sourceEventId: string;
  kind: EvidenceKind;
  occurredAt: Date;
  /** The real subject or title. Never generated. */
  summary: string;
}

export type EvidenceKind =
  | "email_outbound"
  | "email_inbound"
  | "meeting"
  | "call"
  | "note"
  | "crm_field";

/** Everything a rule is allowed to look at. All of it comes from real records. */
export interface DealFacts {
  opportunityId: string;
  accountName: string;
  /** The CRM's amount, or null when it holds none. Never estimated. */
  amount: number | null;
  currency: string;
  stage: string;
  /** The last thing we sent them. */
  lastOutbound: EvidenceRef | null;
  /** The last thing they sent us. */
  lastInbound: EvidenceRef | null;
  /** The most recent activity of any kind, either direction. */
  lastActivity: EvidenceRef | null;
  /**
   * The outbound message the deal has been waiting on since it reached a
   * quoting stage. Selryn does not try to decide whether an email "was a
   * quote" from its text — it uses the deal's own stage, and shows the real
   * subject line so the seller can see exactly which message is meant.
   */
  quoteSent: EvidenceRef | null;
  /** The follow-up date agreed in the CRM. */
  nextStepDueAt: Date | null;
  /** Where that date came from, for the evidence panel. */
  nextStepEvidence: EvidenceRef | null;
}

/** Timing a workspace can adjust. Defaults are the product's opinion, not law. */
export interface FollowUpTiming {
  /** Days after a quote with no answer before it is worth chasing. */
  quietAfterQuoteDays: number;
  /** Days with no activity at all before a deal counts as gone quiet. */
  goneQuietDays: number;
}

export const DEFAULT_TIMING: FollowUpTiming = {
  quietAfterQuoteDays: 3,
  goneQuietDays: 14,
};

export interface FollowUpReason {
  rule: FollowUpRule;
  /** What to do, in the seller's language. */
  action: string;
  /** Why, citing the actual dates. One sentence. */
  because: string;
  /** The records behind the claim, newest first. */
  evidence: EvidenceRef[];
  /**
   * How many days past the point where this became worth doing. Drives the
   * ordering and is shown to the user, so it has to mean something exact.
   */
  daysOverdue: number;
}

export interface FollowUpItem extends FollowUpReason {
  opportunityId: string;
  accountName: string;
  amount: number | null;
  currency: string;
  stage: string;
  /** Last contact either way, for the "last activity" column. */
  lastActivityAt: Date | null;
}

/**
 * Rule precedence, most urgent first.
 *
 * A missed commitment outranks everything: the seller said they would do
 * something on a date and did not. A quote with no answer is the next most
 * time-sensitive commercial moment. A deal that has merely gone quiet is real
 * but least acute, and it is last so a long tail of dormant deals can never
 * bury a promise broken this morning.
 */
export const RULE_ORDER: FollowUpRule[] = [
  "followup_due",
  "quote_no_reply",
  "gone_quiet",
];

const RULE_RANK: Record<FollowUpRule, number> = {
  followup_due: 0,
  quote_no_reply: 1,
  gone_quiet: 2,
};

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function formatDays(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

/**
 * True once the buyer has spoken more recently than we have.
 *
 * This is what stops Selryn nagging about a thread that has already been
 * answered — the spec's "stop reminding once the customer replies". It is
 * deliberately a comparison of real timestamps rather than a flag someone has
 * to remember to clear.
 */
export function buyerHasReplied(facts: DealFacts): boolean {
  if (!facts.lastInbound) return false;
  if (!facts.lastOutbound) return true;
  return facts.lastInbound.occurredAt >= facts.lastOutbound.occurredAt;
}

/**
 * The one reason this deal needs attention today, or null.
 *
 * Returns at most one: a list that tells a seller three things about the same
 * deal is a list they stop reading. Precedence is `RULE_ORDER`.
 */
export function evaluateFollowUp(
  facts: DealFacts,
  now: Date,
  timing: FollowUpTiming = DEFAULT_TIMING
): FollowUpReason | null {
  // ── 1. A follow-up date that has passed ──
  // Checked before the reply test on purpose: a date the seller committed to
  // is still owed even if the buyer wrote in the meantime.
  if (facts.nextStepDueAt && facts.nextStepDueAt <= now) {
    const daysOverdue = wholeDaysBetween(facts.nextStepDueAt, now);
    return {
      rule: "followup_due",
      action: `Follow up with ${facts.accountName}`,
      because:
        daysOverdue === 0
          ? "The follow-up date recorded on this deal is today."
          : `The follow-up date recorded on this deal passed ${formatDays(daysOverdue)} ago.`,
      evidence: compact([facts.nextStepEvidence, facts.lastActivity]),
      daysOverdue,
    };
  }

  // Past this point every rule is a form of "they have not come back to us",
  // so a reply settles all of them.
  if (buyerHasReplied(facts)) return null;

  // ── 2. A quote they have not answered ──
  if (facts.quoteSent) {
    const days = wholeDaysBetween(facts.quoteSent.occurredAt, now);
    if (days >= timing.quietAfterQuoteDays) {
      // The subject is quoted rather than paraphrased: it is the one detail
      // that lets a seller recognise the thread without opening anything.
      const subject = facts.quoteSent.summary.trim();
      return {
        rule: "quote_no_reply",
        action: `Follow up on the quote with ${facts.accountName}`,
        because: subject
          ? `You sent “${subject}” ${formatDays(days)} ago and there has been no reply.`
          : `You last wrote ${formatDays(days)} ago and there has been no reply.`,
        evidence: compact([facts.quoteSent, facts.lastOutbound]),
        daysOverdue: days - timing.quietAfterQuoteDays,
      };
    }
    // A quote inside the waiting window is not yet a reason to act, and it
    // outranks "gone quiet" — chasing on day one would be the wrong advice.
    return null;
  }

  // ── 3. Nothing at all for a long time ──
  if (facts.lastActivity) {
    const days = wholeDaysBetween(facts.lastActivity.occurredAt, now);
    if (days >= timing.goneQuietDays) {
      return {
        rule: "gone_quiet",
        action: `Re-open the conversation with ${facts.accountName}`,
        because: `Nothing has happened on this deal for ${formatDays(days)}.`,
        evidence: compact([facts.lastActivity]),
        daysOverdue: days - timing.goneQuietDays,
      };
    }
  }

  return null;
}

function compact(refs: (EvidenceRef | null)[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs
    .filter((r): r is EvidenceRef => r !== null)
    .filter((r) => (seen.has(r.eventId) ? false : (seen.add(r.eventId), true)))
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

/**
 * The order the list is shown in.
 *
 * Every term is a fact, and they are applied in a fixed sequence so the same
 * input always produces the same list — a ranking that reshuffles between
 * refreshes is one nobody trusts:
 *
 *   1. rule precedence (RULE_ORDER)
 *   2. how far past due, longest first
 *   3. amount, largest first — the CRM's own number, used only to break a
 *      tie between two otherwise identical reasons, never to score a deal
 *   4. opportunity id, so the order is total and stable
 */
export function compareFollowUps(a: FollowUpItem, b: FollowUpItem): number {
  const byRule = RULE_RANK[a.rule] - RULE_RANK[b.rule];
  if (byRule !== 0) return byRule;

  const byOverdue = b.daysOverdue - a.daysOverdue;
  if (byOverdue !== 0) return byOverdue;

  const byAmount = (b.amount ?? -1) - (a.amount ?? -1);
  if (byAmount !== 0) return byAmount;

  return a.opportunityId.localeCompare(b.opportunityId);
}

export function rankFollowUps<T extends FollowUpItem>(items: T[]): T[] {
  return [...items].sort(compareFollowUps);
}

/** How many the workbench leads with before "show everything". */
export const TOP_FOLLOW_UPS = 3;

// ── Staying handled ────────────────────────────────────────────────────────

export type HandledState = "DONE" | "SNOOZED" | "IGNORED";

export interface HandledRecord {
  state: string;
  snoozedUntil: Date | null;
  handledAgainst: Date | null;
}

/**
 * Whether a deal the seller has already dealt with should stay off the list.
 *
 * The hard case is "mark as done". The rules are facts about the world, so
 * ticking one off changes nothing they look at: on the next page load the
 * quote is still unanswered and the deal comes straight back, which makes the
 * button feel broken. A fixed cooldown is the usual fix and it is wrong in the
 * other direction — a deal that genuinely moved stays hidden while it matters.
 *
 * So a handled item returns exactly when something new has happened:
 * `handledAgainst` records the newest evidence at the moment it was handled,
 * and anything newer brings it back. A reply, a meeting, a stage change all
 * qualify. Nothing happening does not.
 */
export function isSuppressed(
  handled: HandledRecord | null,
  newestEvidenceAt: Date | null,
  now: Date
): boolean {
  if (!handled) return false;

  if (handled.state === "SNOOZED") {
    // A snooze is a promise about time, so only time releases it.
    return handled.snoozedUntil != null && handled.snoozedUntil > now;
  }

  // "Not interested" is a standing decision, not a pause.
  if (handled.state === "IGNORED") return true;

  if (handled.state === "DONE") {
    if (!handled.handledAgainst) return true;
    if (!newestEvidenceAt) return true;
    return newestEvidenceAt <= handled.handledAgainst;
  }

  return false;
}
