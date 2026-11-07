import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/security/audit";
import { rethrowControlFlow } from "@/lib/security/route-errors";
import {
  GMAIL_PROVIDER,
  GMAIL_STATE_COOKIE,
  exchangeCode,
  fetchMailboxAddress,
  saveConnection,
  verifyState,
} from "@/lib/integrations/gmail/oauth";
import { db } from "@/lib/db";

/** Sends the user back to Integrations with a readable outcome. */
function back(origin: string, params: Record<string, string>) {
  const url = new URL("/integrations", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/** The state cookie has done its job either way; it never outlives the dance. */
function clear(res: NextResponse) {
  res.cookies.set(GMAIL_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

/**
 * Finishes the Gmail OAuth flow.
 *
 * Three things are checked before a token is stored: the state matches the
 * cookie, the workspace in the state is the one the signed-in user belongs
 * to, and Google actually returned a refresh token. The second matters
 * because state alone proves the request came from the browser that started
 * it — not that the person at that browser is still entitled to connect a
 * mailbox to that workspace.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  try {
    const session = await requireSession();
    const url = new URL(req.url);

    const denied = url.searchParams.get("error");
    if (denied) {
      return clear(
        back(origin, {
          integration: "gmail",
          status: "error",
          message:
            denied === "access_denied"
              ? "You declined the Gmail permissions, so nothing was connected."
              : "Google refused the connection.",
        })
      );
    }

    const state = verifyState(
      url.searchParams.get("state"),
      req.headers.get("cookie")?.match(new RegExp(`${GMAIL_STATE_COOKIE}=([^;]+)`))?.[1] ?? null
    );
    if (!state.ok) {
      return clear(
        back(origin, { integration: "gmail", status: "error", message: state.reason })
      );
    }
    if (state.orgId !== session.orgId) {
      return clear(
        back(origin, {
          integration: "gmail",
          status: "error",
          message: "That connection was started for a different workspace.",
        })
      );
    }

    const code = url.searchParams.get("code");
    if (!code) {
      return clear(
        back(origin, {
          integration: "gmail",
          status: "error",
          message: "Google returned no authorization code.",
        })
      );
    }

    const tokens = await exchangeCode({ code, origin });
    const mailbox = await fetchMailboxAddress(tokens.access_token);

    // Reconnecting a *different* mailbox to the same workspace is almost
    // always a mistake, and a silent one: the new inbox has none of the
    // threads the deals were matched against, so evidence quietly stops
    // arriving while everything still reads as connected.
    const existing = await db.integrationConnection.findUnique({
      where: { orgId_provider: { orgId: session.orgId, provider: GMAIL_PROVIDER } },
      select: { externalAccountId: true, status: true },
    });
    if (
      existing?.externalAccountId &&
      mailbox &&
      existing.externalAccountId !== mailbox &&
      existing.status === "CONNECTED"
    ) {
      return clear(
        back(origin, {
          integration: "gmail",
          status: "error",
          message: `This workspace is already connected to ${existing.externalAccountId}. Disconnect it before connecting ${mailbox}.`,
        })
      );
    }

    await saveConnection({
      orgId: session.orgId,
      tokens,
      mailbox,
      connectedBy: session.id,
    });

    await recordAudit({
      orgId: session.orgId,
      action: "integration.connected",
      actorId: session.id,
      targetType: "integration",
      targetId: GMAIL_PROVIDER,
      // Never a token. The safest metadata is metadata that never held one.
      metadata: { mailbox },
    });

    return clear(
      back(origin, {
        integration: "gmail",
        status: "connected",
        mailbox: mailbox ?? "",
      })
    );
  } catch (err) {
    rethrowControlFlow(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[gmail] callback failed:", message);
    return clear(
      back(origin, {
        integration: "gmail",
        status: "error",
        // The refresh-token case has an instruction a person can follow, so
        // it is passed through rather than flattened into "something failed".
        message: message.includes("refresh token")
          ? message
          : "Could not complete the Gmail connection.",
      })
    );
  }
}
