import {
  ACTION_LABELS,
  LEAK_RULE_BY_TYPE,
  isOpenStage,
  type ActionType,
  type OpportunityStage,
  type Urgency,
} from "@/lib/revenue/config";
import type { DetectedLeak } from "@/lib/revenue/leaks";
import { expectedRevenue } from "@/lib/revenue/money";

/**
 * The Next Best Action engine (§7).
 *
 * For every opportunity it returns exactly ONE action. That constraint is
 * the product: a list of five things a rep could do is the problem Sellora
 * exists to solve, not the solution. The runner-up actions are returned
 * separately so the detail page can offer alternatives without diluting the
 * recommendation.
 *
 * Priority order:
 *   1. An open leak — recovering money beats advancing it.
 *   2. The stage's natural next step.
 *   3. Wait, when there is genuinely nothing useful to do. "Wait" is a real
 *      recommendation, not a fallback: telling a rep to leave a deal alone
 *      is as valuable as telling them to chase it.
 */

export interface NextActionInput {
  stage: OpportunityStage | string;
  score: number;
  dealValue: number;
  winProbability: number;
  contactName: string | null;
  accountName: string;
  leaks: DetectedLeak[];
  /** Days since any interaction, null if never contacted. */
  quietDays: number | null;
  hasProposal: boolean;
  hasMeeting: boolean;
  theyRepliedLast: boolean;
}

export interface NextAction {
  actionType: ActionType;
  /** The imperative, e.g. "Send a personal follow-up today". */
  headline: string;
  /** Why — cites the actual evidence, never generic encouragement. */
  rationale: string;
  urgency: Urgency;
  expectedValue: number;
  /** Set when this action came from a leak, so the UI can link the two. */
  leakType: string | null;
  /** Other reasonable moves, for the "or…" row on the detail page. */
  alternatives: { actionType: ActionType; label: string }[];
  /** Stable key so regenerating the feed updates rather than duplicates. */
  dedupeKey: string;
}

function urgencyFromLeak(leak: DetectedLeak): Urgency {
  if (leak.severity === "critical") return leak.ageDays >= 3 ? "now" : "today";
  if (leak.severity === "warning") return leak.ageDays >= 10 ? "today" : "this_week";
  return "monitor";
}

