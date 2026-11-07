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
            "Slack is not set up on this deployment yet. An administrator needs to configure its credentials on the server before this connection can be made.",
        },
        { status: 503 }
      );
    }
    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        {
          error:
            "This deployment has no encryption key configured, so the Slack token could not be stored safely. Refusing to start the connection.",
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
