import "server-only";
import { db } from "@/lib/db";

/**
 * Identity resolution: deciding which account, contact or deal an observation
 * belongs to.
 *
 * This is where a revenue platform most easily does quiet damage. Attach an
 * email thread to the wrong opportunity and the score, the recommendation and
 * the attribution are all confidently wrong, with nothing on screen to suggest
 * it. So every match carries its method, its confidence and human-readable
 * evidence, and low-confidence matches are *suggested*, never applied.
 *
 * The confidence numbers are not a model. They are stated priors about how
 * much each kind of match can be trusted, and they are visible to the user
 * next to the match itself.
 */

export const RESOLUTION_VERSION = 1;

/** Below this a match is recorded as a suggestion and waits for a human. */
export const AUTO_APPLY_MIN_CONFIDENCE = 80;

export type MatchMethod =
  | "exact_crm_id"
  | "exact_email"
  | "domain_match"
  | "thread_participant"
  | "attendee_match"
  | "manual_override";

/**
 * How far each method can be trusted.
 *
 * A CRM id is definitional. An email address is nearly as good, but people
 * change jobs and keep replying from a personal address. A domain match is the
 * weak one and is scored below the auto-apply line on purpose: it is right for
 * a company with one deal open and wrong the moment there are two, which is
 * exactly the situation where being wrong costs the most.
 */
export const METHOD_CONFIDENCE: Record<MatchMethod, number> = {
  manual_override: 100,
  exact_crm_id: 100,
  exact_email: 95,
  attendee_match: 85,
  thread_participant: 75,
  domain_match: 60,
};

/** Free and shared mailbox domains never identify a company. */
const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "qq.com",
  "163.com",
  "126.com",
  "foxmail.com",
]);

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  // Deliberately loose: this validates shape, not deliverability.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function emailDomain(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email) return null;
  const domain = email.split("@")[1];
  return domain || null;
}

/**
 * Whether a domain can identify a company at all.
 *
 * Matching on gmail.com would collapse every consumer address in a workspace
 * onto whichever account happened to be created first - the single most
 * destructive mistake available to this module.
 */
export function isCorporateDomain(domain: string | null): boolean {
  if (!domain) return false;
  if (GENERIC_DOMAINS.has(domain)) return false;
  // A bare TLD or a hostname with no dot is not a company domain.
  return domain.includes(".") && domain.length > 3;
}

export interface ResolvedMatch {
  targetType: "account" | "contact" | "opportunity";
  targetId: string;
  method: MatchMethod;
  confidence: number;
  evidence: string;
  /** False when the confidence is too low to act on without a human. */
  autoApplied: boolean;
}

/**
 * Finds the contact behind an email address.
 *
 * Exact address first, because it is nearly definitional. Falls back to the
 * company by domain, which resolves an *account* and not a contact - a new
 * person at a known customer is a genuinely new contact, and inventing a match
 * to an existing colleague would attribute their behaviour to the wrong human.
 */
export async function resolveByEmail(
  orgId: string,
  rawEmail: string
): Promise<ResolvedMatch | null> {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;

  const manual = await findManualOverride(orgId, "email", email);
  if (manual) return manual;

  const contact = await db.prospect.findFirst({
    where: { orgId, email },
    select: { id: true, name: true, accountId: true },
  });
  if (contact) {
    return {
      targetType: "contact",
      targetId: contact.id,
      method: "exact_email",
      confidence: METHOD_CONFIDENCE.exact_email,
      evidence: `Email ${email} matches contact ${contact.name} exactly.`,
      autoApplied: true,
    };
  }

  const domain = emailDomain(email);
  if (!isCorporateDomain(domain)) return null;

  const account = await db.account.findFirst({
    where: { orgId, domain },
    select: { id: true, name: true },
  });
  if (!account) return null;

  return {
    targetType: "account",
    targetId: account.id,
    method: "domain_match",
    confidence: METHOD_CONFIDENCE.domain_match,
    evidence: `Domain ${domain} matches account ${account.name}. No contact with this exact address exists yet.`,
    // Below the auto-apply line: a domain match is a suggestion.
    autoApplied: METHOD_CONFIDENCE.domain_match >= AUTO_APPLY_MIN_CONFIDENCE,
  };
}

/**
 * Picks the opportunity an account-level observation belongs to.
 *
 * Refuses to guess when an account has several open deals. That ambiguity is
 * real - a customer evaluating two products has two deals and one email
 * thread - and attributing a signal to the wrong one silently distorts both.
 * Returning null leaves the event attached at account level, which is true.
 */
