import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_STATE_COOKIE,
  googleAuthUrl,
  googleRedirectUri,
  isGoogleEnabled,
  resolveOAuthOrigin,
} from "@/lib/google-oauth";

/** Kicks off Google sign-in: sets a CSRF state cookie and redirects to Google. */
export async function GET(req: NextRequest) {
  if (!isGoogleEnabled) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }

  const requestOrigin = req.nextUrl.origin;
  const origin = resolveOAuthOrigin(requestOrigin);

  // Restart the flow on the canonical origin when it began somewhere else —
  // a second alias, or a per-deployment preview URL.
  //
  // Redirecting here rather than merely pinning redirect_uri is the whole
  // point. The state cookie is set per origin, so sending the browser to
  // Google from one origin and receiving it back on another would leave the
  // callback with no cookie to compare against: every sign-in would fail the
  // CSRF check instead of mismatching the redirect URI. Cookie and
  // redirect_uri have to live on the same origin, so both move together.
  if (origin !== requestOrigin) {
    return NextResponse.redirect(new URL("/api/auth/google", origin));
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = googleRedirectUri(origin);

  // Set the state cookie on the redirect response itself — setting it via
  // next/headers before returning a NextResponse.redirect is unreliable.
  const res = NextResponse.redirect(googleAuthUrl(redirectUri, state));
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
