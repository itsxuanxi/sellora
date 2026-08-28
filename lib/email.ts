import "server-only";
import { Resend } from "resend";
import { simulatedId } from "@/lib/sandbox";

/**
 * Email delivery routes through Resend when a key is configured (org-level
 * Settings key first, then RESEND_API_KEY). Without a key, sends are
 * simulated — they get a `sim_` id and the rest of the product (statuses,
 * follow-ups, analytics) behaves identically.
 *
 * A `sandbox` send is simulated even when a key IS configured. That is the
 * guarantee behind the public demo and behind sample data loaded into a real
 * workspace: the recipients are invented people, and no key, plan or code path
 * may deliver mail to them. The check happens here, before the client is
 * constructed, so there is exactly one place to audit.
 */

export interface SendResult {
  id: string;
  simulated: boolean;
  /** True when the send was suppressed by the sandbox rule specifically. */
  sandbox: boolean;
}

function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.65; color: #1a1a1a; white-space: pre-wrap;">${escaped}</div>`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  orgApiKey?: string | null;
  from?: string | null;
  /** Sandbox workspace, or a sample recipient — see lib/sandbox.ts. */
  sandbox?: boolean;
  /** Pre-rendered HTML. Without it the plain body is wrapped for display. */
  html?: string;
  /** Reply-To, so a reply reaches a person rather than the sending domain. */
  replyTo?: string | null;
}): Promise<SendResult> {
  if (params.sandbox) {
    return { id: simulatedId(), simulated: true, sandbox: true };
  }

  const apiKey = params.orgApiKey || process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      id: `sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      simulated: true,
      sandbox: false,
    };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: params.from || process.env.RESEND_FROM_EMAIL || "Selryn <onboarding@resend.dev>",
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: params.html ?? textToHtml(params.body),
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
  return { id: data!.id, simulated: false, sandbox: false };
}
