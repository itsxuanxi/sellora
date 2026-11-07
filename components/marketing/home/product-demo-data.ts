import type { FollowUpItem } from "@/lib/followup/rules";
import type { RiskKind } from "@/lib/risk/kinds";

/**
 * The pipeline the homepage demos run on.
 *
 * Typed as `FollowUpItem` on purpose, which is the type the product's own
 * ranker takes. That is what lets `rankFollowUps` — the function Today
 * calls — sort this list rather than a lookalike written for marketing. If
 * the rules change, this demo changes with them or stops compiling; it
 * cannot quietly keep demonstrating an ordering the product no longer uses.
 *
 * That mattered here. The previous homepage demo sorted by deal value times
 * a win probability and animated the reorder, months after the application
 * had stopped deciding anything that way.
 *
 * Five invented agency deals. Every figure is sample data and the page says
 * so; the shapes are drawn from what a small studio's pipeline looks like —
 * a handful of live proposals, one of them quietly dead.
 */

export interface DemoEvidence {
  /** What happened, in the words a record would hold. */
  label: string;
  /** The date on the record. Relative days, rendered at display time. */
  daysAgo: number;
  /** Read off a record, or reasoned from several. */
  basis: "observed" | "inferred";
  /** The source, so a reader can see it is not one system guessing. */
  source: string;
}

export interface DemoDealCard extends FollowUpItem {
  contactName: string;
  contactRole: string;
  /** The risk, in the product's single public vocabulary. */
  risk: RiskKind;
  /** Why this one is on the list, as the card says it. */
  headline: string;
  /** What Selryn would write, and what it would cite. */
  draft: { subject: string; body: string };
}

/**
 * `FollowUpItem` carries an `evidence` array of `EvidenceRef`, which these
 * do not need — the demo renders `DemoEvidence` instead, which has the basis
 * badge on it. Empty satisfies the type without inventing event ids that
 * point at nothing.
 */
const NO_REFS: FollowUpItem["evidence"] = [];

export const DEMO_PIPELINE: DemoDealCard[] = [
  {
    opportunityId: "d_northwind",
    accountName: "Northwind Studio",
    contactName: "Priya Raman",
    contactRole: "Head of Marketing",
    amount: 18_000,
    currency: "USD",
    stage: "Proposal",
    stageKey: "PROPOSAL",
    lastActivityAt: null,
    rule: "followup_due",
    risk: "followup_overdue",
    action: "Send the timings you promised, or tell them when you will",
    because: "You said you would send revised timings on the 2nd. Nothing went out.",
    headline: "You owe them the next step",
    daysOverdue: 5,
    staleness: null,
    evidence: NO_REFS,
    draft: {
      subject: "The revised timings I promised",
      body: "Hi Priya,\n\nI said I'd come back to you with revised timings on Monday and I didn't — sorry about that.\n\nThe short version: we can start the week of the 24th and have the first round with you fifteen working days later.\n\nDoes that still work on your end?\n\nAlex",
    },
  },
  {
    opportunityId: "d_cloudmint",
    accountName: "Cloudmint",
    contactName: "Maya Chen",
    contactRole: "VP Finance",
    amount: 42_000,
    currency: "USD",
    stage: "Proposal",
    stageKey: "PROPOSAL",
    lastActivityAt: null,
    rule: "quote_no_reply",
    risk: "awaiting_response",
    action: "Follow up on the proposal with Cloudmint",
    because: "The proposal went out 11 days ago and nobody has answered it.",
    headline: "Your proposal has had no answer",
    daysOverdue: 11,
    staleness: null,
    evidence: NO_REFS,
    draft: {
      subject: "Anything blocking the proposal?",
      body: "Hi Maya,\n\nYou've had the proposal since the 27th and I know a second person joined the thread after it went out.\n\nRather than chase it — is there anything in there that needs changing before it can go anywhere? Happy to rework the scope or the staging.\n\nAlex",
    },
  },
  {
    opportunityId: "d_brightcart",
    accountName: "Brightcart",
    contactName: "Emily Tran",
    contactRole: "COO",
    amount: 65_000,
    currency: "USD",
    stage: "Meeting",
    stageKey: "MEETING",
    lastActivityAt: null,
    rule: "no_next_step",
    risk: "meeting_no_next_step",
    action: "Book the next step with Brightcart",
    because: "The call happened three days ago and nothing is in the calendar after it.",
    headline: "A call with nothing booked after it",
    daysOverdue: 3,
    staleness: null,
    evidence: NO_REFS,
    draft: {
      subject: "Next step after Tuesday",
      body: "Hi Emily,\n\nGood call on Tuesday. We left it at \"let's scope the migration\" and I don't think either of us put anything in the diary.\n\nI've got Thursday afternoon or any time Friday. Shall I send something over?\n\nAlex",
    },
  },
  {
    opportunityId: "d_kanari",
    accountName: "Kanari HR",
    contactName: "James Whitfield",
    contactRole: "Founder",
    amount: 8_500,
    currency: "USD",
    stage: "Qualifying",
    stageKey: "QUALIFYING",
    lastActivityAt: null,
    rule: "gone_quiet",
    risk: "no_recent_activity",
    action: "Re-open the conversation, or close it",
    because: "Nothing has happened on this deal for 34 days.",
    headline: "The conversation has stopped",
    daysOverdue: 34,
    staleness: "The newest record on this deal is 34 days old — check before acting on it.",
    evidence: NO_REFS,
    draft: {
      subject: "Still worth a conversation?",
      body: "Hi James,\n\nIt's been over a month since we spoke and I'd rather ask than keep guessing: is this still something you want to do this quarter?\n\nA straight no is genuinely fine and saves us both the follow-ups.\n\nAlex",
    },
  },
  {
    opportunityId: "d_ledgerly",
    accountName: "Ledgerly",
    contactName: "Sofia Herrera",
    contactRole: "Head of Sales",
    amount: 30_000,
    currency: "USD",
    stage: "Negotiation",
    stageKey: "NEGOTIATION",
    lastActivityAt: null,
    rule: "gone_quiet",
    risk: "no_recent_activity",
    action: "Nothing — they replied yesterday",
    because: "They answered yesterday and the ball is with you, not overdue yet.",
    headline: "Answered yesterday, nothing overdue",
    daysOverdue: 0,
    staleness: null,
    evidence: NO_REFS,
    draft: {
      subject: "Re: contract redlines",
      body: "Hi Sofia,\n\nThanks for turning those round so quickly. Reading them properly today and will come back tomorrow.\n\nAlex",
    },
  },
];

