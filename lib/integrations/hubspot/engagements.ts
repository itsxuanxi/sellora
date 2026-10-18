import type { SignalType } from "@/lib/intent/config";
import type { HubspotObject } from "@/lib/integrations/hubspot/mappers";

/**
 * HubSpot engagements — the activity history the priority engine runs on.
 *
 * Without this module a synced portal gives Selryn deal value and stage and
 * nothing else, so every ranking collapses to `amount × stage baseline` and
 * "why now" has nothing to say. Engagements are what make a deal *quiet*
 * rather than merely open.
 *
 * Two rules govern everything here, and both are about not lying:
 *
 *  1. **A signal is only written when HubSpot proves it.** An inbound email
 *     proves a reply. A meeting marked COMPLETED proves attendance. Nothing
 *     here infers `proposal_opened`, `pricing_page_viewed` or an email open —
 *     see the note on `proposalOpenedAt` at the bottom.
 *  2. **Who acted is recorded, not averaged.** A rep sending and a buyer
 *     replying are different evidence; `RevenueEvent.actorType` already makes
 *     that distinction and the scoring layer depends on it. Marking our own
 *     outbound as buyer activity would make every deal look engaged.
 *
 * Pure: no Prisma, no network. The sync layer handles both.
 */

/** Engagement object types, in the order they are synced. */
export const ENGAGEMENT_OBJECT_TYPES = [
  "emails",
  "meetings",
  "calls",
  "notes",
] as const;

export type EngagementObjectType = (typeof ENGAGEMENT_OBJECT_TYPES)[number];

/**
 * The OAuth scope each object type needs, and the properties to request.
 *
 * Scope strings are the part of this file least able to be verified from
 * here. `sales-email-read` is documented by HubSpot verbatim; the
 * object-specific CRM scopes are consistent across HubSpot's own community
 * answers but are absent from the legacy scopes reference, and several
 * portals report `crm.objects.notes.read` missing from the app scope picker
 * entirely.
 *
 * So none of these are requested as required. They go out as HubSpot's
 * `optional_scope`, which it drops automatically when a portal cannot grant
 * one, and a type whose scope was not granted returns 403 at fetch time and
 * is skipped. A portal that grants only meetings still gets meeting history;
 * nothing fails closed, and consent never breaks over a scope string that
 * turned out not to exist.
 */
export const ENGAGEMENT_SPECS: Record<
  EngagementObjectType,
  { scope: string; properties: string[] }
> = {
  emails: {
    scope: "sales-email-read",
    properties: ["hs_timestamp", "hs_email_direction", "hs_email_subject"],
  },
  meetings: {
    scope: "crm.objects.meetings.read",
    properties: [
      "hs_timestamp",
      "hs_meeting_title",
      "hs_meeting_outcome",
      "hs_meeting_start_time",
    ],
  },
  calls: {
    scope: "crm.objects.calls.read",
    properties: ["hs_timestamp", "hs_call_title", "hs_call_direction"],
  },
  // Body deliberately not requested: a note is a rep's private working text,
  // it is not evidence of anything the buyer did, and pulling thousands of
  // them costs tokens and widens the blast radius of a breach for no gain.
  // The timestamp alone is what `lastTouchAt` needs.
  notes: { scope: "crm.objects.notes.read", properties: ["hs_timestamp"] },
};

/** Every optional scope, for the authorize URL. */
export const ENGAGEMENT_SCOPES = ENGAGEMENT_OBJECT_TYPES.map(
  (t) => ENGAGEMENT_SPECS[t].scope
);

/**
 * The `Opportunity.lastInteractionKind` vocabulary, which is a fixed set —
 * `lib/revenue/queries.ts` tests membership of it to decide whether the last
 * interaction counted as *us* acting.
 */
export type InteractionKind =
  | "email_sent"
  | "email_replied"
  | "meeting"
  | "call"
  | "note";

export interface MappedEngagement {
  externalId: string;
  objectType: EngagementObjectType;
  occurredAt: Date;
  /** buyer = they did it, seller = we did it. Never averaged. */
  actorType: "buyer" | "seller";
  interactionKind: InteractionKind;
  /** RevenueEvent.eventType, e.g. "email.replied". */
  eventType: string;
  /** Written only when the engagement itself is the proof. Usually null. */
  signal: { type: SignalType; title: string } | null;
  dealIds: string[];
  contactIds: string[];
  title: string | null;
}

export type MapResult =
  | { ok: true; value: MappedEngagement }
  | { ok: false; reason: string };

function associatedIds(obj: HubspotObject, key: string): string[] {
  const assoc = (
    obj as {
      associations?: Record<string, { results?: { id: string }[] } | undefined>;
    }
  ).associations?.[key];
  return (assoc?.results ?? []).map((r) => r.id).filter(Boolean);
}

function timestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(/^\d+$/.test(raw) ? Number(raw) : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * One HubSpot engagement → one normalized event.
 *
 * Returns a reason rather than throwing on unusable input: a backfill of ten
 * thousand engagements must not stop because one has no timestamp.
 */
export function mapEngagement(
  objectType: EngagementObjectType,
  obj: HubspotObject,
  now: Date = new Date()
): MapResult {
  const p = (obj.properties ?? {}) as Record<string, string | null | undefined>;

  const dealIds = associatedIds(obj, "deals");
  const contactIds = associatedIds(obj, "contacts");

  // An engagement attached to nothing cannot inform any deal. Keeping it
  // would only inflate counts on a page nobody can act from.
  if (dealIds.length === 0 && contactIds.length === 0) {
    return { ok: false, reason: "no deal or contact association" };
  }

  const base =
    objectType === "meetings"
      ? timestamp(p.hs_meeting_start_time) ?? timestamp(p.hs_timestamp)
      : timestamp(p.hs_timestamp);
  if (!base) return { ok: false, reason: "no usable timestamp" };

  const shared = { externalId: obj.id, objectType, occurredAt: base, dealIds, contactIds };

  switch (objectType) {
    case "emails": {
      // EMAIL = we sent it, INCOMING_EMAIL = they sent it. An unknown or
      // missing direction is treated as ours: counting an email of unknown
      // provenance as a buyer reply would clear a "never replied" flag on
      // no evidence, which is the expensive direction to be wrong in.
      const inbound = (p.hs_email_direction ?? "").toUpperCase() === "INCOMING_EMAIL";
      return {
        ok: true,
        value: {
          ...shared,
          actorType: inbound ? "buyer" : "seller",
          interactionKind: inbound ? "email_replied" : "email_sent",
          eventType: inbound ? "email.replied" : "email.sent",
          signal: inbound
            ? { type: "email_replied", title: "Replied to your email" }
            : null,
          title: p.hs_email_subject ?? null,
        },
      };
    }

    case "meetings": {
      const outcome = (p.hs_meeting_outcome ?? "").toUpperCase();
      const past = base.getTime() <= now.getTime();

      // Attendance is only proven once the meeting has happened AND HubSpot
      // says it completed. A meeting still sitting at SCHEDULED in the past
      // proves nothing — plenty of reps never update the outcome.
      let signal: MappedEngagement["signal"] = null;
      if (past && outcome === "COMPLETED") {
        signal = { type: "meeting_attended", title: "Attended a meeting" };
      } else if (past && outcome === "NO_SHOW") {
        signal = { type: "meeting_no_show", title: "Did not attend a booked meeting" };
      }

      return {
        ok: true,
        value: {
          ...shared,
          // A completed meeting is the buyer giving up their time; a booked
          // one is only us having asked.
          actorType: signal?.type === "meeting_attended" ? "buyer" : "seller",
          interactionKind: "meeting",
          eventType: past ? "meeting.held" : "meeting.scheduled",
          signal,
          title: p.hs_meeting_title ?? null,
        },
      };
    }

    case "calls": {
      const inbound = (p.hs_call_direction ?? "").toUpperCase() === "INBOUND";
      return {
        ok: true,
        value: {
          ...shared,
          actorType: inbound ? "buyer" : "seller",
          interactionKind: "call",
          eventType: inbound ? "call.received" : "call.placed",
          // A buyer phoning in is strong intent and there is no signal type
          // for it. Inventing one, or borrowing a type that means something
          // else, would corrupt every weight that reads it — so the call is
          // recorded as a buyer event and contributes no signal.
          signal: null,
          title: p.hs_call_title ?? null,
        },
      };
    }

    case "notes":
      return {
        ok: true,
        value: {
          ...shared,
          actorType: "seller",
          interactionKind: "note",
          eventType: "note.logged",
          signal: null,
          title: null,
        },
      };
  }
}

/**
 * `proposalOpenedAt` is deliberately not derived here.
 *
 * The leak rule it feeds — "they opened the proposal and nobody followed up",
 * the highest-severity rule in the set — needs two facts: that a document was
 * a proposal, and that the buyer opened it. A HubSpot engagement proves
 * neither. An email with "proposal" in its subject is a guess, and an open
 * event requires sales-email tracking metadata that is not on the object.
 *
 * Guessing here would fire the most urgent recommendation in the product off
 * a subject-line match, which is exactly the kind of confident fabrication
 * the rest of this codebase refuses. The rule stays dark on HubSpot-only data
 * until there is a source that can prove it.
 */
export const PROPOSAL_OPENED_IS_NOT_DERIVABLE = true;
