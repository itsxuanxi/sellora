import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_STATE_COOKIE,
  googleAuthUrl,
  isGoogleEnabled,
} from "@/lib/google-oauth";

/** Kicks off Google sign-in: sets a CSRF state cookie and redirects to Google. */
export async function GET(req: NextRequest) {
  if (!isGoogleEnabled) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL(
    GOOGLE_CALLBACK_PATH,
    req.nextUrl.origin
  ).toString();

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