export async function resolveOpportunityForAccount(
  orgId: string,
  accountId: string
): Promise<ResolvedMatch | null> {
  const open = await db.opportunity.findMany({
    where: { orgId, accountId, stage: { notIn: ["WON", "LOST"] } },
    select: { id: true, name: true },
    take: 5,
  });

  if (open.length === 0) return null;

  if (open.length > 1) {
    return {
      targetType: "opportunity",
      targetId: open[0].id,
      method: "domain_match",
      confidence: 40,
      evidence: `${open.length} open opportunities on this account. Sellora will not attribute this automatically.`,
      autoApplied: false,
    };
  }

  return {
    targetType: "opportunity",
    targetId: open[0].id,
    method: "exact_crm_id",
    confidence: 90,
    evidence: `${open[0].name} is the only open opportunity on this account.`,
    autoApplied: true,
  };
}

/**
 * Resolves a meeting's external attendees.
 *
 * Internal attendees are dropped by domain: a calendar invite is mostly the
 * seller's own colleagues, and counting them as buyer engagement would make
 * every internal sync look like customer interest.
 */
export async function resolveAttendees(
  orgId: string,
  attendeeEmails: string[],
  sellerDomains: string[]
): Promise<ResolvedMatch[]> {
  const sellers = new Set(sellerDomains.map((d) => d.toLowerCase()));
  const external = attendeeEmails.filter((e) => {
    const domain = emailDomain(e);
    return domain !== null && !sellers.has(domain);
  });

  const matches: ResolvedMatch[] = [];
  for (const email of external) {
    const match = await resolveByEmail(orgId, email);
    if (match) matches.push(match);
  }
  return matches;
}

async function findManualOverride(
  orgId: string,
  sourceKind: string,
  sourceValue: string
): Promise<ResolvedMatch | null> {
  const link = await db.identityLink.findFirst({
    where: { orgId, sourceKind, sourceValue, manualOverride: true },
  });
  if (!link) return null;
  return {
    targetType: link.targetType as ResolvedMatch["targetType"],
    targetId: link.targetId,
    method: "manual_override",
    confidence: 100,
    evidence: link.evidence,
    autoApplied: true,
  };
}

/**
 * Persists a match so the decision is auditable and reusable.
 *
 * A manual override is never overwritten by a later automatic pass. A person
 * who has corrected a match has told Sellora something it could not derive,
 * and quietly reverting that on the next sync is the fastest way to lose their
 * trust in every other match on the screen.
 */
export async function recordMatch(
  orgId: string,
  sourceKind: string,
  sourceValue: string,
  match: ResolvedMatch
): Promise<void> {
  const existing = await db.identityLink.findUnique({
    where: {
      orgId_sourceKind_sourceValue_targetType: {
        orgId,
        sourceKind,
        sourceValue,
        targetType: match.targetType,
      },
    },
    select: { id: true, manualOverride: true },
  });

  if (existing?.manualOverride) return;

  const data = {
    targetId: match.targetId,
    method: match.method,
    confidence: match.confidence,
    evidence: match.evidence,
    resolutionVersion: RESOLUTION_VERSION,
  };

  if (existing) {
    await db.identityLink.update({ where: { id: existing.id }, data });
    return;
  }

  await db.identityLink.create({
    data: { orgId, sourceKind, sourceValue, targetType: match.targetType, ...data },
  });
}

/** A person's correction. Wins over everything, permanently. */
export async function overrideMatch(opts: {
  orgId: string;
  sourceKind: string;
  sourceValue: string;
  targetType: "account" | "contact" | "opportunity";
  targetId: string;
  userId: string;
  reason: string;
}): Promise<void> {
  const data = {
    targetId: opts.targetId,
    method: "manual_override",
    confidence: 100,
    evidence: opts.reason,
    manualOverride: true,
    overriddenBy: opts.userId,
    resolutionVersion: RESOLUTION_VERSION,
  };

  await db.identityLink.upsert({
    where: {
      orgId_sourceKind_sourceValue_targetType: {
        orgId: opts.orgId,
        sourceKind: opts.sourceKind,
        sourceValue: opts.sourceValue,
        targetType: opts.targetType,
      },
    },
    update: data,
    create: {
      orgId: opts.orgId,
      sourceKind: opts.sourceKind,
      sourceValue: opts.sourceValue,
      targetType: opts.targetType,
      ...data,
    },
  });
}

/** Matches awaiting a human, for the review queue. */
export async function pendingMatches(orgId: string, limit = 50) {
  return db.identityLink.findMany({
    where: { orgId, manualOverride: false, confidence: { lt: AUTO_APPLY_MIN_CONFIDENCE } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
