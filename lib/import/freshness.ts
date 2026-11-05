/**
 * How old the data is, said plainly.
 *
 * A connected CRM reports its own staleness through `integrationHealth`. A
 * workspace that uploaded a spreadsheet has no connection row at all, so
 * nothing was telling anyone their pipeline was three weeks out of date —
 * and stale pipeline is exactly the input that makes a follow-up
 * recommendation wrong in a way the user cannot see.
 *
 * Pure, so the thresholds are testable without a clock.
 */

/** Imported data older than this is worth re-uploading before trusting. */
export const IMPORT_STALE_DAYS = 7;
/** Beyond this it is reported as badly out of date rather than merely old. */
export const IMPORT_VERY_STALE_DAYS = 30;

export type FreshnessLevel = "none" | "fresh" | "stale" | "very_stale";

export interface Freshness {
  level: FreshnessLevel;
  /** One sentence for the user. Never a bare timestamp. */
  label: string;
  days: number | null;
}

function wholeDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function describeImportFreshness(
  lastImportedAt: Date | null,
  now: Date = new Date()
): Freshness {
  if (!lastImportedAt) {
    return { level: "none", label: "No pipeline imported yet.", days: null };
  }

  const days = wholeDays(lastImportedAt, now);

  if (days >= IMPORT_VERY_STALE_DAYS) {
    return {
      level: "very_stale",
      label: `This pipeline was imported ${days} days ago. Recommendations are based on it, so re-import before relying on them.`,
      days,
    };
  }
  if (days >= IMPORT_STALE_DAYS) {
    return {
      level: "stale",
      label: `Imported ${days} days ago — re-import to pick up anything that has changed since.`,
      days,
    };
  }
  if (days <= 0) {
    return { level: "fresh", label: "Imported today.", days };
  }
  return {
    level: "fresh",
    label: `Imported ${days} day${days === 1 ? "" : "s"} ago.`,
    days,
  };
}
