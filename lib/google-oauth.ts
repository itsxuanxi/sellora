import "server-only";

/**
 * Google Sign-In via the OAuth 2.0 authorization-code flow — no external SDK.
 * Enabled once GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are set.
 *
 * The redirect URI must match a string registered in the Google Cloud console
 * exactly, and it used to be derived from whatever origin the request arrived
 * on. That meant every alias needed its own registration, and Vercel's
 * per-deployment preview URLs — which are generated fresh each time — could
 * never be registered at all, so Google sign-in was permanently broken on
 * previews.
 *
 * GOOGLE_OAUTH_ORIGIN pins the whole flow to one origin instead. It is a
 * dedicated variable rather than a reuse of NEXT_PUBLIC_APP_URL because its
 * value is a contract with a third party: it has to equal a string registered
 * in someone else's console, and NEXT_PUBLIC_APP_URL gets changed for
 * unrelated reasons (Stripe return URLs, links in notification email). Moving
 * one should not silently break sign-in for everybody.
 */

export const isGoogleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

/** Callback path — matches the NextAuth-style URI most people register. */
export const GOOGLE_CALLBACK_PATH = "/api/auth/callback/google";
export const GOOGLE_STATE_COOKIE = "google_oauth_state";

/** The configured canonical origin, normalized, or null when unset. */
export function googleOAuthOrigin(): string | null {
  const raw = process.env.GOOGLE_OAUTH_ORIGIN?.trim();
  if (!raw) return null;
  try {
    // `.origin` drops any path, query or trailing slash someone pasted in, so
    // a stray "/" cannot make the comparison below fail forever and bounce a
    // visitor between two spellings of the same origin.
    return new URL(raw).origin;
  } catch {
    // A malformed value falls back to today's behaviour rather than taking
    // sign-in down; the route logs it once.
    return null;
  }
}

/** Development hosts keep their own origin — nothing is pinned locally. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host === "::1" ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

/**
 * Which origin this sign-in should actually run on.
 *
 * Both halves of the flow call this, which is the point: the authorization
 * request and the token exchange have to send a byte-identical redirect_uri,
 * and deriving them separately is how they drift apart.
 */
export function resolveOAuthOrigin(requestOrigin: string): string {
  if (isLocalOrigin(requestOrigin)) return requestOrigin;
  return googleOAuthOrigin() ?? requestOrigin;
}

/** The redirect_uri for an origin — one definition, used on both sides. */
export function googleRedirectUri(origin: string): string {
  return new URL(GOOGLE_CALLBACK_PATH, origin).toString();
}

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
