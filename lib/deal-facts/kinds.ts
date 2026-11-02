/**
 * What Selryn tries to know about a proposal, and how surely it knows it.
 *
 * An agency owner looking at a stalled proposal is asking five questions:
 * who actually decides, what budget was discussed, what they objected to,
 * what is still unclear about scope, and when they said they would decide.
 * Those are the kinds below. Nothing here is scored or predicted — each is
 * either on record, suggested from the conversation, or unknown.
 *
 * The three-way distinction matters more than the extraction. A budget the
 * client stated in writing, a budget the model inferred, and a budget nobody
 * has mentioned are different facts, and rendering them alike is how a tool
 * teaches its user to distrust all of it.
 */

export const FACT_KINDS = [
  "decision_maker",
  "budget",
  "objection",
  "scope_question",
  "decision_date",
  "service",
] as const;

export type FactKind = (typeof FACT_KINDS)[number];

export const FACT_LABEL: Record<FactKind, string> = {
  decision_maker: "Who decides",
  budget: "Budget discussed",
  objection: "Objection raised",
  scope_question: "Open scope question",
  decision_date: "Decision expected",
  service: "Service proposed",
};

/** What an empty slot should say — never a blank that might be a zero. */
export const FACT_UNKNOWN: Record<FactKind, string> = {
  decision_maker: "Not established yet",
  budget: "Never discussed on record",
  objection: "None recorded",
  scope_question: "None open",
  decision_date: "No date given",
  service: "Not specified",
};

/**
 * CONFIRMED — a person settled it, by entering or approving it.
 * SUGGESTED — extracted from the conversation and not yet reviewed.
 * Absence of a row means unknown, which is a third state, not a blank.
 */
export type FactStatus = "CONFIRMED" | "SUGGESTED";

export const STATUS_LABEL: Record<FactStatus, string> = {
  CONFIRMED: "Confirmed",
  SUGGESTED: "Suggested by Selryn",
};

export type FactSource = "email" | "crm" | "user";

export const SOURCE_LABEL: Record<FactSource, string> = {
  email: "From an email",
  crm: "From your CRM",
  user: "You entered this",
};

export interface DealFactView {
  id: string;
  kind: FactKind;
  value: string;
  status: FactStatus;
  sourceKind: FactSource;
  /** RevenueEvent ids backing the claim. */
  evidence: string[];
  /** What the extraction said before a person changed it. */
  correctedFrom: string | null;
  lastVerifiedAt: Date | null;
}

/** How old a suggested fact may be before the UI calls it stale. */
export const FACT_STALE_DAYS = 45;

export function isStale(fact: DealFactView, now: Date): boolean {
  if (!fact.lastVerifiedAt) return false;
  return now.getTime() - fact.lastVerifiedAt.getTime() > FACT_STALE_DAYS * 86_400_000;
}

/**
 * The facts for one deal, one per kind, best-known first.
 *
 * Confirmed beats suggested; among equals the most recently verified wins.
 * Rejected suggestions never surface — re-offering a guess a person has
 * already corrected is how a tool becomes something to fight with.
 */
export function bestByKind(facts: DealFactView[]): Partial<Record<FactKind, DealFactView>> {
  const out: Partial<Record<FactKind, DealFactView>> = {};
  for (const fact of facts) {
    const current = out[fact.kind];
    if (!current) {
      out[fact.kind] = fact;
      continue;
    }
    const better =
      (fact.status === "CONFIRMED" && current.status !== "CONFIRMED") ||
      (fact.status === current.status &&
        (fact.lastVerifiedAt?.getTime() ?? 0) > (current.lastVerifiedAt?.getTime() ?? 0));
    if (better) out[fact.kind] = fact;
  }
  return out;
}
