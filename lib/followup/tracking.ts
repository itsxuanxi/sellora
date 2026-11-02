/**
 * What happened after a follow-up went out.
 *
 * Two things this file refuses to do, both of which are easy and wrong:
 *
 *  1. **Infer an outcome from the send.** A sent email is not a meeting and
 *     not a stage change. Those come from the CRM or from a person confirming
 *     them; until then the follow-up is simply "sent, waiting".
 *  2. **Claim credit for a win.** A deal closes because of many things over
 *     many weeks. The statistics below report replies and recorded movement,
 *     and deliberately contain no revenue figure and no win attribution.
 *
 * Pure: the shapes come in, the numbers go out, and every definition is
 * written next to the arithmetic that implements it.
 */

export type FollowUpOutcome =
  /** Drafted, nobody has confirmed it. */
  | "awaiting_confirmation"
  /** Confirmed and sent; nothing back yet. */
  | "sent"
  /** A genuine customer reply landed on this thread. */
  | "replied"
  /** A meeting was recorded in the CRM after it. */
  | "meeting_booked"
  /** The deal moved stage after it. */
  | "stage_changed"
  /** The send failed; the draft was kept. */
  | "failed";

export const OUTCOME_LABEL: Record<FollowUpOutcome, string> = {
  awaiting_confirmation: "Waiting for you to confirm",
  sent: "Sent — no reply yet",
  replied: "They replied",
  meeting_booked: "Meeting booked",
  stage_changed: "Deal moved stage",
  failed: "Send failed",
};

export interface TrackedFollowUp {
  id: string;
  status: string;
  sentAt: Date | null;
  repliedAt: Date | null;
  edited: boolean;
  /** Recorded in the CRM after the send — never inferred from it. */
  meetingAt: Date | null;
  stageChangedAt: Date | null;
}

/**
 * The single state to show for one follow-up.
 *
 * Ordered by how far the deal got, so a thread that replied *and* booked a
 * meeting reports the meeting.
 */
export function outcomeOf(f: TrackedFollowUp): FollowUpOutcome {
  if (f.status === "FAILED") return "failed";
  if (f.status !== "SENT" || !f.sentAt) return "awaiting_confirmation";
  if (f.stageChangedAt) return "stage_changed";
  if (f.meetingAt) return "meeting_booked";
  if (f.repliedAt) return "replied";
  return "sent";
}

export interface FollowUpStats {
  /** Follow-ups Selryn drafted that a person actually sent. */
  suggested: number;
  sent: number;
  sentUnedited: number;
  /** Sent follow-ups that drew a genuine customer reply. */
  replied: number;
  /** Sent follow-ups followed by a meeting or stage change in the CRM. */
  progressed: number;
}

export interface StatLine {
  label: string;
  value: string;
  /** The denominator, spelled out. Shown, not hidden in a tooltip. */
  definition: string;
}

function percent(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function summarize(drafts: TrackedFollowUp[]): FollowUpStats {
  const sent = drafts.filter((d) => d.status === "SENT" && d.sentAt);
  return {
    suggested: drafts.length,
    sent: sent.length,
    sentUnedited: sent.filter((d) => !d.edited).length,
    replied: sent.filter((d) => d.repliedAt).length,
    progressed: sent.filter((d) => d.meetingAt || d.stageChangedAt).length,
  };
}

/**
 * The three numbers, each carrying the denominator it was computed over.
 *
 * A rate without its denominator is the easiest number in a sales tool to
 * misread — "80% reply rate" over five sends is noise — so the definition
 * travels with the figure rather than living in a help page.
 */
export function statLines(stats: FollowUpStats): StatLine[] {
  return [
    {
      label: "Suggestions you acted on",
      value: percent(stats.sent, stats.suggested),
      definition: `${stats.sent} of ${stats.suggested} drafted follow-ups were sent. ${stats.sentUnedited} went out unedited.`,
    },
    {
      label: "Replies after a follow-up",
      value: percent(stats.replied, stats.sent),
      definition: `${stats.replied} of ${stats.sent} sent follow-ups drew a reply. Automatic replies and bounces are excluded.`,
    },
    {
      label: "Deals that moved afterwards",
      value: percent(stats.progressed, stats.sent),
      definition: `${stats.progressed} of ${stats.sent} were followed by a meeting or a stage change recorded in your CRM. This is a sequence, not a cause — the follow-up is not credited with the outcome.`,
    },
  ];
}

/** Shown under the statistics, in full. */
export const STATS_CAVEAT =
  "These count what happened after a follow-up, in order. They do not attribute deals to it: a deal that closes does so for many reasons, and Selryn does not claim one of them.";
