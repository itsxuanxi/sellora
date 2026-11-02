/**
 * What is actually stopping a proposal from closing.
 *
 * Selryn's older ranking asked which deal was worth the most. This asks a
 * narrower and more answerable question: what is in the way, and what would
 * move it. An agency owner cannot act on "this deal is worth $18,400 in
 * expected revenue". They can act on "they asked what happens after month
 * three and nobody answered".
 *
 * Composes with `lib/followup/rules.ts` rather than replacing it. Those three
 * rules are about silence and are derived from timestamps alone; these are
 * about content and need the extracted facts. A deal can match both, so the
 * precedence below decides what the card says.
 *
 * Pure. No scores, no probabilities, and nothing invented: a blocker exists
 * only where a record supports it.
 */

import type { DealFactView, FactKind } from "@/lib/deal-facts/kinds";
import type { DealFacts, EvidenceRef, FollowUpReason } from "@/lib/followup/rules";

export type BlockerKind =
  /** An agreed next step whose date has passed. */
  | "overdue_action"
  /** They asked about price or budget and it was not answered. */
  | "unanswered_pricing"
  /** An open question about what is included. */
  | "unclear_scope"
  /** Nobody on record can actually say yes. */
  | "missing_decision_maker"
  /** A quote they have not answered. */
  | "awaiting_reply"
  /** Nothing has happened for a long time. */
  | "gone_quiet";

export interface Blocker {
  kind: BlockerKind;
  /** What is in the way, in one line. */
  title: string;
  /** Why we say so, citing the record. */
  because: string;
  /** The one thing to do about it. */
  recommendedAction: string;
  /** Records backing the claim. */
  evidence: EvidenceRef[];
  /** The fact this rests on, when it rests on one. */
  factId: string | null;
}

/**
 * Most actionable first.
 *
 * A broken commitment leads because the agency caused it and can fix it today.
 * An unanswered question about money comes next: it is the most common reason
 * a proposal sits, and the remedy is a sentence. Scope follows for the same
 * reason. A missing decision-maker is real but slower to resolve. The two
 * silence rules come last — they say something is wrong without saying what.
 */
export const BLOCKER_ORDER: BlockerKind[] = [
  "overdue_action",
  "unanswered_pricing",
  "unclear_scope",
  "missing_decision_maker",
  "awaiting_reply",
  "gone_quiet",
];

const RANK: Record<BlockerKind, number> = Object.fromEntries(
  BLOCKER_ORDER.map((k, i) => [k, i])
) as Record<BlockerKind, number>;

/** Stages at which not knowing the decision-maker is a problem worth raising. */
const COMMITTED_STAGES = new Set(["PROPOSAL", "NEGOTIATION"]);

/** Open means: recorded, not yet answered, and not dismissed. */
function openFact(
  facts: Partial<Record<FactKind, DealFactView>>,
  kind: FactKind
): DealFactView | null {
  const fact = facts[kind];
  return fact ?? null;
}

/**
 * Whether a recorded line is a question still awaiting an answer.
 *
 * Shape, not keywords. Matching the word "budget" treats "budget approved at
 * 4k per month" — the opposite of a blocker — as an open question, and tells
 * an agency to chase something that is already settled.
 */
function isUnansweredQuestion(value: string): boolean {
  if (value.includes("?")) return true;
  return /\b(how much|what would|what will|what does .* cost|can you (share|send|confirm))\b/i.test(
    value
  );
}

function evidenceFor(fact: DealFactView | null, byId: Map<string, EvidenceRef>): EvidenceRef[] {
  if (!fact) return [];
  return fact.evidence.map((id) => byId.get(id)).filter((e): e is EvidenceRef => Boolean(e));
}

/**
 * The blocker to show for one deal, or null.
 *
 * `silenceReason` is whatever `evaluateFollowUp` already decided, so the two
 * layers cannot disagree about the same deal.
 */
