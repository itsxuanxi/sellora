import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret, randomToken } from "@/lib/security/crypto";

/**
 * Slack OAuth v2.
 *
 * Simpler than the HubSpot flow in one important way: a bot token does not
 * expire, so there is no refresh cycle and no window where a background job
 * finds a dead credential. What it shares is the part that matters — the
 * token is encrypted at rest, never returned to the client, and the
 * connection row exists from the moment the dance starts so a half-finished
 * install is visible rather than invisible.
 *
 * The scopes are the smallest set that can post a message. Selryn does not
 * read Slack: it has nothing to learn there, and asking a customer for read
 * access to their conversations to deliver a digest would be the wrong trade.
 */

export const SLACK_PROVIDER = "slack";
export const SLACK_STATE_COOKIE = "selryn_slack_state";

export const SLACK_SCOPES = [
  // Post messages to a channel the installer picks.
  "chat:write",
  // Post to a public channel without first being invited to it.
  "chat:write.public",
  // List public channels, so the picker shows names rather than raw ids.
  "channels:read",
];

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
}

export class SlackNotConfiguredError extends Error {
  constructor() {
    super(
      "Slack is not configured on this deployment. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET."
    );
    this.name = "SlackNotConfiguredError";
  }
}

export function slackRedirectUri(origin: string): string {
  return `${origin}/api/integrations/slack/callback`;
}

export function buildAuthorizeUrl(opts: { origin: string; state: string }): string {
  if (!isSlackConfigured()) throw new SlackNotConfiguredError();
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    scope: SLACK_SCOPES.join(","),
    redirect_uri: slackRedirectUri(opts.origin),
    state: opts.state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export function newState(): string {
  return randomToken(24);
}

interface SlackTokenResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  scope?: string;
  team?: { id?: string; name?: string };
}

/**
 * Exchanges the code for a bot token.
 *
 * Slack answers 200 with `ok: false` for most failures rather than an HTTP
 * error, so the body has to be checked. Treating a 200 as success is the
 * classic way to store an empty token and then puzzle over why posting
 * silently does nothing.
 */
export async function exchangeCode(opts: {
  code: string;
  origin: string;
}): Promise<SlackTokenResponse> {
  if (!isSlackConfigured()) throw new SlackNotConfiguredError();

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code: opts.code,
      redirect_uri: slackRedirectUri(opts.origin),
    }),
  });

  const body = (await res.json()) as SlackTokenResponse;
  if (!res.ok || !body.ok || !body.access_token) {
    throw new Error(`Slack rejected the authorization: ${body.error ?? res.status}`);
  }
  return body;
}

export interface SlackConfig {
  /** The channel alerts are posted to. */
  channelId?: string;
  channelName?: string;
}

export function readConfig(raw: string | null | undefined): SlackConfig {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as SlackConfig;
  } catch {
    return {};
  }
}

export async function storeGrant(opts: {
  orgId: string;
  userId: string;
  tokens: SlackTokenResponse;
}) {
  const data = {
    accessTokenEnc: encryptSecret(opts.tokens.access_token!),
    externalAccountId: opts.tokens.team?.id ?? null,
    externalAccountName: opts.tokens.team?.name ?? null,
    scopes: opts.tokens.scope ?? SLACK_SCOPES.join(","),
    // No channel chosen yet: the install is connected but cannot deliver
    // until someone picks one, and the UI says exactly that.
    status: "CONNECTED",
    connectedBy: opts.userId,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
  };

  return db.integrationConnection.upsert({
    where: { orgId_provider: { orgId: opts.orgId, provider: SLACK_PROVIDER } },
    create: { orgId: opts.orgId, provider: SLACK_PROVIDER, ...data },
    update: data,
  });
}

/** The bot token, decrypted. Null when Slack is not usable for this org. */
export async function getSlackToken(orgId: string): Promise<string | null> {
  const conn = await db.integrationConnection.findUnique({
    where: { orgId_provider: { orgId, provider: SLACK_PROVIDER } },
    select: { accessTokenEnc: true, status: true },
  });
  if (!conn?.accessTokenEnc || conn.status !== "CONNECTED") return null;
  return decryptSecret(conn.accessTokenEnc);
}

/**
 * Disconnects and forgets the token.
 *
 * The row is kept so the workspace's integration history stays readable, but
 * the credential is deleted rather than retained "in case" — that is the
 * whole point of someone clicking disconnect.
 */
export async function revokeSlack(orgId: string): Promise<void> {
  await db.integrationConnection.updateMany({
    where: { orgId, provider: SLACK_PROVIDER },
    data: {
      status: "REVOKED",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      expiresAt: null,
      config: null,
    },
  });
}
