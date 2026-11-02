/**
 * When a drafted follow-up may actually be sent.
 *
 * Pulled out of the server action and made pure because this is the decision
 * that reaches a customer's inbox. The rules it enforces are the ones the
 * product promises: a human confirmed this exact text, and a second click
 * cannot send it twice.
 *
 * The state is deliberately checked rather than trusted. A send that is
 * already in flight has `sendClaimedAt` set and the claim is never cleared —
 * a draft that failed is reopened by producing a *new* draft, not by clearing
 * the flag, because clearing it is how a crash mid-send turns into a second
 * email the customer has already received.
 */

export type SendRefusal =
  | "not_found"
  | "already_sent"
  | "send_in_progress"
  | "not_confirmed"
  | "empty_body"
  | "no_recipient"
  | "stale_confirmation";

export interface SendCandidate {
  status: string;
  toAddress: string | null;
  subject: string;
  body: string;
  sendClaimedAt: Date | null;
  sentAt: Date | null;
}

export interface SendRequest {
  /**
   * The exact body the person saw when they pressed send.
   *
   * Compared against the stored draft so a send cannot carry text the
   * confirmer never read — the failure mode where someone edits in one tab,
   * confirms in another, and a regenerated draft goes out instead.
   */
  confirmedBody: string;
  confirmedSubject: string;
  /** The explicit click. Never defaulted to true anywhere. */
  confirmed: boolean;
}

export type SendDecision =
  | { allowed: true }
  | { allowed: false; reason: SendRefusal; message: string };

const MESSAGES: Record<SendRefusal, string> = {
  not_found: "That draft no longer exists.",
  already_sent: "This follow-up has already been sent.",
  send_in_progress: "This follow-up is already being sent.",
  not_confirmed: "A follow-up is only sent after you confirm it.",
  empty_body: "The draft is empty — write something before sending.",
  no_recipient: "This contact has no email address on file.",
  stale_confirmation:
    "The draft changed since you opened it. Review the new text, then send.",
};

function refuse(reason: SendRefusal): SendDecision {
  return { allowed: false, reason, message: MESSAGES[reason] };
}

/** Normalizes only what cannot change meaning: trailing whitespace. */
function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

export function decideSend(
  draft: SendCandidate | null,
  request: SendRequest
): SendDecision {
  if (!draft) return refuse("not_found");

  // Order matters. "Already sent" is reported before anything about the
  // request, so a double click gets a truthful answer rather than a
  // complaint about its payload.
  if (draft.status === "SENT" || draft.sentAt) return refuse("already_sent");
  if (draft.sendClaimedAt) return refuse("send_in_progress");

  if (!request.confirmed) return refuse("not_confirmed");
  if (!draft.toAddress) return refuse("no_recipient");
  if (!normalize(request.confirmedBody)) return refuse("empty_body");

  if (
    normalize(request.confirmedBody) !== normalize(draft.body) ||
    normalize(request.confirmedSubject) !== normalize(draft.subject)
  ) {
    return refuse("stale_confirmation");
  }

  return { allowed: true };
}

/**
 * Whether a failed send may be retried.
 *
 * It may not — not by reusing this row. A failure leaves the draft intact so
 * nothing the person wrote is lost, but the send claim stands, because the
 * one thing we cannot know after a transport error is whether the provider
 * accepted the message. Retrying means a fresh draft and a fresh confirmation.
 */
export function canRetrySameDraft(): false {
  return false;
}
