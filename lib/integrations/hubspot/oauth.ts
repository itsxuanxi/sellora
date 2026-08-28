import "server-only";
import { db } from "@/lib/db";
import {
  decryptSecret,
  encryptSecret,
  randomToken,
  safeEqual,
} from "@/lib/security/crypto";

/**
 * HubSpot OAuth 2.0, authorization-code flow.
 *
 * No SDK: the flow is four HTTP calls and hand-rolling it keeps the token
 * handling visible, which for a credential that grants standing CRM access is
 * where it should be.
 *
 * Two properties this module is responsible for:
 *
 *   1. **State is verified, not merely sent.** The `state` parameter is the
 *      only defence against an attacker completing an OAuth dance into
 *      somebody else's workspace. It is signed into a cookie, compared in
 *      constant time, and single-use.
 *   2. **Tokens are never plaintext at rest.** Both tokens are encrypted
 *      before the row is written, and the only path back out is
 *      `getAccessToken`, which refreshes as needed.
 */

const AUTH_BASE = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const ACCOUNT_INFO_URL = "https://api.hubapi.com/account-info/v3/details";

export const HUBSPOT_PROVIDER = "hubspot";
export const HUBSPOT_STATE_COOKIE = "hubspot_oauth_state";
export const HUBSPOT_CALLBACK_PATH = "/api/integrations/hubspot/callback";

/**
 * Least privilege, and read-only for now.
 *
 * Selryn currently reads CRM data and proposes writes for a human to approve
 * elsewhere. Requesting write scopes we do not yet use would mean asking a
 * customer to grant standing mutation access to their pipeline on the promise
 * we will not use it, which is the wrong trade to ask them to make.
 */
export const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.companies.read",
  "crm.objects.contacts.read",
  "crm.objects.deals.read",
  "crm.objects.owners.read",
  "crm.schemas.deals.read",
];

export function isHubspotConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET);
}

/** Missing credentials are a setup state, not an error to swallow. */
export class HubspotNotConfiguredError extends Error {
  constructor() {
    super(
      "HubSpot is not configured. Set HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET and HUBSPOT_APP_ID."
    );
    this.name = "HubspotNotConfiguredError";
  }
}

export class HubspotAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubspotAuthError";
  }
}

export function redirectUri(origin: string): string {
  return `${origin}${HUBSPOT_CALLBACK_PATH}`;
}

/**
 * Builds the consent URL and the state to store alongside it.
 *
 * State binds the callback to both this browser and this workspace: the cookie
 * proves the same browser started the flow, and the embedded orgId means a
 * callback cannot be replayed into a different tenant.
 */
export function buildAuthorizeUrl(opts: { origin: string; orgId: string }): {
  url: string;
  state: string;
} {
  if (!isHubspotConfigured()) throw new HubspotNotConfiguredError();

  const nonce = randomToken(24);
  const state = `${opts.orgId}.${nonce}`;

  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    redirect_uri: redirectUri(opts.origin),
    scope: HUBSPOT_SCOPES.join(" "),
    state,
  });

  return { url: `${AUTH_BASE}?${params.toString()}`, state };
}

/**
 * Validates a returned state against the cookie and extracts the workspace.
 *
 * Constant-time comparison because a `===` here leaks the state's prefix by
 * timing, and the state is the whole defence.
 */
