/**
 * The risks Selryn claims to detect, named once.
 *
 * The product already had three overlapping vocabularies for "something is
 * wrong with this deal": `LeakType` in lib/revenue/config.ts, `FollowUpRule`
 * in lib/followup/rules.ts, and `BlockerKind` in lib/deal-facts/blockers.ts.
 * Each was reasonable where it was written, and together they meant the
 * homepage, the Today list and the deal page could describe the same
 * situation in three different words — which is the same class of problem as
 * the reply inconsistency: not a wrong number, a product that does not sound
 * like it is reading one set of records.
 *
 * This is the shared public vocabulary. It is deliberately short, because it
 * is a promise about what the product detects, and a promise is only worth
 * making for things it detects reliably:
 *
 *   awaiting_response   a proposal or quote went out and nothing came back
 *   meeting_no_next_step  a meeting happened and nothing was agreed after it
 *   followup_overdue    a date somebody committed to has passed
 *   open_question       they asked something and it was not answered
 *   no_recent_activity  nothing at all for long enough to be worth a look
 *
 * The existing layers are mapped onto these rather than replaced: the rules
 * that produce them are tested and in use, and rewriting them to change their
 * names would risk behaviour to gain vocabulary.
 */

export const RISK_KINDS = [
  "followup_overdue",
  "open_question",
  "awaiting_response",
  "meeting_no_next_step",
  "no_recent_activity",
] as const;

export type RiskKind = (typeof RISK_KINDS)[number];

/**
 * Most actionable first, and this order is the one Today uses.
 *
 * A missed commitment leads because we caused it and can fix it today. An
 * unanswered question comes next: it is the most common reason a proposal
 * sits still, and the remedy is usually one sentence. A silent proposal
 * follows. A meeting with nothing agreed after it is real but less acute. A
 * deal that has merely gone quiet is last — it says something is wrong
 * without saying what, so it must never bury the four above it.
 */
export const RISK_ORDER: RiskKind[] = [
  "followup_overdue",
  "open_question",
  "awaiting_response",
  "meeting_no_next_step",
  "no_recent_activity",
];

export const RISK_RANK: Record<RiskKind, number> = Object.fromEntries(
  RISK_ORDER.map((k, i) => [k, i])
) as Record<RiskKind, number>;

/** The label shown to a user. Short enough for a badge. */
export const RISK_LABEL: Record<RiskKind, string> = {
  followup_overdue: "Follow-up overdue",
  open_question: "Question unanswered",
  awaiting_response: "Awaiting response",
  meeting_no_next_step: "No next step",
  no_recent_activity: "No recent activity",
};

/** One line a user can check against their own inbox. */
export const RISK_DESCRIPTION: Record<RiskKind, string> = {
  followup_overdue:
    "A follow-up date recorded on the deal has passed without anything happening.",
  open_question:
    "Something the buyer asked is on record with no answer after it.",
  awaiting_response:
    "A proposal or quote went out and nothing has come back since.",
  meeting_no_next_step:
    "A meeting took place and no next step was recorded afterwards.",
  no_recent_activity:
    "Nothing has been recorded on this deal, either direction, for a long time.",
};

/**
 * Whether a risk is read off the records or reasoned from them.
 *
 * The difference matters more than it looks. "The follow-up date on this deal
 * was the 3rd and it is the 9th" is a comparison of two stored values and
 * cannot be wrong unless the CRM is wrong. "They asked about pricing and
 * nobody answered" depends on having correctly understood a sentence in an
 * email, and on having seen every reply — it can be wrong while every record
 * behind it is right.
 *
 * Presenting both with the same confidence is how a tool trains its user to
 * discount all of it. So each risk carries its basis, and the UI says which
 * it is.
 */
export type RiskBasis =
  /** Derived from stored dates and fields. Wrong only if the records are. */
  | "observed"
  /** Depends on reading a message's content, or on our records being complete. */
  | "inferred";

export const RISK_BASIS: Record<RiskKind, RiskBasis> = {
  // Two stored dates, compared.
  followup_overdue: "observed",
  // Depends on having understood what they asked.
  open_question: "inferred",
  // A send with no inbound after it: stored timestamps, but it is only as
  // true as our coverage of their replies — hence inferred, not observed.
  awaiting_response: "inferred",
  // A meeting record and an empty next-step field. Both stored.
  meeting_no_next_step: "observed",
  // One stored timestamp against the clock.
  no_recent_activity: "observed",
};

export const BASIS_LABEL: Record<RiskBasis, string> = {
  observed: "From your records",
  inferred: "Inferred",
};

export const BASIS_HELP: Record<RiskBasis, string> = {
  observed:
    "Read directly from dates and fields on the deal. This is wrong only if the records are.",
  inferred:
    "Reasoned from the records rather than read off them. It can be wrong even when every record behind it is right — check the evidence.",
};
