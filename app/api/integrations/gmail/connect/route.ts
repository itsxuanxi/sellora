import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/security/rbac";
import { rethrowControlFlow } from "@/lib/security/route-errors";
import { recordAudit } from "@/lib/security/audit";
import { isEncryptionConfigured } from "@/lib/security/crypto";
import {
  GMAIL_PROVIDER,
  GMAIL_STATE_COOKIE,
  buildAuthorizeUrl,
  isGmailConfigured,
} from "@/lib/integrations/gmail/oauth";
import { db } from "@/lib/db";

/**
 * Starts the Gmail OAuth flow.
 *
 * Refuses before redirecting if anything needed to finish safely is missing.
 * Sending someone to Google's consent screen and only then discovering there
 * is nowhere safe to put the token would mean holding a live credential to a
 * mailbox that cannot be encrypted.
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    // A sandbox must never hold a real mailbox credential, and a mailbox is
    // the most sensitive thing this product can be given access to.
    if (session.org.isSample) {
      return NextResponse.json(
        {
          error:
            "This is a sandbox workspace. Connecting a real mailbox is disabled here — create a real workspace to connect Gmail.",
        },
        { status: 403 }
      );
    }

    if (!isGmailConfigured()) {
      return NextResponse.json(
        {
          error:
            "Gmail is not set up on this deployment yet. An administrator needs to configure its credentials on the server before this connection can be made.",
        },
        { status: 503 }
      );
    }
    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        {
          error:
            "This deployment has no encryption key configured, so a mailbox token cannot be stored safely. Refusing to start the connection.",
        },
        { status: 503 }
      );
    }

    const origin = new URL(req.url).origin;
    const { url, state } = buildAuthorizeUrl({ origin, orgId: session.orgId });

    await db.integrationConnection.upsert({
      where: { orgId_provider: { orgId: session.orgId, provider: GMAIL_PROVIDER } },
      update: { status: "PENDING", lastError: null },
      create: {
        orgId: session.orgId,
        provider: GMAIL_PROVIDER,
        status: "PENDING",
        connectedBy: session.id,
      },
    });

    await recordAudit({
      orgId: session.orgId,
      action: "integration.connect_started",
      actorId: session.id,
      targetType: "integration",
      targetId: GMAIL_PROVIDER,
    });

    const res = NextResponse.redirect(url);
    // Set on the response, not via cookies(): a cookie set through
    // next/headers does not reliably attach to a redirect from a handler.
    res.cookies.set(GMAIL_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    rethrowControlFlow(err);
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[gmail] connect failed:", err);
    return NextResponse.json(
      { error: "Could not start the Gmail connection." },
      { status: 500 }
    );
  }
}