export function verifyState(
  returned: string | null,
  cookieValue: string | null
): { ok: true; orgId: string } | { ok: false; reason: string } {
  if (!returned || !cookieValue) {
    return { ok: false, reason: "Missing OAuth state. Start the connection again." };
  }
  if (!safeEqual(returned, cookieValue)) {
    return { ok: false, reason: "OAuth state did not match. Start the connection again." };
  }
  const orgId = returned.split(".")[0];
  if (!orgId) return { ok: false, reason: "Malformed OAuth state." };
  return { ok: true, orgId };
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    // HubSpot returns a JSON body with a message; surface it without the
    // request body, which contains the client secret.
    const detail = await res.text().catch(() => "");
    throw new HubspotAuthError(
      `HubSpot token request failed (${res.status}): ${detail.slice(0, 300)}`
    );
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(
  code: string,
  origin: string
): Promise<TokenResponse> {
  if (!isHubspotConfigured()) throw new HubspotNotConfiguredError();
  return postToken({
    grant_type: "authorization_code",
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
    redirect_uri: redirectUri(origin),
    code,
  });
}

async function refresh(refreshToken: string): Promise<TokenResponse> {
  if (!isHubspotConfigured()) throw new HubspotNotConfiguredError();
  return postToken({
    grant_type: "refresh_token",
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
    refresh_token: refreshToken,
  });
}

/** Which portal the tokens belong to, so a reconnect to a different one is detectable. */
export async function fetchAccountInfo(
  accessToken: string
): Promise<{ portalId: string; name: string | null }> {
  const res = await fetch(ACCOUNT_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HubspotAuthError(`Could not read HubSpot account details (${res.status}).`);
  const json = (await res.json()) as { portalId?: number; uiDomain?: string };
  return { portalId: String(json.portalId ?? ""), name: json.uiDomain ?? null };
}

/** Persists a freshly granted grant, encrypted. */
export async function saveConnection(opts: {
  orgId: string;
  tokens: TokenResponse;
  portalId: string;
  portalName: string | null;
  connectedBy?: string | null;
}) {
  const expiresAt = new Date(Date.now() + opts.tokens.expires_in * 1000);

  const data = {
    externalAccountId: opts.portalId,
    externalAccountName: opts.portalName,
    accessTokenEnc: encryptSecret(opts.tokens.access_token),
    refreshTokenEnc: encryptSecret(opts.tokens.refresh_token),
    expiresAt,
    scopes: HUBSPOT_SCOPES.join(" "),
    status: "CONNECTED",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    connectedBy: opts.connectedBy ?? null,
  };

  return db.integrationConnection.upsert({
    where: { orgId_provider: { orgId: opts.orgId, provider: HUBSPOT_PROVIDER } },
    update: data,
    create: { orgId: opts.orgId, provider: HUBSPOT_PROVIDER, ...data },
  });
}

/** Refresh this far before expiry, so a long sync does not die mid-run. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * Returns a usable access token, refreshing first if it is close to expiring.
 *
 * A failed refresh is terminal for the connection: HubSpot has decided the
 * grant is gone, and no amount of retrying changes that. The connection is
 * marked REAUTH_REQUIRED so the UI can ask a human, rather than retried into a
 * rate limit.
 */
export async function getAccessToken(orgId: string): Promise<string> {
  const conn = await db.integrationConnection.findUnique({
    where: { orgId_provider: { orgId, provider: HUBSPOT_PROVIDER } },
  });
  if (!conn?.refreshTokenEnc) {
    throw new HubspotAuthError("HubSpot is not connected for this workspace.");
  }
  if (conn.status === "REVOKED") {
    throw new HubspotAuthError("This HubSpot connection was revoked.");
  }

  const stillValid =
    conn.accessTokenEnc &&
    conn.expiresAt &&
    conn.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS;

  if (stillValid) return decryptSecret(conn.accessTokenEnc!);

  try {
    const tokens = await refresh(decryptSecret(conn.refreshTokenEnc));
    await db.integrationConnection.update({
      where: { id: conn.id },
      data: {
        accessTokenEnc: encryptSecret(tokens.access_token),
        // HubSpot may rotate the refresh token; keep the newest.
        refreshTokenEnc: encryptSecret(tokens.refresh_token ?? decryptSecret(conn.refreshTokenEnc)),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        status: "CONNECTED",
        lastError: null,
        consecutiveFailures: 0,
      },
    });
    return tokens.access_token;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.integrationConnection.update({
      where: { id: conn.id },
      data: {
        status: "REAUTH_REQUIRED",
        lastError: message.slice(0, 500),
        lastErrorAt: new Date(),
      },
    });
    throw new HubspotAuthError(
      "HubSpot access expired and could not be renewed. Reconnect the integration."
    );
  }
}

/**
 * Disconnects and forgets the credentials.
 *
 * The refresh token is deleted rather than kept "in case": a revoked
 * connection that still holds a working credential is exactly the thing a
 * customer revoking access is trying to prevent. Synced business records are
 * left alone; deleting those is a separate, explicit action.
 */
export async function revokeConnection(orgId: string): Promise<void> {
  await db.integrationConnection.updateMany({
    where: { orgId, provider: HUBSPOT_PROVIDER },
    data: {
      status: "REVOKED",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      expiresAt: null,
    },
  });
}
