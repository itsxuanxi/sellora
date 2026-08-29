import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/security/rbac";
import { rethrowControlFlow } from "@/lib/security/route-errors";
import { recordAudit } from "@/lib/security/audit";
import { safeEqual } from "@/lib/security/crypto";
import {
  exchangeCode,
  SLACK_STATE_COOKIE,
  storeGrant,
} from "@/lib/integrations/slack/oauth";

/**
 * Finishes the Slack install.
 *
 * The state cookie is compared in constant time and cleared whatever happens:
 * a state that survived one attempt would let a replayed callback attach an
 * attacker's Slack workspace to somebody else's Selryn org.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const settings = new URL("/intent", process.env.NEXT_PUBLIC_APP_URL ?? url.origin);

  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    const returned = url.searchParams.get("state");
    const expected = req.cookies.get(SLACK_STATE_COOKIE)?.value;
    const code = url.searchParams.get("code");
    const denied = url.searchParams.get("error");

    const fail = (reason: string) => {
      settings.searchParams.set("slack", reason);
      const res = NextResponse.redirect(settings);
      res.cookies.delete(SLACK_STATE_COOKIE);
      return res;
    };

    if (denied) return fail("denied");
    if (!code) return fail("no_code");
    if (!returned || !expected || !safeEqual(returned, expected)) return fail("bad_state");

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
    const tokens = await exchangeCode({ code, origin });
    await storeGrant({ orgId: session.orgId, userId: session.id, tokens });

    await recordAudit({
      orgId: session.orgId,
      actorId: session.id,
      actorType: "user",
      action: "integration.connected",
      targetType: "integration",
      targetId: "slack",
      metadata: { team: tokens.team?.name ?? null },
    });

    settings.searchParams.set("slack", "connected");
    const res = NextResponse.redirect(settings);
    res.cookies.delete(SLACK_STATE_COOKIE);
    return res;
  } catch (err) {
    rethrowControlFlow(err);
    console.error("[slack:callback]", err);
    settings.searchParams.set("slack", "failed");
    const res = NextResponse.redirect(settings);
    res.cookies.delete(SLACK_STATE_COOKIE);
    return res;
  }
}
