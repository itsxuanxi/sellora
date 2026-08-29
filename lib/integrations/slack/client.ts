import "server-only";
import { getSlackToken } from "@/lib/integrations/slack/oauth";

/**
 * The two Slack calls Selryn makes: list channels, and post a message.
 *
 * Slack answers 200 with `ok: false` for application errors, so every call
 * checks the body. `rate_limited` is surfaced distinctly because it is the
 * one failure worth retrying unchanged.
 */

export class SlackApiError extends Error {
  readonly slackError: string;
  readonly retryable: boolean;
  constructor(slackError: string) {
    super(`Slack API error: ${slackError}`);
    this.name = "SlackApiError";
    this.slackError = slackError;
    this.retryable = slackError === "ratelimited" || slackError === "service_unavailable";
  }
}

async function call<T>(
  token: string,
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { ok: boolean; error?: string };
  if (!json.ok) throw new SlackApiError(json.error ?? `http_${res.status}`);
  return json;
}

export interface SlackChannel {
  id: string;
  name: string;
}

/** Public channels the bot can post to, for the picker. */
export async function listChannels(orgId: string): Promise<SlackChannel[]> {
  const token = await getSlackToken(orgId);
  if (!token) return [];

  const json = await call<{ channels?: { id: string; name: string; is_archived?: boolean }[] }>(
    token,
    "conversations.list",
    { exclude_archived: true, limit: 200, types: "public_channel" }
  );
  return (json.channels ?? [])
    .filter((c) => !c.is_archived)
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function postMessage(opts: {
  orgId: string;
  channel: string;
  text: string;
  blocks?: unknown[];
}): Promise<{ ts: string }> {
  const token = await getSlackToken(opts.orgId);
  if (!token) throw new SlackApiError("not_connected");

  const json = await call<{ ts: string }>(token, "chat.postMessage", {
    channel: opts.channel,
    // `text` is the notification preview and the accessible fallback; Slack
    // shows it where blocks cannot render, so it is never omitted.
    text: opts.text,
    blocks: opts.blocks,
  });
  return { ts: json.ts };
}