/**
 * The records behind each deal, with where each one came from.
 *
 * Split by basis because that distinction is the most differentiated thing
 * the product has and the hardest to convey in a screenshot. "The follow-up
 * date on this deal passed" is read off a field. "They are waiting on you"
 * is reasoned from the absence of a reply — true, useful, and not the same
 * kind of statement. Every competitor's demo shows the second as if it were
 * the first.
 */
export const DEMO_EVIDENCE: Record<string, DemoEvidence[]> = {
  d_northwind: [
    { label: "Next step “send revised timings” was due", daysAgo: 5, basis: "observed", source: "CRM field" },
    { label: "You last wrote “Scope v2 — for review”", daysAgo: 12, basis: "observed", source: "Email" },
    { label: "Nothing has been sent since that date passed", daysAgo: 5, basis: "inferred", source: "Reasoned from the two above" },
  ],
  d_cloudmint: [
    { label: "You sent “Proposal — Q2 brand sprint”", daysAgo: 11, basis: "observed", source: "Email" },
    { label: "Opened twice, the second time for six minutes", daysAgo: 9, basis: "observed", source: "Email" },
    { label: "Maya Chen joined the thread after it went out", daysAgo: 8, basis: "observed", source: "Email" },
    { label: "They are waiting on you, not the other way round", daysAgo: 11, basis: "inferred", source: "Reasoned from no reply since" },
  ],
  d_brightcart: [
    { label: "Discovery call, 45 minutes, marked complete", daysAgo: 3, basis: "observed", source: "Calendar" },
    { label: "No event on this deal after that call", daysAgo: 3, basis: "observed", source: "CRM field" },
    { label: "The momentum from the call is being lost", daysAgo: 3, basis: "inferred", source: "Reasoned from the gap" },
  ],
  d_kanari: [
    { label: "You last wrote “Quick idea for Kanari”", daysAgo: 34, basis: "observed", source: "Email" },
    { label: "Nothing has come back", daysAgo: 34, basis: "observed", source: "Email" },
    { label: "This has probably gone cold", daysAgo: 34, basis: "inferred", source: "Reasoned from 34 days of silence" },
  ],
  d_ledgerly: [
    { label: "Sofia replied with contract redlines", daysAgo: 1, basis: "observed", source: "Email" },
    { label: "Nothing is overdue on this one", daysAgo: 1, basis: "inferred", source: "Reasoned from the reply" },
  ],
};

/** The order a CRM shows them in: biggest first. The starting state. */
export const BY_DEAL_VALUE = [...DEMO_PIPELINE].sort(
  (a, b) => (b.amount ?? 0) - (a.amount ?? 0)
);
