import "server-only";

/**
 * SMS delivery via Twilio's REST API (no SDK dependency). Configure:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 * Without credentials, callers fall back to dev mode (code shown in UI).
 *
 * Note: Twilio trial accounts can only text numbers you've verified in the
 * Twilio console; upgrade the account to reach arbitrary numbers.
 */

export const isSmsEnabled = Boolean(
  process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
);

export async function sendSms(to: string, body: string): Promise<{ id: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new Error("SMS provider not configured");
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  );

  const data = (await res.json().catch(() => null)) as {
    sid?: string;
    message?: string;
  } | null;
  if (!res.ok || !data?.sid) {
    throw new Error(`Twilio error: ${data?.message ?? res.statusText}`);
  }
  return { id: data.sid };
}
