import "server-only";
import { db } from "@/lib/db";
import {
  decryptSecret,
  encryptSecret,
  randomToken,
  safeEqual,
} from "@/lib/security/crypto";

/**
 * Gmail OAuth — the connection that lets Selryn read what a buyer wrote.
 *
 * Deliberately separate from `lib/google-oauth.ts`, which is sign-in. The two
 * share a Google Cloud project and nothing else: sign-in asks for identity
 * ("openid email profile") and is granted in a second by anyone; this asks to
 * read a mailbox, which is a decision an agency owner should make
 * deliberately and separately. Folding the mailbox scopes into the sign-in
 * button would obtain inbox access from people who thought they were logging
 * in, which is the kind of consent that is technically given and not actually
 * given.
 *
 * ── Why this connector matters more than the others ──
 *
 * HubSpot's engagement sync carries an email's subject, direction and
 * timestamp. That is enough to know a proposal went unanswered, which is the
 * product's main claim and the reason the rules work at all. It is not enough
 * to know *why* — the sentence where the buyer says the price is a problem,
 * or asks who else needs to approve, lives in a body nothing has ever read.
 * This is the only path to it.
 *
 * ── The verification gate, stated before anyone builds on this ──
 *
 * `gmail.readonly` and `gmail.send` are Restricted scopes. Google requires an
 * annual third-party security assessment (CASA) before an app using them can
 * be published to users outside the developer's own Workspace domain. Until
 * that is passed the app stays in Testing mode and works for up to 100
 * addresses added by hand. That is a real gate with a real cost and a lead
 * time measured in weeks, and it applies no matter how finished this code is.
 * A pilot with a handful of design partners fits inside Testing mode; a
 * public launch does not.
 */

export const GMAIL_PROVIDER = "gmail";
export const GMAIL_STATE_COOKIE = "gmail_oauth_state";
export const GMAIL_CALLBACK_PATH = "/api/integrations/gmail/callback";

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

/**
 * Read, and send as the person who connected.
 *
 * `gmail.readonly` rather than `gmail.modify`: Selryn never needs to change
 * or delete anything in a mailbox, and asking for the ability to would be
 * asking for trust it has no use for. `gmail.send` is what lets a follow-up
 * leave from the agency's own address and land in the existing thread —
 * without it, mail goes out from Selryn's domain, starts a conversation the
 * client does not recognise, and is far likelier to be filtered.
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGmailConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GMAIL_INTEGRATION_ENABLED === "true"
  );
}

/** Missing credentials are a setup state, not an error to swallow. */
export class GmailNotConfiguredError extends Error {
  constructor() {
    super("Gmail is not set up on this deployment.");
    this.name = "GmailNotConfiguredError";
  }
}

export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailAuthError";
  }
}

export function redirectUri(origin: string): string {
  return `${origin}${GMAIL_CALLBACK_PATH}`;
}

export function buildAuthorizeUrl(opts: { origin: string; orgId: string }): {
  url: string;
  state: string;
} {
  if (!isGmailConfigured()) throw new GmailNotConfiguredError();

  const nonce = randomToken(24);
  const state = `${opts.orgId}.${nonce}`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(opts.origin),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    state,
    // Both are required to get a refresh token at all. Google returns one
    // only on the first consent unless `prompt=consent` forces it, and an
    // integration that silently has no refresh token works for an hour and
    // then stops in a way that looks like a sync bug.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  return { url: `${AUTH_BASE}?${params.toString()}`, state };
}

/**
 * Validates a returned state against the cookie and extracts the workspace.
 *
 * Constant-time comparison, because `===` leaks the state's prefix by timing
 * and the state is the whole defence against a forged callback.
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
  if (!orgId) {
    return { ok: false, reason: "OAuth state carried no workspace." };
  }
  return { ok: true, orgId };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export async function exchangeCode(opts: {
  code: string;
  origin: string;
}): Promise<TokenResponse> {
  if (!isGmailConfigured()) throw new GmailNotConfiguredError();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(opts.origin),
    }),
  });

  if (!res.ok) {
    throw new GmailAuthError(
      `Google refused the authorization code (${res.status}). Start the connection again.`
    );
  }
  return (await res.json()) as TokenResponse;
}

/** Which mailbox this is, so a reconnect to a different one is detectable. */
export async function fetchMailboxAddress(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { email?: string };
  return body.email ?? null;
}

