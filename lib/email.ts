import "server-only";
import { Resend } from "resend";

/**
 * Email delivery routes through Resend when a key is configured (org-level
 * Settings key first, then RESEND_API_KEY). Without a key, sends are
 * simulated — they get a `sim_` id and the rest of the product (statuses,
 * follow-ups, analytics) behaves identically.
 */

export interface SendResult {
  id: string;
  simulated: boolean;
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
}): Promise<SendResult> {
  const apiKey = params.orgApiKey || process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      id: `sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      simulated: true,
    };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: params.from || process.env.RESEND_FROM_EMAIL || "Selryn <onboarding@resend.dev>",
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: textToHtml(params.body),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
  return { id: data!.id, simulated: false };
}
