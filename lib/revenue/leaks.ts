import {
  LEAK_RULE_BY_TYPE,
  LEAK_THRESHOLDS,
  REOPEN_PROBABILITY,
  STAGE_EXPECTED_CADENCE_DAYS,
  isOpenStage,
  type LeakSeverity,
  type LeakType,
  type OpportunityStage,
} from "@/lib/revenue/config";
import type { SignalType } from "@/lib/intent/config";

/**
 * Revenue leak detection (§4, §8).
 *
 * A "leak" is a specific, nameable way a deal is being lost for reasons that
 * have nothing to do with whether the buyer wants the product: nobody
 * followed up, the proposal went unopened-on, the meeting produced no next
 * step. These are the losses that are actually recoverable.
 *
 * Pure and computed live rather than stored. That is a deliberate choice: a
 * leak is a *current state* ("no follow-up for 4 days"), not an event. If it
 * were a table it would need a cron job to stay true, and a stale leak table
 * is worse than none — it would tell a rep to chase a deal they closed
 * yesterday. Recommendations, which are decisions rather than states, ARE
 * persisted (see lib/revenue/recommendations.ts).
 */

export interface LeakInput {
  stage: OpportunityStage | string;
  score: number;
  dealValue: number;
  winProbability: number;
  lastInteractionAt: Date | null;
  lastInteractionKind: string | null;
  nextStepDueAt: Date | null;
  closedAt: Date | null;
  /** Most recent meeting on this opportunity, if any. */
  lastMeetingAt: Date | null;
  /** When the prospect last opened the proposal. */
  proposalOpenedAt: Date | null;
  /** When you last contacted them (outbound only). */
  lastOutboundAt: Date | null;
  /**
   * When *we* last did anything — an email sent, a call, a meeting, or a
   * manually logged touch. Distinct from `lastInteractionAt`, which also
   * counts things the prospect did (an open, a reply): a prospect opening
   * your email is not you following up. Rules that ask "has anyone actioned
   * this?" must use this, or acting on a recommendation would never clear
   * the leak that produced it.
   */
  lastTouchAt: Date | null;
  /** True when the prospect has never replied to any outbound. */
  neverReplied: boolean;
  /** Active signals on the account, newest first. */
  signals: { signalType: SignalType | string; occurredAt: Date; title: string }[];
}

export interface DetectedLeak {
  type: LeakType;
  category: string;
  severity: LeakSeverity;
  /** One sentence: what is happening and why it matters. */
  summary: string;
  /** The specific evidence, e.g. "Proposal opened 2× · no contact for 4 days". */
  evidence: string[];
  /** Days the leak has been open — drives urgency. */
  ageDays: number;
}

