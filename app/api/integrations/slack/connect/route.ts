import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/security/rbac";
import { rethrowControlFlow } from "@/lib/security/route-errors";
import { recordAudit } from "@/lib/security/audit";
import { isEncryptionConfigured } from "@/lib/security/crypto";
import {
  buildAuthorizeUrl,
  isSlackConfigured,
  newState,
  SLACK_STATE_COOKIE,
} from "@/lib/integrations/slack/oauth";

/**
 * Starts the Slack install.
 *
 * Refuses before redirecting if anything needed to finish safely is missing —
 * sending someone to Slack's consent screen and only then discovering there
 * is nowhere safe to put the token would mean holding a live credential we
 * cannot encrypt.
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    // A sandbox must never hold a real customer credential.
    if (session.org.isSample) {
      return NextResponse.json(
        {
          error:
            "This is a sandbox workspace. Connecting Slack is disabled here — create a real workspace to install it.",
        },
        { status: 403 }
      );
    }

    if (!isSlackConfigured()) {
      return NextResponse.json(
        {
          error:
            "Slack is not configured on this deployment. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.",
        },
        { status: 503 }
      );
    }
    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        {
          error:
            "ENCRYPTION_KEY is not set, so the Slack token could not be stored safely. Refusing to start.",
        },
        { status: 503 }
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const state = newState();

    await recordAudit({
      orgId: session.orgId,
      actorId: session.id,
      actorType: "user",
      action: "integration.connect_started",
      targetType: "integration",
      targetId: "slack",
    });

    const res = NextResponse.redirect(buildAuthorizeUrl({ origin, state }));
    // httpOnly and short-lived; lax rather than strict because the callback
    // is a cross-site redirect back from Slack and strict would drop the
    // cookie exactly when it is needed.
    res.cookies.set(SLACK_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    rethrowControlFlow(err);
    return NextResponse.json({ error: "Could not start the Slack install." }, { status: 500 });
  }
}