export function decideNextAction(input: NextActionInput): NextAction {
  const who = input.contactName ?? input.accountName;
  const value = expectedRevenue(input.dealValue, input.winProbability);
  const leak = input.leaks[0] ?? null;

  // ── 1. Fix the leak ─────────────────────────────────────────────────────
  if (leak) {
    const rule = LEAK_RULE_BY_TYPE[leak.type];
    let actionType = rule.recommends;
    let headline: string;
    let rationale: string;

    switch (leak.type) {
      case "proposal_viewed_no_followup":
        // A big deal that has gone quiet after a proposal warrants the
        // founder, not another email into the void.
        actionType = value >= 20_000 && leak.ageDays >= 4 ? "escalate_founder" : "follow_up";
        headline =
          actionType === "escalate_founder"
            ? `Have the founder contact ${who} directly`
            : `Send ${who} a personal follow-up today`;
        rationale = `${leak.summary} ${leak.evidence.join(" · ")}. Deals contacted within 24 hours of a proposal open convert materially better than ones left to cool.`;
        break;

      case "high_intent_no_response":
        actionType = "call";
        headline = `Call ${who} — email is not landing`;
        rationale = `${leak.summary} ${leak.evidence.join(" · ")}. When the signals are this strong and email is not working, switching channel is usually what breaks the silence.`;
        break;

      case "meeting_no_next_step":
        actionType = "book_meeting";
        headline = `Get the next meeting with ${who} on the calendar`;
        rationale = `${leak.summary} A deal without a scheduled next step is the single most common way a promising conversation quietly ends.`;
        break;

      case "needs_follow_up":
        actionType = "follow_up";
        headline = `Follow up with ${who} — this is overdue`;
        rationale = `${leak.summary} ${leak.evidence.join(" · ")}.`;
        break;

      case "going_cold":
        actionType = input.hasMeeting ? "send_case_study" : "reengage";
        headline =
          actionType === "send_case_study"
            ? `Re-open the conversation with ${who} using a case study`
            : `Re-engage ${who} before this goes cold`;
        rationale = `${leak.summary} ${leak.evidence.join(" · ")}. Giving them a reason to reply beats another "just checking in".`;
        break;

      case "lost_with_new_signal":
        actionType = "reengage";
        headline = `Reopen ${input.accountName} — they are showing intent again`;
        rationale = `${leak.summary} ${leak.evidence.join(" · ")}. Circumstances that killed the deal may have changed.`;
        break;
    }

    return {
      actionType,
      headline,
      rationale,
      urgency: urgencyFromLeak(leak),
      expectedValue: value,
      leakType: leak.type,
      alternatives: alternativesFor(actionType, input),
      dedupeKey: `leak:${leak.type}`,
    };
  }

  // ── 2. Advance the stage ────────────────────────────────────────────────
  const stage = input.stage as OpportunityStage;

  if (!isOpenStage(stage)) {
    return {
      actionType: "wait",
      headline: stage === "WON" ? "Nothing to do — this one is closed won" : "Closed — no action",
      rationale:
        stage === "WON"
          ? "This deal is won. Sellora keeps it here so its history can inform future scoring."
          : "This deal is closed. Sellora will resurface it if fresh buying signals appear.",
      urgency: "monitor",
      expectedValue: 0,
      leakType: null,
      alternatives: [],
      dedupeKey: `stage:${stage}`,
    };
  }

  const byStage: Record<string, { action: ActionType; headline: string; rationale: string; urgency: Urgency }> = {
    NEW: {
      action: "qualify",
      headline: `Qualify ${who} before investing more time`,
      rationale: `This opportunity has not been qualified yet. One good question about budget, timeline or the problem they are solving decides whether it deserves your attention at all.`,
      urgency: "this_week",
    },
    QUALIFYING: {
      action: "book_meeting",
      headline: `Book a discovery call with ${who}`,
      rationale: `${who} is engaged but there is no meeting on the calendar. Getting to a live conversation is the highest-leverage move at this stage.`,
      urgency: input.score >= 70 ? "today" : "this_week",
    },
    MEETING: {
      action: input.hasProposal ? "follow_up" : "send_proposal",
      headline: input.hasProposal
        ? `Follow up on the proposal with ${who}`
        : `Send ${who} a proposal`,
      rationale: input.hasProposal
        ? `The proposal is out and the meeting went ahead. A short, specific follow-up is what moves this to a decision.`
        : `You have had the meeting. Putting a concrete proposal in front of ${who} while the conversation is warm is the natural next step.`,
      urgency: "today",
    },
    PROPOSAL: {
      action: "follow_up",
      headline: `Check in with ${who} on the proposal`,
      rationale: `The proposal is with them. A brief check-in that offers something useful — a reference, an answer to a likely objection — keeps it moving without pestering.`,
      urgency: "this_week",
    },
    NEGOTIATION: {
      action: input.theyRepliedLast ? "follow_up" : "call",
      headline: input.theyRepliedLast
        ? `Respond to ${who} — they are waiting on you`
        : `Call ${who} to close out the open points`,
      rationale: input.theyRepliedLast
        ? `${who} responded last. At negotiation stage the ball being in your court is the expensive kind of delay.`
        : `This deal is close. Remaining questions get resolved faster on a call than over email.`,
      urgency: input.theyRepliedLast ? "now" : "today",
    },
  };

  const chosen = byStage[stage] ?? byStage.NEW;

  // ── 3. Genuinely nothing to do ──────────────────────────────────────────
  // Recently contacted, no leak, early stage — chasing again would hurt.
  if (input.quietDays != null && input.quietDays < 2 && input.score < 55) {
    return {
      actionType: "wait",
      headline: `Wait — you contacted ${who} recently`,
      rationale: `You reached out ${input.quietDays < 1 ? "today" : "yesterday"} and there are no new signals. Following up again this soon tends to cost more goodwill than it gains. Sellora will flag this the moment that changes.`,
      urgency: "monitor",
      expectedValue: value,
      leakType: null,
      alternatives: [],
      dedupeKey: "wait:recent_contact",
    };
  }

  return {
    actionType: chosen.action,
    headline: chosen.headline,
    rationale: chosen.rationale,
    urgency: chosen.urgency,
    expectedValue: value,
    leakType: null,
    alternatives: alternativesFor(chosen.action, input),
    dedupeKey: `stage:${stage}`,
  };
}

function alternativesFor(primary: ActionType, input: NextActionInput) {
  const pool: ActionType[] = ["follow_up", "call", "book_meeting", "send_case_study"];
  if (input.hasMeeting && !input.hasProposal) pool.push("send_proposal");
  if (input.score < 35 && input.quietDays != null && input.quietDays > 30) pool.push("close_lost");
  if (input.dealValue >= 20_000) pool.push("escalate_founder");

  return pool
    .filter((a) => a !== primary)
    .slice(0, 3)
    .map((a) => ({ actionType: a, label: ACTION_LABELS[a] }));
}
