import "server-only";

/**
 * Google Sign-In via the OAuth 2.0 authorization-code flow — no external SDK.
 * Enabled once GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are set. The redirect
 * URI is derived from the incoming request origin, so it works on localhost
 * and in production without extra config (both must be registered in the
 * Google Cloud console).
 */

export const isGoogleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

/** Callback path — matches the NextAuth-style URI most people register. */
export const GOOGLE_CALLBACK_PATH = "/api/auth/callback/google";
export const GOOGLE_STATE_COOKIE = "google_oauth_state";

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    error_description?: string;
  } | null;
  if (!res.ok || !data?.access_token) {
    throw new Error(`Google token exchange failed: ${data?.error_description ?? res.statusText}`);
  }
  return data.access_token;
}

export interface GoogleProfile {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  verified: boolean;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => null)) as {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
    verified_email?: boolean;
  } | null;
  if (!res.ok || !data?.email || !data.id) {
    throw new Error("Could not read Google profile");
  }
  return {
    id: data.id,
    email: data.email.toLowerCase(),
    name: data.name ?? null,
    picture: data.picture ?? null,
    verified: Boolean(data.verified_email),
  };
}
