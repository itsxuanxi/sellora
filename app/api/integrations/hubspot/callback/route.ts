import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/security/audit";
import {
  HUBSPOT_PROVIDER,
  HUBSPOT_STATE_COOKIE,
  exchangeCode,
  fetchAccountInfo,
  saveConnection,
  verifyState,
} from "@/lib/integrations/hubspot/oauth";
import { enqueueSync } from "@/lib/integrations/sync-runner";

/** Sends the user back to Integrations with a readable outcome. */
function back(origin: string, params: Record<string, string>) {
  const url = new URL("/intent", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * Finishes the HubSpot OAuth flow.
 *
 * Three checks before anything is stored, in this order:
 *
 *   1. HubSpot reported no error.
 *   2. The state matches the cookie, in constant time. This is the only thing
 *      preventing an attacker from completing a dance into someone else's
 *      workspace, so a mismatch is fatal and never "probably fine".
 *   3. The session's workspace is the one the state was issued for. The cookie
 *      proves the same browser started it; this proves the same tenant. A user
 *      who switched workspaces mid-flow must start again rather than have the
 *      CRM land in whichever workspace happens to be active.
 *
 * The state cookie is cleared on every path out, success or failure, so a
 * captured value cannot be reused.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const clear = (res: NextResponse) => {
    res.cookies.set(HUBSPOT_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return clear(
      back(origin, {
        integration: "hubspot",
        status: "denied",
        message: url.searchParams.get("error_description") ?? providerError,
      })
    );
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${HUBSPOT_STATE_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  const state = verifyState(returnedState, cookieState ?? null);
  if (!state.ok) {
    return clear(
      back(origin, { integration: "hubspot", status: "error", message: state.reason })
    );
  }
  if (!code) {
    return clear(
      back(origin, {
        integration: "hubspot",
        status: "error",
        message: "HubSpot did not return an authorization code.",
      })
    );
  }

  try {
    const session = await requireSession();

    if (session.orgId !== state.orgId) {
      return clear(
        back(origin, {
          integration: "hubspot",
          status: "error",
          message:
            "This authorization was started from a different workspace. Start the connection again.",
        })
      );
    }

    const tokens = await exchangeCode(code, origin);
    const account = await fetchAccountInfo(tokens.access_token);

    const connection = await saveConnection({
      orgId: session.orgId,
      tokens,
      portalId: account.portalId,
      portalName: account.name,
      connectedBy: session.id,
    });

    // Queue the backfill rather than running it inline: a first sync of a real
    // portal takes minutes, and an HTTP redirect is not the place for it.
    for (const objectType of ["owners", "companies", "contacts", "deals"]) {
      await enqueueSync({
        orgId: session.orgId,
        connectionId: connection.id,
        kind: "backfill",
        objectType,
      });
    }

    await recordAudit({
      orgId: session.orgId,
      action: "integration.connected",
      actorId: session.id,
      targetType: "integration",
      targetId: HUBSPOT_PROVIDER,
      // No tokens here - recordAudit redacts, but the safest metadata is the
      // metadata that never contained a secret.
      metadata: { portalId: account.portalId, portalName: account.name },
    });

    return clear(
      back(origin, {
        integration: "hubspot",
        status: "connected",
        portal: account.name ?? account.portalId,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[hubspot] callback failed:", message);
    return clear(
      back(origin, {
        integration: "hubspot",
        status: "error",
        message: "Could not complete the HubSpot connection.",
      })
    );
  }
}
