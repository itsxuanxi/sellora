import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/auth";
import {
  SIGNAL_TTL_DAYS,
  SIGNAL_WEIGHTS,
  type SignalType,
} from "@/lib/intent/config";
import { computeIntentScore, type Confidence } from "@/lib/intent/scoring";

/** Stable dedup key: same type + normalized title + same calendar day of the
 * real-world event collapses to one row, so re-importing the same CSV or
 * re-running detection never creates duplicates. */
export function dedupeKey(signalType: string, title: string, occurredAt: Date): string {
  const day = occurredAt.toISOString().slice(0, 10);
  const norm = title.trim().toLowerCase().replace(/\s+/g, " ");
  return crypto.createHash("sha1").update(`${signalType}|${norm}|${day}`).digest("hex").slice(0, 24);
}

export interface RawSignalInput {
  signalType: SignalType | string;
  title: string;
  description?: string | null;
  evidence?: string | null;
  sourceUrl?: string | null;
  sourceKey: string; // SignalSource.key
  occurredAt: Date;
  confidence?: Confidence;
  rawData?: unknown;
  /** Who and which deal this signal is about, when the caller knows. */
  contactId?: string | null;
  opportunityId?: string | null;
  /** Provider-stated certainty, 0-100. Falls back to the confidence band. */
  confidenceScore?: number | null;
  /** Machine-readable fields parsed from the payload at ingest, so scoring
   *  rules never re-parse `rawData`. */
  normalizedProperties?: Record<string, unknown> | null;
}

/** The band → number fallback, used when a provider gives no numeric score. */
const CONFIDENCE_SCORE: Record<string, number> = { low: 30, medium: 60, high: 90 };

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

/** Finds-or-creates the small SignalSource lookup rows on demand. */
export async function ensureSignalSource(key: string, name: string, kind: string) {
  return db.signalSource.upsert({
    where: { key },
    update: {},
    create: { key, name, kind },
  });
}

/**
 * Upserts one signal for one account. Dedupes on (accountId, dedupeKey) —
 * a repeat detection just no-ops (returns the existing row) rather than
 * creating noise or resetting `detectedAt`.
 */
export async function upsertSignal(
  orgId: string,
  accountId: string,
  input: RawSignalInput
) {
  const source = await ensureSignalSource(
    input.sourceKey,
    input.sourceKey.replace(/_/g, " "),
    input.sourceKey.startsWith("mock") ? "mock" : input.sourceKey === "csv_import" ? "csv" : "manual"
  );
  const key = dedupeKey(input.signalType, input.title, input.occurredAt);
  const ttlDays = SIGNAL_TTL_DAYS[input.signalType as SignalType] ?? 60;
  const expiresAt = new Date(input.occurredAt.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const existing = await db.buyingSignal.findUnique({
    where: { accountId_dedupeKey: { accountId, dedupeKey: key } },
  });
  if (existing) {
    // A repeat detection is not new evidence, but it can carry links the
    // first sighting lacked (the deal it belongs to was created since). Fill
    // those in without touching detectedAt, which would fake freshness.
    if (
      (input.opportunityId && !existing.opportunityId) ||
      (input.contactId && !existing.contactId)
    ) {
      return db.buyingSignal.update({
        where: { id: existing.id },
        data: {
          opportunityId: existing.opportunityId ?? input.opportunityId ?? null,
          contactId: existing.contactId ?? input.contactId ?? null,
        },
      });
    }
    return existing;
  }

  return db.buyingSignal.create({
    data: {
      orgId,
      accountId,
      signalType: input.signalType,
      title: input.title,
      description: input.description ?? null,
      evidence: input.evidence ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sourceId: source.id,
      occurredAt: input.occurredAt,
      confidence: input.confidence ?? "medium",
      confidenceScore:
        input.confidenceScore ?? CONFIDENCE_SCORE[input.confidence ?? "medium"] ?? 60,
      importanceScore: signalImportance(input.signalType),
      contactId: input.contactId ?? null,
      opportunityId: input.opportunityId ?? null,
      normalizedProperties: input.normalizedProperties
        ? JSON.stringify(input.normalizedProperties)
        : null,
      rawData: input.rawData ? JSON.stringify(input.rawData) : null,
      dedupeKey: key,
      expiresAt,
    },
  });
}

/** Marks signals whose TTL has passed as expired — excluded from scoring
 * from that point on, but never deleted (evidence stays visible in history). */
export async function expireStaleSignals(orgId: string) {
  const { count } = await db.buyingSignal.updateMany({
    where: { orgId, expired: false, expiresAt: { lt: new Date() } },
    data: { expired: true },
  });
  return count;
}

/**
 * Recomputes an account's Intent Score from its currently-active signals,
 * persists a new (never-overwritten) snapshot + component rows, and
 * updates the Account's denormalized cache fields for fast list sorting.
 */
export async function rescoreAccount(session: SessionContext, accountId: string) {
  await expireStaleSignals(session.orgId);

  const signals = await db.buyingSignal.findMany({
    where: { orgId: session.orgId, accountId, expired: false },
    orderBy: { occurredAt: "desc" },
  });

  const result = computeIntentScore(
    signals.map((s) => ({
      id: s.id,
      signalType: s.signalType,
      occurredAt: s.occurredAt,
      confidence: s.confidence as Confidence,
      expired: s.expired,
    }))
  );

  const snapshot = await db.intentScoreSnapshot.create({
    data: {
      orgId: session.orgId,
      accountId,
      score: result.score,
      confidence: result.confidence,
      whyNow: result.whyNow.join("\n"),
      version: result.version,
      components: {
        create: result.components.map((c) => ({
          signalId: c.signalId,
          ruleKey: c.ruleKey,
          label: c.label,
          points: c.points,
          reason: c.reason,
        })),
      },
    },
    include: { components: true },
  });

  await db.account.update({
    where: { id: accountId },
    data: {
      buyingIntentScore: result.score,
      buyingIntentConfidence: result.confidence,
      buyingIntentWhyNow: result.whyNow.join("\n"),
      buyingIntentScoredAt: new Date(),
    },
  });

  return snapshot;
}
