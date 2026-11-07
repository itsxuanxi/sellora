import "server-only";
import { db } from "@/lib/db";
import { ingestMessages, relinkOrphanMessages } from "@/lib/messages/ingest";
import { GMAIL_PROVIDER, getAccessToken } from "@/lib/integrations/gmail/oauth";
import {
  buildQuery,
  parseGmailMessage,
  type GmailMessage,
} from "@/lib/integrations/gmail/parse";

/**
 * Pulling correspondence out of a connected mailbox.
 *
 * Scoped to people this workspace already has as contacts. That is the
 * privacy-respecting choice and it is also the only defensible one: an
 * agency's inbox contains their accountant, their landlord and their
 * candidates, and none of that is Selryn's business. The query is built from
 * known addresses, so a message from someone who is not on a deal is never
 * fetched in the first place — not fetched and discarded, not fetched.
 *
 * Windows overlap on purpose. The only safe way to catch a message that
 * arrived while the last run was in flight is to ask for a window that
 * reaches back behind it, and ingest is keyed on the provider's own id so an
 * overlap updates rather than duplicates.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** How far back a routine sync looks. Overlaps the hourly cron generously. */
const DEFAULT_WINDOW_DAYS = 3;
/** A first sync, where there is no history at all to overlap with. */
const FIRST_SYNC_WINDOW_DAYS = 60;
/** Gmail counts quota per call, and a deal does not need a year of thread. */
const MAX_MESSAGES = 200;

export interface GmailSyncReport {
  fetched: number;
  created: number;
  updated: number;
  unlinked: number;
  relinked: number;
  skipped: number;
  errors: string[];
}

async function gmailFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail ${res.status} on ${path.split("?")[0]}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function syncGmail(orgId: string): Promise<GmailSyncReport> {
  const report: GmailSyncReport = {
    fetched: 0,
    created: 0,
    updated: 0,
    unlinked: 0,
    relinked: 0,
    skipped: 0,
    errors: [],
  };

  const conn = await db.integrationConnection.findUnique({
    where: { orgId_provider: { orgId, provider: GMAIL_PROVIDER } },
    select: { id: true, lastSyncSucceededAt: true, externalAccountId: true },
  });
  if (!conn) {
    report.errors.push("Gmail is not connected for this workspace.");
    return report;
  }

  await db.integrationConnection.update({
    where: { id: conn.id },
    data: { lastSyncStartedAt: new Date() },
  });

  try {
    const token = await getAccessToken(orgId);

    const contacts = await db.prospect.findMany({
      where: { orgId, email: { not: "" } },
      select: { email: true },
      take: 400,
    });
    const query = buildQuery({
      contactEmails: contacts.map((c) => c.email),
      sinceDays: conn.lastSyncSucceededAt ? DEFAULT_WINDOW_DAYS : FIRST_SYNC_WINDOW_DAYS,
    });

    if (!query) {
      // No contacts means nothing to search for. Not an error: it is the
      // normal state of a workspace whose pipeline has not been imported yet,
      // and saying so beats a sync that silently does nothing.
      report.errors.push("No contacts in this workspace yet, so there was nothing to search for.");
      await db.integrationConnection.update({
        where: { id: conn.id },
        data: { lastSyncSucceededAt: new Date(), consecutiveFailures: 0 },
      });
      return report;
    }

    const listed = await gmailFetch<{ messages?: { id: string }[] }>(
      token,
      `/messages?maxResults=${MAX_MESSAGES}&q=${encodeURIComponent(query)}`
    );
    const ids = (listed.messages ?? []).map((m) => m.id);
    report.fetched = ids.length;

    // One call per message, sequentially. Gmail's per-user rate limit is the
    // binding constraint here, not wall time, and a parallel burst that trips
    // it costs the whole run rather than one message.
    const parsed = [];
    for (const id of ids) {
      try {
        const message = await gmailFetch<GmailMessage>(
          token,
          `/messages/${id}?format=full`
        );
        const row = parseGmailMessage(message);
        if (!row) {
          report.skipped++;
          continue;
        }
        parsed.push({ source: GMAIL_PROVIDER, ...row });
      } catch (err) {
        report.skipped++;
        report.errors.push(err instanceof Error ? err.message : `Could not read message ${id}`);
      }
    }

    const ingest = await ingestMessages(orgId, parsed);
    report.created = ingest.created;
    report.updated = ingest.updated;
    report.unlinked = ingest.unlinked;
    for (const f of ingest.failures) report.errors.push(`${f.externalId}: ${f.message}`);

    report.relinked = await relinkOrphanMessages(orgId);

    await db.integrationConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncSucceededAt: new Date(),
        consecutiveFailures: 0,
        lastError: null,
        lastErrorAt: null,
        status: report.errors.length > 0 ? "DEGRADED" : "CONNECTED",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync failed.";
    report.errors.push(message);
    await db.integrationConnection.update({
      where: { id: conn.id },
      data: {
        lastError: message.slice(0, 500),
        lastErrorAt: new Date(),
        consecutiveFailures: { increment: 1 },
        status: "ERROR",
      },
    });
  }

  return report;
}

/**
 * Sends a follow-up from the agency's own mailbox, into the existing thread.
 *
 * This is the half of the connector that is not about reading. A follow-up
 * delivered by Selryn's own provider arrives from a domain the client has
 * never corresponded with, starts a new conversation beside the one about
 * their proposal, and is markedly more likely to be filtered. Sent through
 * Gmail with the thread id, it lands where the client is already looking, in
 * the agency's sent folder, with replies going to the right place.
 *
 * Returns the provider id of the sent message so the caller can record it.
 */
export async function sendViaGmail(opts: {
  orgId: string;
  to: string;
  subject: string;
  body: string;
  /** The thread to reply into. Omitted starts a new conversation. */
  threadId?: string | null;
  /** The Message-ID of what is being replied to, for correct threading. */
  inReplyTo?: string | null;
}): Promise<{ id: string; threadId: string }> {
  const token = await getAccessToken(opts.orgId);

  // RFC 2047 for the subject, because a plain UTF-8 subject line is mangled
  // by some clients and an agency's mail is not always in English.
  const subject = /^[\x20-\x7E]*$/.test(opts.subject)
    ? opts.subject
    : `=?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`;

  const headers = [
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`);
  }

  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${opts.body}`, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(`${API}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw, ...(opts.threadId ? { threadId: opts.threadId } : {}) }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail refused the send (${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as { id: string; threadId: string };
}