function daysSince(d: Date, now: Date): number {
  return Math.max(0, (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Returns every leak affecting an opportunity, most severe first. Most
 * callers want `[0]` — the headline problem — but the detail page shows all
 * of them.
 */
export function detectLeaks(input: LeakInput, now: Date = new Date()): DetectedLeak[] {
  const leaks: DetectedLeak[] = [];
  const open = isOpenStage(input.stage);

  const quietDays = input.lastInteractionAt ? daysSince(input.lastInteractionAt, now) : null;
  // Prefer the broader "we did something" timestamp, falling back to email.
  const lastTouchAt = input.lastTouchAt ?? input.lastOutboundAt;
  const sinceOutbound = lastTouchAt ? daysSince(lastTouchAt, now) : null;

  const make = (
    type: LeakType,
    summary: string,
    evidence: string[],
    ageDays: number
  ): DetectedLeak => {
    const rule = LEAK_RULE_BY_TYPE[type];
    return {
      type,
      category: rule.category,
      severity: rule.severity,
      summary,
      evidence,
      ageDays: Math.floor(ageDays),
    };
  };

  // ── Previously lost, new buying signal ──────────────────────────────────
  // Checked first because it is the only rule that applies to a closed deal.
  if (!open && input.stage === "LOST") {
    const fresh = input.signals.filter(
      (s) =>
        daysSince(s.occurredAt, now) <= LEAK_THRESHOLDS.lostRevivalSignalDays &&
        (input.closedAt ? s.occurredAt > input.closedAt : true)
    );
    if (fresh.length > 0) {
      leaks.push(
        make(
          "lost_with_new_signal",
          `A deal you closed as lost is showing buying signals again.`,
          [
            ...fresh.slice(0, 3).map((s) => s.title),
            input.closedAt ? `Closed lost ${plural(Math.floor(daysSince(input.closedAt, now)), "day")} ago` : "",
          ].filter(Boolean),
          daysSince(fresh[0].occurredAt, now)
        )
      );
    }
    return leaks; // no other rule is meaningful on a closed deal
  }

  if (!open) return leaks; // WON — nothing leaking

  // ── Proposal viewed, no follow-up ───────────────────────────────────────
  if (input.proposalOpenedAt) {
    const sinceOpen = daysSince(input.proposalOpenedAt, now);
    const contactedSinceOpen =
      lastTouchAt != null && lastTouchAt > input.proposalOpenedAt;
    if (!contactedSinceOpen && sinceOpen >= LEAK_THRESHOLDS.proposalFollowUpDays) {
      const opens = input.signals.filter((s) => s.signalType === "proposal_opened").length;
      leaks.push(
        make(
          "proposal_viewed_no_followup",
          `They opened your proposal and nobody has followed up since.`,
          [
            opens > 1 ? `Proposal opened ${opens}×` : "Proposal opened",
            `No contact for ${plural(Math.floor(sinceOpen), "day")}`,
          ],
          sinceOpen
        )
      );
    }
  }

  // ── High intent, no response ────────────────────────────────────────────
  if (
    input.score >= LEAK_THRESHOLDS.highIntentScore &&
    input.neverReplied &&
    sinceOutbound != null &&
    sinceOutbound >= 3
  ) {
    leaks.push(
      make(
        "high_intent_no_response",
        `Strong buying signals, but they have never replied to you.`,
        [
          `Opportunity score ${input.score}`,
          ...input.signals.slice(0, 2).map((s) => s.title),
          `Last contacted ${plural(Math.floor(sinceOutbound), "day")} ago`,
        ],
        sinceOutbound
      )
    );
  }

  // ── Meeting completed, no next step ─────────────────────────────────────
  if (input.lastMeetingAt && !input.nextStepDueAt) {
    const sinceMeeting = daysSince(input.lastMeetingAt, now);
    if (sinceMeeting >= LEAK_THRESHOLDS.meetingNextStepDays) {
      leaks.push(
        make(
          "meeting_no_next_step",
          `A meeting happened ${plural(Math.floor(sinceMeeting), "day")} ago and nothing was scheduled after it.`,
          ["Meeting completed", "No next step on the calendar"],
          sinceMeeting
        )
      );
    }
  }

  // ── Next step past due ──────────────────────────────────────────────────
  if (input.nextStepDueAt && input.nextStepDueAt < now) {
    const overdue = daysSince(input.nextStepDueAt, now);
    leaks.push(
      make(
        "needs_follow_up",
        `The next step on this deal is ${plural(Math.floor(overdue) || 1, "day")} overdue.`,
        [`Due ${input.nextStepDueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`],
        overdue
      )
    );
  }

  // ── Going cold ──────────────────────────────────────────────────────────
  // Uses the stage's expected cadence, so a NEGOTIATION deal is flagged
  // sooner than a NEW one — silence costs more late in the cycle.
  if (quietDays != null) {
    const cadence = STAGE_EXPECTED_CADENCE_DAYS[input.stage as OpportunityStage] ?? 7;
    const threshold = Math.max(cadence, LEAK_THRESHOLDS.goingColdDays);
    if (quietDays >= threshold) {
      leaks.push(
        make(
          "going_cold",
          `No activity for ${plural(Math.floor(quietDays), "day")} on a deal that was moving.`,
          [
            input.lastInteractionKind
              ? `Last interaction: ${describeInteraction(input.lastInteractionKind)}`
              : "No recent interaction",
            `Stage: ${input.stage}`,
          ],
          quietDays
        )
      );
    }
  }

  // Severity first, then age — an old critical leak outranks a fresh warning.
  const order: Record<LeakSeverity, number> = { critical: 0, warning: 1, watch: 2 };
  return leaks.sort(
    (a, b) => order[a.severity] - order[b.severity] || b.ageDays - a.ageDays
  );
}

export function describeInteraction(kind: string): string {
  const map: Record<string, string> = {
    email_sent: "Email sent",
    email_opened: "Email opened",
    email_replied: "They replied",
    meeting: "Meeting held",
    proposal_sent: "Proposal sent",
    call: "Call",
    note: "Note added",
  };
  return map[kind] ?? kind.replace(/_/g, " ");
}

/**
 * Money genuinely at risk from a leak. Not the full deal value — a deal at
 * QUALIFYING was never 100% yours to lose — but the expected revenue that
 * evaporates if the leak is left unaddressed, scaled by severity.
 *
 * Deliberately conservative. Inflating "revenue at risk" to make the
 * dashboard look dramatic would destroy the number's credibility the first
 * time a VP checked it against their CRM.
 */
export function revenueAtRisk(
  dealValue: number,
  winProbability: number,
  severity: LeakSeverity,
  leakType?: LeakType
): number {
  const exposure: Record<LeakSeverity, number> = {
    critical: 1,
    warning: 0.6,
    watch: 0.3,
  };

  // A closed-lost deal has a win probability of zero — correctly, because it
  // was lost. But a lost deal showing fresh intent is a *recovery* worth
  // pricing, and multiplying by zero would render it as "$0 at risk", which
  // tells the reader nothing. Price it off the odds of reopening instead.
  const probability =
    leakType === "lost_with_new_signal" && winProbability === 0
      ? REOPEN_PROBABILITY
      : winProbability;

  return Math.round((dealValue * probability * exposure[severity]) / 100);
}
