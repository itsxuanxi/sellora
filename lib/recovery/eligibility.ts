/**
 * Which dormant deals are worth another conversation.
 *
 * The temptation in a feature like this is to call the whole back catalogue
 * an opportunity — every closed-lost row is "recoverable revenue" if nobody
 * checks. That number is always wrong and it is the reason tools like this
 * get switched off after a fortnight. So:
 *
 *  - A record is eligible only when something specific makes it so: a
 *    proposal that was never answered, a postponement whose date has arrived,
 *    or a loss for a reason that expires.
 *  - A deal nobody ever really engaged with is **old, not dormant**. Age
 *    alone never qualifies anything.
 *  - Exclusions are checked first and are absolute. Someone who asked not to
 *    be contacted is never surfaced, whatever the deal is worth.
 *  - Nothing here totals anything. There is no "recoverable revenue" figure
 *    in this module, deliberately.
 *
 * Pure, so every rule is testable without a database.
 */

export type RecoveryRule =
  /** A proposal went out and was never answered; the deal is still open. */
  | "proposal_unanswered"
  /** They asked to revisit at a time that has now arrived. */
  | "postponement_due"
  /** Lost for a reason that does not last forever. */
  | "loss_reason_expired";

export type ExclusionReason =
  | "do_not_contact"
  | "explicit_rejection"
  | "user_excluded"
  | "unsubscribed";

/**
 * Loss reasons worth revisiting, and how long to leave them.
 *
 * "Competitor" is absent on purpose: they chose someone else, and a cheery
 * note six months later is the kind of outreach that makes an agency look
 * like it is not listening. If that relationship reopens it will be because
 * the client says so.
 */
export const REVISITABLE_LOSS_REASONS: Record<string, number> = {
  timing: 90,
  no_budget: 180,
  no_decision: 120,
};

export interface RecoveryCandidate {
  opportunityId: string;
  accountName: string;
  /** The CRM's own amount, or null. Never estimated, never totalled. */
  amount: number | null;
  currency: string;
  stageKey: string;
  closedAt: Date | null;
  lostReason: string | null;
  /** When a proposal was sent, if one was. */
  proposalSentAt: Date | null;
  /** Last contact in either direction. */
  lastActivityAt: Date | null;
  /** True if the buyer ever replied or met — the test of real engagement. */
  everEngaged: boolean;
  /** A postponement recorded in the conversation, with the date they named. */
  postponedUntil: Date | null;
  /** Exclusions on file. Any one of them disqualifies the deal outright. */
  exclusions: ExclusionReason[];
  evidenceIds: string[];
}

export interface RecoveryReason {
  rule: RecoveryRule;
  /** Why this one, in the agency's language. */
  because: string;
  /** A specific, evidence-based reason to reconnect. */
  angle: string;
  evidenceIds: string[];
  /** How long it has been dormant, for ordering and for display. */
  dormantDays: number;
}

export type RecoveryVerdict =
  | { eligible: true; reason: RecoveryReason }
  | { eligible: false; why: "excluded"; exclusion: ExclusionReason }
  | { eligible: false; why: "never_engaged" | "too_recent" | "no_qualifying_rule" };

const DAY = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

/** A proposal unanswered for less than this is still just waiting. */
export const PROPOSAL_DORMANT_DAYS = 21;

export function evaluateRecovery(
  candidate: RecoveryCandidate,
  now: Date
): RecoveryVerdict {
  // 1. Exclusions first and absolutely. Nothing below can override them.
  if (candidate.exclusions.length > 0) {
    return { eligible: false, why: "excluded", exclusion: candidate.exclusions[0] };
  }

  // 2. A record nobody ever engaged with is old, not dormant. Reopening a
  //    conversation that never happened is cold outreach wearing a costume.
  if (!candidate.everEngaged) {
    return { eligible: false, why: "never_engaged" };
  }

  const dormantDays = candidate.lastActivityAt
    ? daysBetween(candidate.lastActivityAt, now)
    : 0;

  // 3. A postponement whose date has arrived — the strongest signal there is,
  //    because they chose it.
  if (candidate.postponedUntil && candidate.postponedUntil <= now) {
    return {
      eligible: true,
      reason: {
        rule: "postponement_due",
        because: `They asked to revisit this around ${candidate.postponedUntil.toISOString().slice(0, 10)}, which has now passed.`,
        angle: "Pick up the conversation at the time they chose",
        evidenceIds: candidate.evidenceIds,
        dormantDays,
      },
    };
  }

  // 4. A proposal that was never answered, on a deal still open.
  const openStage = !["WON", "LOST"].includes(candidate.stageKey);
  if (openStage && candidate.proposalSentAt) {
    const waiting = daysBetween(candidate.proposalSentAt, now);
    if (waiting < PROPOSAL_DORMANT_DAYS) return { eligible: false, why: "too_recent" };
    return {
      eligible: true,
      reason: {
        rule: "proposal_unanswered",
        because: `A proposal went out ${waiting} days ago and was never answered.`,
        angle: "Ask whether the proposal is still relevant, or what changed",
        evidenceIds: candidate.evidenceIds,
        dormantDays,
      },
    };
  }

  // 5. Lost for a reason that expires.
  if (candidate.stageKey === "LOST" && candidate.lostReason && candidate.closedAt) {
    const wait = REVISITABLE_LOSS_REASONS[candidate.lostReason];
    if (wait === undefined) return { eligible: false, why: "no_qualifying_rule" };
    const since = daysBetween(candidate.closedAt, now);
    if (since < wait) return { eligible: false, why: "too_recent" };
    return {
      eligible: true,
      reason: {
        rule: "loss_reason_expired",
        because: `Lost ${since} days ago over ${candidate.lostReason.replace(/_/g, " ")} — long enough that it may have changed.`,
        angle: "Ask whether the circumstances that ended it still hold",
        evidenceIds: candidate.evidenceIds,
        dormantDays,
      },
    };
  }

  return { eligible: false, why: "no_qualifying_rule" };
}

/**
 * Ordering: the signal they gave us, then how long it has been.
 *
 * A date the client named outranks our own inference, which outranks a loss
 * reason that merely aged out.
 */
const RULE_RANK: Record<RecoveryRule, number> = {
  postponement_due: 0,
  proposal_unanswered: 1,
  loss_reason_expired: 2,
};

export function compareRecovery(
  a: { reason: RecoveryReason; amount: number | null; opportunityId: string },
  b: { reason: RecoveryReason; amount: number | null; opportunityId: string }
): number {
  const byRule = RULE_RANK[a.reason.rule] - RULE_RANK[b.reason.rule];
  if (byRule !== 0) return byRule;
  const byDormancy = a.reason.dormantDays - b.reason.dormantDays;
  if (byDormancy !== 0) return byDormancy;
  const byAmount = (b.amount ?? -1) - (a.amount ?? -1);
  if (byAmount !== 0) return byAmount;
  return a.opportunityId.localeCompare(b.opportunityId);
}
