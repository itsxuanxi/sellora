/**
 * The sandbox boundary.
 *
 * Selryn has one product, not a product and a demo. What separates the public
 * demo from a paying workspace is a flag on the organization and a rule about
 * side effects: inside a sandbox, everything that would leave the building —
 * an email, a CRM write, a calendar invite — is recorded as if it happened and
 * never actually sent.
 *
 * Two independent reasons to simulate, and either is enough:
 *
 *  1. The workspace itself is a sandbox (`Organization.isSample`), which is
 *     what the anonymous demo provisions.
 *  2. The *record* being acted on is sample data (`isSample` on the account,
 *     contact or opportunity). A real customer who loaded sample data at
 *     onboarding still has a real workspace, and a follow-up addressed to
 *     "maya@nordform.ai" must never reach a real inbox.
 *
 * Deliberately free of `server-only` and of any Prisma import: the seeding
 * script, server actions and client components all need to agree on these
 * rules, and a rule that only half the codebase can read is not a rule.
 */

export interface SandboxSubject {
  /** The organization the action runs in. */
  orgIsSample?: boolean | null;
  /** The record the action targets, when there is one. */
  recordIsSample?: boolean | null;
}

/** The one predicate. Everything outbound asks this before it acts. */
export function isSimulated(subject: SandboxSubject): boolean {
  return Boolean(subject.orgIsSample) || Boolean(subject.recordIsSample);
}

/** Copy shown wherever a simulated effect is offered or reported. */
export const SIMULATION_NOTICE =
  "Sample data — this will not really be sent or written anywhere.";

export const SANDBOX_WORKSPACE_NOTICE =
  "This is a sandbox workspace. Every action works, but nothing leaves your browser session — no email is sent and no CRM is written.";

/** Prefix on every simulated external id, so a simulated effect is greppable. */
export const SIMULATED_ID_PREFIX = "sandbox_";

export function simulatedId(): string {
  return `${SIMULATED_ID_PREFIX}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function isSimulatedId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(SIMULATED_ID_PREFIX));
}

/**
 * Capability status for anything the UI can offer.
 *
 * "planned" exists so an unfinished feature can be shown honestly instead of
 * being wired to a button that quietly does nothing — §7 of the sandbox brief.
 */
export type CapabilityStatus = "live" | "simulated" | "planned";
