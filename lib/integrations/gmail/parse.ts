/**
 * Turning a Gmail API message into the shape Selryn stores.
 *
 * Pure, and deliberately free of any import that touches the network or the
 * database, because this is where the fiddly parts live: MIME trees,
 * base64url, address headers written six different ways, and quoted reply
 * chains. All of that is testable with a fixture and none of it needs a
 * mailbox, which is what lets this ship and be trusted before anybody has
 * connected one.
 */

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

export interface ParsedMessage {
  externalId: string;
  threadId: string;
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string | null;
  snippet: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  occurredAt: Date;
}

export function headerValue(payload: GmailPart | undefined, name: string): string | null {
  const wanted = name.toLowerCase();
  const found = payload?.headers?.find((h) => h.name.toLowerCase() === wanted);
  return found?.value ?? null;
}

/**
 * `"Maya Chen" <maya@cloudmint.io>` → name and address.
 *
 * Tolerant on purpose. A header that cannot be parsed yields a null address
 * rather than a guess, and the caller drops the message — an inbox contains
 * mailing lists, bounce daemons and clients that quote their own display
 * names, and inventing an address from one of those attaches a stranger's
 * mail to somebody's deal.
 */
export function parseAddress(raw: string | null): { email: string | null; name: string | null } {
  if (!raw) return { email: null, name: null };
  const angled = raw.match(/<([^>]+)>/);
  const email = (angled ? angled[1] : raw).trim().toLowerCase();
  if (!email.includes("@") || /\s/.test(email)) return { email: null, name: null };

  let name: string | null = null;
  if (angled) {
    name = raw.slice(0, raw.indexOf("<")).trim().replace(/^"|"$/g, "") || null;
  }
  return { email, name };
}

/** Every address in a To/Cc header, in order, skipping the unparseable. */
export function parseAddressList(raw: string | null): string[] {
  if (!raw) return [];
  // Split on commas outside quotes, which is enough for real headers and
  // avoids pulling in a MIME library for one line.
  return raw
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => parseAddress(part).email)
    .filter((e): e is string => Boolean(e));
}

/** Gmail encodes bodies base64url, which `Buffer` does not accept directly. */
export function decodeBody(data: string | undefined): string | null {
  if (!data) return null;
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * The plain-text body, from anywhere in the MIME tree.
 *
 * Prefers `text/plain`; falls back to stripping tags from `text/html` when a
 * sender's client offered nothing else, which is common enough that treating
 * it as "no body" would lose a real share of replies. Attachments are
 * skipped by filename — their `body.data` is a file, not prose.
 */
export function extractPlainText(payload: GmailPart | undefined): string | null {
  if (!payload) return null;

  const walk = (part: GmailPart, want: string): string | null => {
    if (part.filename) return null;
    if (part.mimeType === want) {
      const text = decodeBody(part.body?.data);
      if (text) return text;
    }
    for (const child of part.parts ?? []) {
      const found = walk(child, want);
      if (found) return found;
    }
    return null;
  };

  const plain = walk(payload, "text/plain");
  if (plain) return plain;

  const html = walk(payload, "text/html");
  return html ? stripHtml(html) : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Drops the quoted chain under a reply.
 *
 * Kept because the quoted history is the same text already stored against the
 * earlier message, and leaving it in means every reply in a long thread
 * carries the whole thread again — which inflates storage, and later feeds a
 * model the same paragraph six times and invites it to extract a "new" fact
 * from a six-week-old sentence.
 */
export function stripQuotedReply(body: string): string {
  const lines = body.split("\n");
  const cut = lines.findIndex(
    (line) =>
      /^>/.test(line.trim()) ||
      /^On .+ wrote:$/.test(line.trim()) ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim()) ||
      /^_{10,}$/.test(line.trim()) ||
      /^From:\s/.test(line.trim())
  );
  const kept = cut === -1 ? lines : lines.slice(0, cut);
  return kept.join("\n").trim();
}

/**
 * One Gmail message, as Selryn stores it — or null when it should be skipped.
 *
 * Direction comes from Gmail's own SENT label rather than from comparing the
 * sender to the connected address: an agency owner who sends from an alias,
 * or whose mail is delivered by a sequencer, would otherwise have their own
 * outbound filed as the client replying, which would mark every chased deal
 * as answered.
 */
export function parseGmailMessage(message: GmailMessage): ParsedMessage | null {
  const from = parseAddress(headerValue(message.payload, "From"));
  if (!from.email) return null;

  const isSent = (message.labelIds ?? []).includes("SENT");
  const isDraft = (message.labelIds ?? []).includes("DRAFT");
  if (isDraft) return null; // never sent, so it is not correspondence

  const occurredAt = message.internalDate
    ? new Date(Number(message.internalDate))
    : parseDateHeader(headerValue(message.payload, "Date"));
  if (!occurredAt || Number.isNaN(occurredAt.getTime())) return null;

  const rawBody = extractPlainText(message.payload);
  const body = rawBody ? stripQuotedReply(rawBody) : null;

  return {
    externalId: message.id,
    threadId: message.threadId,
    direction: isSent ? "outbound" : "inbound",
    subject: headerValue(message.payload, "Subject"),
    body: body || null,
    snippet: message.snippet ?? null,
    fromEmail: from.email,
    fromName: from.name,
    toEmails: parseAddressList(headerValue(message.payload, "To")),
    occurredAt,
  };
}

function parseDateHeader(raw: string | null): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * A Gmail search that returns correspondence and not noise.
 *
 * Addresses are quoted and OR-ed rather than fetching the whole mailbox:
 * Selryn has no business reading mail from people who are not on a deal, and
 * a query scoped to known contacts is both the privacy-respecting choice and
 * the one that keeps the sync inside Gmail's quota.
 */
export function buildQuery(opts: { contactEmails: string[]; sinceDays: number }): string | null {
  const addresses = [...new Set(opts.contactEmails.map((e) => e.trim().toLowerCase()))].filter(
    (e) => e.includes("@")
  );
  if (addresses.length === 0) return null;

  const people = addresses.map((e) => `from:${e} OR to:${e}`).join(" OR ");
  return `(${people}) newer_than:${Math.max(1, Math.ceil(opts.sinceDays))}d`;
}
