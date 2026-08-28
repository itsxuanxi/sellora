/**
 * The one row shape the priority table renders.
 *
 * Both the live workspace and the guided demo build rows of this shape, which
 * is the whole reason the two screens can never drift apart: they are the same
 * component fed from two sources, not two implementations of one idea.
 *
 * Deliberately free of Prisma types, Dates and server imports so the demo —
 * which has no database and runs entirely in the browser — can produce rows
 * without pulling any of that in.
 */

export interface PriorityRow {
  id: string;
  company: string;
  /** Pipeline stage, already in its display form. */
  stage: string;
  /** Why this deal is here, in one line. */
  note: string;
  dealValue: number;
  winProbability: number;
  expected: number;
  /** Preformatted — "4 days ago", "yesterday", "No contact yet". */
  lastActivity: string;
  needsAttention: boolean;
  currency: string;
  /** Where the row navigates. Omit for a row that cannot be opened. */
  href?: string;
  /** data-demo-target passthrough, for the guided tour's spotlight. */
  demoTarget?: string;
}