export function identifyBlocker(opts: {
  deal: DealFacts;
  /** Best known fact per kind, already filtered of rejections. */
  facts: Partial<Record<FactKind, DealFactView>>;
  /** Evidence records, for resolving fact → record. */
  evidenceById: Map<string, EvidenceRef>;
  /** The timestamp-only verdict from lib/followup/rules.ts. */
  silenceReason: FollowUpReason | null;
  /** True once the buyer has answered more recently than we wrote. */
  buyerReplied: boolean;
}): Blocker | null {
  const { deal, facts, evidenceById, silenceReason, buyerReplied } = opts;
  const candidates: Blocker[] = [];

  // ── An agreed action whose date has passed ──
  if (silenceReason?.rule === "followup_due") {
    candidates.push({
      kind: "overdue_action",
      title: "You owe them the next step",
      because: silenceReason.because,
      recommendedAction: `Do what you said you would, or tell ${deal.accountName} when you will`,
      evidence: silenceReason.evidence,
      factId: null,
    });
  }

  // ── A question about money, unanswered ──
  // Only where the question is on record. "They probably want a discount" is
  // exactly the kind of thing this product must not say.
  const pricing = openFact(facts, "budget");
  if (pricing && isUnansweredQuestion(pricing.value)) {
    candidates.push({
      kind: "unanswered_pricing",
      title: "A question about price is unanswered",
      because: `They raised: “${pricing.value}”`,
      recommendedAction: "Answer the pricing question directly, in writing",
      evidence: evidenceFor(pricing, evidenceById),
      factId: pricing.id,
    });
  }

  // ── Scope still unclear ──
  const scope = openFact(facts, "scope_question");
  if (scope) {
    candidates.push({
      kind: "unclear_scope",
      title: "Scope is still open",
      because: `Unresolved: “${scope.value}”`,
      recommendedAction: "Put the scope answer in writing so they can approve it",
      evidence: evidenceFor(scope, evidenceById),
      factId: scope.id,
    });
  }

  // ── Nobody on record can say yes ──
  if (!facts.decision_maker && COMMITTED_STAGES.has(deal.stageKey)) {
    candidates.push({
      kind: "missing_decision_maker",
      title: "No decision-maker identified",
      because:
        "A proposal is out, but nothing on record says who signs it off. Deals stall here without anyone refusing.",
      recommendedAction: "Ask who else needs to approve this before it can go ahead",
      evidence: [],
      factId: null,
    });
  }

  // ── Silence ──
  if (silenceReason?.rule === "quote_no_reply" && !buyerReplied) {
    candidates.push({
      kind: "awaiting_reply",
      title: "Your proposal has had no answer",
      because: silenceReason.because,
      recommendedAction: silenceReason.action,
      evidence: silenceReason.evidence,
      factId: null,
    });
  }
  if (silenceReason?.rule === "gone_quiet") {
    candidates.push({
      kind: "gone_quiet",
      title: "The conversation has stopped",
      because: silenceReason.because,
      recommendedAction: silenceReason.action,
      evidence: silenceReason.evidence,
      factId: null,
    });
  }

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => RANK[a.kind] - RANK[b.kind])[0];
}

/** Ordering for the dashboard: blocker precedence, then how overdue. */
export function compareBlocked(
  a: { blocker: Blocker; daysOverdue: number; amount: number | null; opportunityId: string },
  b: { blocker: Blocker; daysOverdue: number; amount: number | null; opportunityId: string }
): number {
  const byKind = RANK[a.blocker.kind] - RANK[b.blocker.kind];
  if (byKind !== 0) return byKind;
  const byOverdue = b.daysOverdue - a.daysOverdue;
  if (byOverdue !== 0) return byOverdue;
  // The CRM's own figure, breaking a tie only — never a score.
  const byAmount = (b.amount ?? -1) - (a.amount ?? -1);
  if (byAmount !== 0) return byAmount;
  return a.opportunityId.localeCompare(b.opportunityId);
}
