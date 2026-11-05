import {
  type OpportunityFacts,
  type ReplyState,
} from "@/lib/revenue/facts";
import type { LeakType } from "@/lib/revenue/config";

/**
 * When a piece of advice has been overtaken by events.
 *
 * A recommendation is a claim about the present: "they opened your proposal
 * four days ago and nobody has followed up". The moment someone does follow
 * up, or the buyer writes back, the claim stops being true — but the row
 * persists until something recomputes it. In between, the product tells a
 * seller to chase a reply that is already sitting in their inbox, which is
 * worse than telling them nothing: it is a demonstration that Selryn is not
 * reading the same records they are.
 *
 * `syncRecommendations` resolves stale rows, but only when it runs. This
 * module closes the window by checking at read time, against the same shared
 * facts every other screen uses, so a page can never render advice that its
 * own evidence panel contradicts.
 *
 * Pure. No database, no clock of its own.
 */

/**
 * Leak types whose entire premise is buyer silence.
 *
 * These are the ones a reply refutes. A `meeting_no_next_step` is not on the
 * list: a buyer replying does not create the missing next step, so that
 * advice survives the reply and should keep standing.
 */
const SILENCE_PREMISED: Set<LeakType | string> = new Set([
  "high_intent_no_response",
  "proposal_viewed_no_followup",
  "needs_follow_up",
  "going_cold",
  "lost_with_new_signal",
]);

/** Advice whose premise is that nobody on our side has acted. */
const TOUCH_PREMISED: Set<LeakType | string> = new Set([
  "proposal_viewed_no_followup",
  "needs_follow_up",
  "going_cold",
]);

export interface RecommendationPremise {
  /** When the advice was produced. Everything newer can refute it. */
  createdAt: Date;
  /** The leak it was raised against, when it was raised against one. */
  leakType: string | null;
  actionType: string;
  /** Hard expiry, when the writer set one. */
  expiresAt: Date | null;
}

export type ContradictionKind =
  /** The buyer replied after the advice was written. */
  | "buyer_replied"
  /** Somebody on our side already did it. */
  | "already_actioned"
  /** The advice outlived the window its author gave it. */
  | "expired";

export interface Contradiction {
  kind: ContradictionKind;
  /** One sentence naming the record that refutes the advice. */
  because: string;
  /** When the refuting thing happened. */
  at: Date;
}

const REPLIED_STATES: ReplyState[] = ["they_replied_last"];

/**
 * The evidence against a recommendation, or null when it still stands.
 *
 * Checks the buyer first: a reply is the strongest refutation and the one a
 * seller is most likely to have seen before Selryn did.
 */
export function findContradiction(
  rec: RecommendationPremise,
  facts: OpportunityFacts,
  now: Date
): Contradiction | null {
  // ── The buyer answered ──
  if (
    rec.leakType != null &&
    SILENCE_PREMISED.has(rec.leakType) &&
    facts.lastReplyAt != null &&
    facts.lastReplyAt > rec.createdAt &&
    REPLIED_STATES.includes(facts.replyState)
  ) {
    return {
      kind: "buyer_replied",
      because:
        facts.daysSinceReply === 0
          ? "They replied today, after this was raised."
          : `They replied ${facts.daysSinceReply} day${facts.daysSinceReply === 1 ? "" : "s"} ago, after this was raised.`,
      at: facts.lastReplyAt,
    };
  }

  // ── We already did it ──
  // Only for advice whose premise is our own inaction. "Book a meeting" is
  // not satisfied by having sent another email.
  if (
    rec.leakType != null &&
    TOUCH_PREMISED.has(rec.leakType) &&
    facts.lastOutboundAt != null &&
    facts.lastOutboundAt > rec.createdAt
  ) {
    return {
      kind: "already_actioned",
      because: facts.lastOutboundSummary
        ? `Someone already sent “${facts.lastOutboundSummary}” after this was raised.`
        : "Someone already contacted them after this was raised.",
      at: facts.lastOutboundAt,
    };
  }

  // ── It ran out ──
  if (rec.expiresAt != null && rec.expiresAt < now) {
    return {
      kind: "expired",
      because: "This advice was only relevant for a limited window, which has passed.",
      at: rec.expiresAt,
    };
  }

  return null;
}

/**
 * Whether there is enough behind a recommendation to state it confidently.
 *
 * Returned instead of a confidence label when the answer is "we do not know".
 * The spec's requirement is explicit: show insufficient evidence rather than
 * forcing a confident conclusion. The two cases that matter are an account
 * with no synced activity at all — where silence is not a finding — and one
 * whose newest record is old enough that the current state is simply unknown.
 */
export function insufficientEvidence(facts: OpportunityFacts): string | null {
  if (!facts.coverage.hasAnyRecord) {
    return "No activity has synced for this deal, so there is nothing to base advice on.";
  }
  if (!facts.coverage.hasOutbound) {
    return "Nothing has been sent to this account, so there is no silence to explain.";
  }
  if (facts.coverage.stale) {
    return `The newest record here is ${facts.coverage.recordAgeDays} days old. Check the CRM — this may already be out of date.`;
  }
  return null;
}


/**
 * Whether advice would be wrong *right now*, before it is ever written.
 *
 * `findContradiction` asks whether something happened after the advice was
 * raised, so it cannot speak about a candidate whose `createdAt` is this
 * instant — nothing is newer than now. A separate question is needed, or the
 * writer re-raises advice the reader then immediately hides, and the row
 * flip-flops between OPEN and WITHDRAWN on every refresh.
 *
 * The test is current state: advice premised on buyer silence must not be
 * raised while the buyer is the one waiting on us.
 */
export function premiseContradictedNow(
  leakType: string | null,
  facts: OpportunityFacts
): string | null {
  if (leakType == null) return null;
  if (!SILENCE_PREMISED.has(leakType)) return null;
  if (facts.replyState !== "they_replied_last") return null;
  return facts.daysSinceReply != null && facts.daysSinceReply > 0
    ? `They replied ${facts.daysSinceReply} day${facts.daysSinceReply === 1 ? "" : "s"} ago and are waiting on you.`
    : "They replied and are waiting on you.";
}
