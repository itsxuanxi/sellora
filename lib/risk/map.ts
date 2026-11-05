import {
  RISK_BASIS,
  RISK_DESCRIPTION,
  RISK_LABEL,
  RISK_RANK,
  type RiskBasis,
  type RiskKind,
} from "@/lib/risk/kinds";
import type { BlockerKind } from "@/lib/deal-facts/blockers";
import type { FollowUpRule } from "@/lib/followup/rules";
import type { LeakType } from "@/lib/revenue/config";

/**
 * The three internal vocabularies, mapped onto the public one.
 *
 * Mapping rather than renaming is the deliberate choice. Each of these layers
 * has its own tests and its own reasons for the distinctions it draws —
 * `quote_no_reply` and `high_intent_no_response` fire on different evidence
 * even though a user would call both "they have not got back to me". Rewriting
 * them to share a name would risk behaviour in order to gain vocabulary.
 *
 * So the detectors keep their own words and this file decides what the product
 * says out loud. Anything unmapped is a bug rather than a default: a situation
 * Selryn detects but has no public name for would reach the UI as whatever
 * internal identifier happened to be in scope, which is how three vocabularies
 * leaked onto three screens in the first place.
 */

const FROM_BLOCKER: Record<BlockerKind, RiskKind> = {
  overdue_action: "followup_overdue",
  unanswered_pricing: "open_question",
  unclear_scope: "open_question",
  // Nobody on record who can say yes. Not one of the four risks the product
  // promises, and it is a gap in what we know rather than a dated event, so
  // it surfaces as the proposal being unanswered — which is the actionable
  // half of it — rather than inventing a fifth promise.
  missing_decision_maker: "awaiting_response",
  awaiting_reply: "awaiting_response",
  gone_quiet: "no_recent_activity",
};

const FROM_RULE: Record<FollowUpRule, RiskKind> = {
  followup_due: "followup_overdue",
  quote_no_reply: "awaiting_response",
  no_next_step: "meeting_no_next_step",
  gone_quiet: "no_recent_activity",
};

const FROM_LEAK: Record<LeakType, RiskKind> = {
  needs_follow_up: "followup_overdue",
  going_cold: "no_recent_activity",
  high_intent_no_response: "awaiting_response",
  proposal_viewed_no_followup: "awaiting_response",
  meeting_no_next_step: "meeting_no_next_step",
  // A lost deal showing fresh interest. Reported as activity worth a look,
  // never as a prediction that it will reopen.
  lost_with_new_signal: "no_recent_activity",
};

export function riskFromBlocker(kind: BlockerKind): RiskKind {
  return FROM_BLOCKER[kind];
}

export function riskFromRule(rule: FollowUpRule): RiskKind {
  return FROM_RULE[rule];
}

export function riskFromLeak(leak: LeakType | string): RiskKind | null {
  return (FROM_LEAK as Record<string, RiskKind>)[leak] ?? null;
}

/**
 * The risk a Today item represents.
 *
 * The blocker wins when there is one, because it is the more specific claim:
 * "they asked what happens after month three and nobody answered" is worth
 * more to a seller than "they have not replied", and the blocker layer is the
 * only one that can see the extracted facts. The silence rule is the fallback.
 */
export function riskFor(input: {
  blockerKind?: BlockerKind | null;
  rule?: FollowUpRule | null;
}): RiskKind {
  if (input.blockerKind) return riskFromBlocker(input.blockerKind);
  if (input.rule) return riskFromRule(input.rule);
  return "no_recent_activity";
}

export interface RiskView {
  kind: RiskKind;
  label: string;
  description: string;
  basis: RiskBasis;
  rank: number;
}

export function riskView(kind: RiskKind): RiskView {
  return {
    kind,
    label: RISK_LABEL[kind],
    description: RISK_DESCRIPTION[kind],
    basis: RISK_BASIS[kind],
    rank: RISK_RANK[kind],
  };
}

/**
 * How many deals carry each risk, for the summary band on Today.
 *
 * Counts deals, not findings. A deal with an overdue follow-up *and* an
 * unanswered question is one deal that needs attention, and reporting it in
 * both columns would make the band add up to more than the list beneath it —
 * a small dishonesty that costs the whole band its credibility. Each deal is
 * counted under its leading risk only, which is the one the card shows.
 */
export function summarizeRisks(
  items: { risk: RiskKind }[]
): { kind: RiskKind; label: string; basis: RiskBasis; count: number }[] {
  const counts = new Map<RiskKind, number>();
  for (const i of items) counts.set(i.risk, (counts.get(i.risk) ?? 0) + 1);

  return [...counts.entries()]
    .map(([kind, count]) => ({
      kind,
      label: RISK_LABEL[kind],
      basis: RISK_BASIS[kind],
      count,
    }))
    .sort((a, b) => RISK_RANK[a.kind] - RISK_RANK[b.kind]);
}
