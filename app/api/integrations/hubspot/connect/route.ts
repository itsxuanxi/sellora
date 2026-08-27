import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/security/rbac";
import { rethrowControlFlow } from "@/lib/security/route-errors";
import { recordAudit } from "@/lib/security/audit";
import { isEncryptionConfigured } from "@/lib/security/crypto";
import {
  HUBSPOT_PROVIDER,
  HUBSPOT_STATE_COOKIE,
  buildAuthorizeUrl,
  isHubspotConfigured,
} from "@/lib/integrations/hubspot/oauth";
import { db } from "@/lib/db";

/**
 * Starts the HubSpot OAuth flow.
 *
 * Refuses before redirecting if anything needed to finish safely is missing.
 * Sending a customer to HubSpot's consent screen and only then discovering
 * there is nowhere safe to put the token would mean holding a live credential
 * we cannot encrypt.
 *
 * The state cookie is httpOnly, sameSite=lax and short-lived: lax rather than
 * strict because the callback is a cross-site redirect back from HubSpot and
 * strict would drop the cookie exactly when it is needed.
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    if (!isHubspotConfigured()) {
      return NextResponse.json(
        {
          error:
            "HubSpot is not configured on this deployment. Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.",
        },
        { status: 503 }
      );
    }
    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        {
          error:
            "ENCRYPTION_KEY is not set, so OAuth tokens cannot be stored safely. Refusing to start.",
        },
        { status: 503 }
      );
    }

    const origin = new URL(req.url).origin;
    const { url, state } = buildAuthorizeUrl({ origin, orgId: session.orgId });

    // The row exists from the moment the dance starts, so an abandoned
    // authorization is visible as PENDING rather than as nothing at all.
    await db.integrationConnection.upsert({
      where: { orgId_provider: { orgId: session.orgId, provider: HUBSPOT_PROVIDER } },
      update: { status: "PENDING", lastError: null },
      create: {
        orgId: session.orgId,
        provider: HUBSPOT_PROVIDER,
        status: "PENDING",
        connectedBy: session.id,
      },
    });

    await recordAudit({
      orgId: session.orgId,
      action: "integration.connect_started",
      actorId: session.id,
      targetType: "integration",
      targetId: HUBSPOT_PROVIDER,
    });

    const res = NextResponse.redirect(url);
    // Set on the response, not via cookies(): a cookie set through next/headers
    // does not reliably attach to a redirect from a route handler.
    res.cookies.set(HUBSPOT_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    // requireSession() signals "not signed in" by throwing a redirect. Eating
    // it here would both swallow the redirect and report an ordinary
    // unauthenticated request as a server error.
    rethrowControlFlow(err);

    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[hubspot] connect failed:", err);
    return NextResponse.json(
      { error: "Could not start the HubSpot connection." },
      { status: 500 }
    );
  }
}
