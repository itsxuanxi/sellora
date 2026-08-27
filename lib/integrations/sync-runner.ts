import "server-only";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/security/crypto";
import { recordAudit } from "@/lib/security/audit";

/**
 * The job runner: retries, backoff, dead letters, and never failing silently.
 *
 * A sync that stops working without saying so is the worst outcome available
 * to this product. Sellora would keep scoring, keep recommending and keep
 * looking confident, on data that stopped moving days ago. Every path here
 * ends in a status somebody can see.
 *
 * Retries are bounded and end in DEAD_LETTER rather than in silence or an
 * infinite loop. A dead-lettered job keeps its cursor and its error so it can
 * be replayed by hand once the cause is fixed - it is the only record of what
 * was missed.
 */

export type JobKind = "backfill" | "incremental" | "webhook" | "reconcile";
export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "DEAD_LETTER"
  | "CANCELED";

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 15 * 60 * 1000;

/**
 * Exponential backoff with full jitter.
 *
 * Jittered because a provider outage fails every tenant's job at once, and an
 * unjittered schedule marches them all back in lockstep to collide again.
 */
export function nextRetryDelay(attempt: number): number {
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return Math.floor(ceiling / 2 + Math.random() * (ceiling / 2));
}

export interface EnqueueOptions {
  orgId: string;
  connectionId: string;
  kind: JobKind;
  objectType: string;
  since?: Date | null;
  maxAttempts?: number;
}

/**
 * Queues a job, unless an equivalent one is already pending.
 *
 * Without this check every webhook delivery would queue another full sync of
 * the same object type, and a busy portal would bury the queue in duplicates
 * of work already about to run.
 */
