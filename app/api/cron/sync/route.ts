import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/security/crypto";
import { claimDueJobs, runJob } from "@/lib/integrations/sync-runner";
import { runHubspotJob } from "@/lib/integrations/hubspot/sync";
import { sweepNonResponses } from "@/lib/revenue/loop";
import { db } from "@/lib/db";

/**
 * The worker. Everything queued elsewhere is executed here.
 *
 * Until this existed, connecting HubSpot enqueued four jobs that nothing ever
 * picked up: the runner, the retry policy and the dead-letter handling were
 * all in place with no process to drive them.
 *
 * Runs on Vercel Cron (see vercel.json). Serverless, so the design constraints
 * are the ones that follow from that:
 *
 *   - Bounded work per invocation. One page per job, a handful of jobs per
 *     tick, well inside the function timeout. Progress is durable in the job's
 *     cursor, so being cut off costs one page, not one backfill.
 *   - Idempotent. Cron can double-fire and a retry can overlap; every write
 *     underneath is an upsert on a stable key.
 *   - No unbounded fan-out. A workspace with a huge portal cannot starve the
 *     others, because each tick takes a fixed slice.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Jobs per tick. Small enough to finish, large enough to make progress. */
const JOBS_PER_TICK = 5;

/**
 * Authorizes the caller.
 *
 * Vercel Cron sends CRON_SECRET as a bearer token. Without the check this is a
 * public endpoint that anyone could hammer to burn a customer's HubSpot rate
 * limit. Missing configuration fails closed - an unauthenticated worker is
 * worse than no worker.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return safeEqual(token, secret);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json(
      {
        error: process.env.CRON_SECRET
          ? "Unauthorized."
          : "CRON_SECRET is not configured; the worker is disabled.",
      },
      { status: process.env.CRON_SECRET ? 401 : 503 }
    );
  }

  const started = Date.now();
  const due = await claimDueJobs(JOBS_PER_TICK);

  const results: { jobId: string; objectType: string; status: string }[] = [];

  for (const job of due) {
    // The connection tells us which provider this job belongs to. A job whose
    // connection was revoked mid-flight is cancelled rather than run: nobody
    // wants a sync continuing against access a customer just withdrew.
    const connection = await db.integrationConnection.findUnique({
      where: { id: job.connectionId },
      select: { provider: true, status: true },
    });

    if (!connection || connection.status === "REVOKED") {
      await db.syncJob.update({
        where: { id: job.id },
        data: { status: "CANCELED", finishedAt: new Date(), lastError: "Connection revoked." },
      });
      results.push({ jobId: job.id, objectType: job.objectType, status: "CANCELED" });
      continue;
    }

    if (connection.provider !== "hubspot") {
      // Only HubSpot has handlers today. Left queued rather than failed, so it
      // runs unchanged once its provider ships.
      continue;
    }

    const status = await runJob(job.id, (j) =>
      runHubspotJob({
        orgId: j.orgId,
        connectionId: j.connectionId,
        objectType: j.objectType,
        cursor: j.cursor,
      })
    );
    results.push({ jobId: job.id, objectType: job.objectType, status });
  }

  // Housekeeping that also needs a heartbeat: an action whose reply window
  // closed with nothing recorded becomes an explicit no_response, because
  // silence is a result and a blank row would inflate every response rate.
  let nonResponses = 0;
  try {
    const orgs = await db.organization.findMany({ select: { id: true }, take: 50 });
    for (const org of orgs) nonResponses += await sweepNonResponses(org.id);
  } catch (err) {
    console.error("[cron] non-response sweep failed:", err);
  }

  return NextResponse.json({
    ok: true,
    jobsRun: results.length,
    results,
    nonResponses,
    durationMs: Date.now() - started,
  });
}
