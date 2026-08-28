import crypto from "node:crypto";
import { SIGNAL_WEIGHTS, type SignalType } from "@/lib/intent/config";

/**
 * Signal facts that both the running product and the sample-data seeder need.
 *
 * Split out of `lib/intent/signals.ts` because that module is `server-only`
 * and the seeder also runs as a plain script under `tsx`. These three rules
 * were previously copy-pasted into `prisma/seed.ts`, which meant seeded
 * signals could silently disagree with ingested ones about their own dedupe
 * key. One definition, two callers.
 */

/** Stable dedup key: same type + normalized title + same calendar day of the
 * real-world event collapses to one row, so re-importing the same CSV or
 * re-running detection never creates duplicates. */
export function dedupeKey(signalType: string, title: string, occurredAt: Date): string {
  const day = occurredAt.toISOString().slice(0, 10);
  const norm = title.trim().toLowerCase().replace(/\s+/g, " ");
  return crypto.createHash("sha1").update(`${signalType}|${norm}|${day}`).digest("hex").slice(0, 24);
}

/** The band → number fallback, used when a provider gives no numeric score. */
export const CONFIDENCE_SCORE: Record<string, number> = { low: 30, medium: 60, high: 90 };

/**
 * 0-100 importance for a signal type, derived from the scoring weight rather
 * than maintained as a second list that could disagree with it. Negative
 * weights (a no-show, prolonged silence) are strong evidence too — importance
 * is magnitude, so it uses the absolute value while the sign stays in
 * SIGNAL_WEIGHTS where the arithmetic happens.
 */
export function signalImportance(signalType: string): number {
  const weight = SIGNAL_WEIGHTS[signalType as SignalType];
  if (weight === undefined) return 50;
  const maxWeight = Math.max(...Object.values(SIGNAL_WEIGHTS).map(Math.abs));
  return Math.round((Math.abs(weight) / maxWeight) * 100);
}
