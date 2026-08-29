/**
 * The shape of a notification, independent of where it is going.
 *
 * Email is the only channel implemented today; Slack and Teams are planned.
 * They are named here because the whole point of a shared shape is that
 * adding a channel means writing a renderer, not re-deriving what a digest
 * is — the composition in `digest.ts` must never learn about Slack blocks.
 */

export type NotificationKind = "daily_digest" | "risk_alert" | "escalation";
export type NotificationChannel = "email" | "slack" | "teams";

/** One deal, as a notification talks about it. */
export interface NotifiedDeal {
  opportunityId: string;
  company: string;
  stage: string;
  dealValue: number;
  winProbability: number;
  expectedValue: number;
  currency: string;
  /** Why this deal is in the message at all. */
  reason: string;
  /** The single recommended next step. */
  nextAction: string;
  urgency: string;
  /** Expected revenue exposed by the leak; 0 when nothing is leaking. */
  atRisk: number;
  url: string;
}

/**
 * A composed message, before it is rendered for any particular channel.
 *
 * `dedupeKey` is part of the message rather than the sender because only the
 * composer knows what makes this notification the same as another one — a
 * digest is one per user per day, an alert is one per deal per cooldown.
 */
export interface NotificationMessage {
  kind: NotificationKind;
  dedupeKey: string;
  subject: string;
  /** One line stating the point, before any detail. */
  headline: string;
  deals: NotifiedDeal[];
  summary: {
    revenueAtRisk: string;
    openPipeline: string;
    openCount: number;
  };
  /** Deep link to the screen that answers the message. */
  primaryUrl: string;
  primaryLabel: string;
}