export async function saveConnection(opts: {
  orgId: string;
  tokens: TokenResponse;
  mailbox: string | null;
  connectedBy?: string | null;
}) {
  if (!opts.tokens.refresh_token) {
    // Without one the connection dies in an hour. Better to refuse now, with
    // a sentence a person can act on, than to appear connected and stop.
    throw new GmailAuthError(
      "Google did not return a refresh token. Remove Selryn at myaccount.google.com/permissions and connect again."
    );
  }

  const data = {
    externalAccountId: opts.mailbox,
    externalAccountName: opts.mailbox,
    accessTokenEnc: encryptSecret(opts.tokens.access_token),
    refreshTokenEnc: encryptSecret(opts.tokens.refresh_token),
    expiresAt: new Date(Date.now() + opts.tokens.expires_in * 1000),
    // What Google granted, which is not always what was asked for.
    scopes: (opts.tokens.scope ?? GMAIL_SCOPES.join(" ")).trim(),
    status: "CONNECTED",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    connectedBy: opts.connectedBy ?? null,
  };

  return db.integrationConnection.upsert({
    where: { orgId_provider: { orgId: opts.orgId, provider: GMAIL_PROVIDER } },
    update: data,
    create: { orgId: opts.orgId, provider: GMAIL_PROVIDER, ...data },
  });
}

/** Refresh this far before expiry, so a long sync does not die mid-run. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export async function getAccessToken(orgId: string): Promise<string> {
  const conn = await db.integrationConnection.findUnique({
    where: { orgId_provider: { orgId, provider: GMAIL_PROVIDER } },
  });
  if (!conn?.refreshTokenEnc) {
    throw new GmailAuthError("Gmail is not connected for this workspace.");
  }
  if (conn.status === "REVOKED") {
    throw new GmailAuthError("This Gmail connection was revoked.");
  }

  const stillValid =
    conn.accessTokenEnc &&
    conn.expiresAt &&
    conn.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS;
  if (stillValid) return decryptSecret(conn.accessTokenEnc!);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptSecret(conn.refreshTokenEnc),
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    // Google has decided the grant is gone. Retrying cannot bring it back, so
    // the connection asks for a human instead of burning into a rate limit.
    await db.integrationConnection.update({
      where: { id: conn.id },
      data: {
        status: "REAUTH_REQUIRED",
        lastError: "Google rejected the refresh token. Reconnect the mailbox.",
        lastErrorAt: new Date(),
      },
    });
    throw new GmailAuthError("Gmail needs reconnecting for this workspace.");
  }

  const tokens = (await res.json()) as TokenResponse;
  await db.integrationConnection.update({
    where: { id: conn.id },
    data: {
      accessTokenEnc: encryptSecret(tokens.access_token),
      // Google rotates refresh tokens rarely; keep the newest when it does.
      refreshTokenEnc: tokens.refresh_token
        ? encryptSecret(tokens.refresh_token)
        : conn.refreshTokenEnc,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      status: "CONNECTED",
    },
  });
  return tokens.access_token;
}

/**
 * Disconnects, and tells Google so the grant disappears from the user's
 * account page rather than lingering as access nobody is using.
 */
export async function revokeConnection(orgId: string): Promise<void> {
  const conn = await db.integrationConnection.findUnique({
    where: { orgId_provider: { orgId, provider: GMAIL_PROVIDER } },
  });
  if (!conn) return;

  if (conn.refreshTokenEnc) {
    try {
      await fetch(REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: decryptSecret(conn.refreshTokenEnc) }),
      });
    } catch {
      // A failed revoke must not block the disconnect: the tokens are
      // destroyed below either way, and leaving the row connected because
      // Google was briefly unreachable is the worse outcome.
    }
  }

  await db.integrationConnection.update({
    where: { id: conn.id },
    data: {
      status: "REVOKED",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      expiresAt: null,
    },
  });
}
