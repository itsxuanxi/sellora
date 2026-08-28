import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/security/crypto";
import { runNotificationTick } from "@/lib/notifications/scheduler";

/**
 * The notification worker.
 *
 * Hourly rather than daily, because "8am" means eight o'clock where the
 * recipient is. See lib/notifications/scheduler.ts for why running 24× a day
 * is safe.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fails closed: an unauthenticated endpoint that can send mail on a
  // customer's behalf is worse than no scheduled notifications at all.
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return safeEqual(token, secret);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await runNotificationTick();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("[cron:notifications]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Tick failed" },
      { status: 500 }
    );
  }
}