export async function enqueueSync(opts: EnqueueOptions) {
  const existing = await db.syncJob.findFirst({
    where: {
      orgId: opts.orgId,
      connectionId: opts.connectionId,
      objectType: opts.objectType,
      kind: opts.kind,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: { id: true },
  });
  if (existing) return existing;

  return db.syncJob.create({
    data: {
      orgId: opts.orgId,
      connectionId: opts.connectionId,
      kind: opts.kind,
      objectType: opts.objectType,
      since: opts.since ?? null,
      maxAttempts: opts.maxAttempts ?? 5,
      traceId: randomToken(8),
      nextRunAt: new Date(),
    },
  });
}

/** What a handler reports back after one pass. */
export interface JobProgress {
  processed: number;
  failed: number;
  /** Where to resume. Null means the object type is fully synced. */
  cursor: string | null;
}

export type JobHandler = (job: {
  id: string;
  orgId: string;
  connectionId: string;
  objectType: string;
  kind: string;
  cursor: string | null;
  since: Date | null;
  traceId: string | null;
}) => Promise<JobProgress>;

/**
 * Runs one job to completion or to its next retry.
 *
 * The cursor is written back on both success *and* failure. That is the point
 * of the whole design: a backfill that dies on page 400 of 500 resumes at 400,
 * rather than starting over and never finishing.
 */
export async function runJob(jobId: string, handler: JobHandler): Promise<JobStatus> {
  const job = await db.syncJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Sync job ${jobId} not found`);
  if (job.status === "RUNNING") return "RUNNING";
  if (["SUCCEEDED", "CANCELED", "DEAD_LETTER"].includes(job.status)) {
    return job.status as JobStatus;
  }

  await db.syncJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date(), attempt: { increment: 1 } },
  });

  try {
    const progress = await handler({
      id: job.id,
      orgId: job.orgId,
      connectionId: job.connectionId,
      objectType: job.objectType,
      kind: job.kind,
      cursor: job.cursor,
      since: job.since,
      traceId: job.traceId,
    });

    const done = progress.cursor === null;

    await db.syncJob.update({
      where: { id: jobId },
      data: {
        // More pages left: back to QUEUED so the next tick continues it.
        status: done ? "SUCCEEDED" : "QUEUED",
        cursor: progress.cursor,
        recordsProcessed: { increment: progress.processed },
        recordsFailed: { increment: progress.failed },
        finishedAt: done ? new Date() : null,
        nextRunAt: done ? null : new Date(),
        lastError: null,
      },
    });

    if (done) {
      await db.integrationConnection.update({
        where: { id: job.connectionId },
        data: {
          lastSyncSucceededAt: new Date(),
          consecutiveFailures: 0,
          // Partial failures inside a successful run are still a degraded
          // state - the sync finished, but not with everything.
          status: progress.failed > 0 ? "DEGRADED" : "CONNECTED",
          lastError:
            progress.failed > 0
              ? `${progress.failed} record(s) could not be processed in the last sync.`
              : null,
        },
      });
    }

    return done ? "SUCCEEDED" : "QUEUED";
  } catch (err) {
    return failJob(job.id, job.attempt + 1, job.maxAttempts, job.orgId, job.connectionId, err);
  }
}

async function failJob(
  jobId: string,
  attempt: number,
  maxAttempts: number,
  orgId: string,
  connectionId: string,
  err: unknown
): Promise<JobStatus> {
  const message = err instanceof Error ? err.message : String(err);
  const exhausted = attempt >= maxAttempts;

  await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: exhausted ? "DEAD_LETTER" : "QUEUED",
      lastError: message.slice(0, 1000),
      // Kept, not cleared: the payload and cursor are the only record of what
      // was lost, and replaying needs both.
      nextRunAt: exhausted ? null : new Date(Date.now() + nextRetryDelay(attempt)),
      finishedAt: exhausted ? new Date() : null,
    },
  });

  await db.integrationConnection.update({
    where: { id: connectionId },
    data: {
      consecutiveFailures: { increment: 1 },
      lastError: message.slice(0, 500),
      lastErrorAt: new Date(),
      status: exhausted ? "ERROR" : "DEGRADED",
    },
  });

  if (exhausted) {
    // A dead letter is an operational event, not just a log line.
    await recordAudit({
      orgId,
      action: "integration.sync_failed",
      actorType: "system",
      targetType: "integration",
      targetId: connectionId,
      metadata: { jobId, attempts: attempt, error: message.slice(0, 300) },
    });
  }

  return exhausted ? "DEAD_LETTER" : "QUEUED";
}

/** Jobs whose backoff has elapsed. Oldest first, so nothing starves. */
export async function claimDueJobs(limit = 10) {
  return db.syncJob.findMany({
    where: { status: "QUEUED", nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });
}

/**
 * Returns a dead-lettered job to the queue.
 *
 * Deliberately manual. A dead letter means retrying did not help, so
 * re-queueing it automatically would just burn the budget again; a human
 * fixes the cause and then replays.
 */
export async function replayDeadLetter(orgId: string, jobId: string) {
  const job = await db.syncJob.findFirst({
    where: { id: jobId, orgId, status: "DEAD_LETTER" },
  });
  if (!job) throw new Error("No dead-lettered job with that id in this workspace.");

  return db.syncJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      attempt: 0,
      nextRunAt: new Date(),
      lastError: null,
      finishedAt: null,
    },
  });
}

export interface IntegrationHealth {
  provider: string;
  status: string;
  statusLabel: string;
  lastSyncSucceededAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  recordsProcessed: number;
  activeJobs: number;
  deadLetters: number;
  /** True when the connection reports healthy but the data is stale. */
  stale: boolean;
}

/** How stale a "connected" integration may be before it is called delayed. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting authorization",
  CONNECTED: "Connected",
  DEGRADED: "Syncing with errors",
  REAUTH_REQUIRED: "Authentication required",
  REVOKED: "Disconnected",
  ERROR: "Failed",
};

/**
 * Connection health for the settings screen.
 *
 * Reports staleness separately from status because "Connected" next to a
 * three-day-old sync is a lie by omission, and it is the exact lie that lets a
 * customer trust a dashboard built on frozen data.
 */
export async function integrationHealth(orgId: string): Promise<IntegrationHealth[]> {
  const connections = await db.integrationConnection.findMany({
    where: { orgId },
    orderBy: { provider: "asc" },
  });

  return Promise.all(
    connections.map(async (c) => {
      const [aggregate, activeJobs, deadLetters] = await Promise.all([
        db.syncJob.aggregate({
          where: { connectionId: c.id },
          _sum: { recordsProcessed: true },
        }),
        db.syncJob.count({
          where: { connectionId: c.id, status: { in: ["QUEUED", "RUNNING"] } },
        }),
        db.syncJob.count({ where: { connectionId: c.id, status: "DEAD_LETTER" } }),
      ]);

      const stale =
        c.status === "CONNECTED" &&
        (!c.lastSyncSucceededAt ||
          Date.now() - c.lastSyncSucceededAt.getTime() > STALE_AFTER_MS);

      return {
        provider: c.provider,
        status: c.status,
        statusLabel: stale ? "Delayed" : (STATUS_LABEL[c.status] ?? c.status),
        lastSyncSucceededAt: c.lastSyncSucceededAt,
        lastError: c.lastError,
        consecutiveFailures: c.consecutiveFailures,
        recordsProcessed: aggregate._sum.recordsProcessed ?? 0,
        activeJobs,
        deadLetters,
        stale,
      };
    })
  );
}
