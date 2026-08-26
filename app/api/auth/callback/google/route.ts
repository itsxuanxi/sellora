import { NextResponse, type NextRequest } from "next/server";
import { provisionWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_STATE_COOKIE,
  exchangeCodeForToken,
  fetchGoogleProfile,
  isGoogleEnabled,
} from "@/lib/google-oauth";
import {
  SESSION_COOKIE,
  createSessionRecord,
  sessionCookieOptions,
} from "@/lib/local-auth";

/** Handles Google's redirect back: verifies state, signs the user in. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/sign-in?error=${reason}`, origin));

  if (!isGoogleEnabled) return fail("google_disabled");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return fail("google_state");
  }

  try {
    const redirectUri = new URL(GOOGLE_CALLBACK_PATH, origin).toString();
    const accessToken = await exchangeCodeForToken(code, redirectUri);
    const profile = await fetchGoogleProfile(accessToken);

    let user = await db.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await provisionWorkspace(
        `google_${profile.id}`,
        profile.email,
        profile.name,
        { imageUrl: profile.picture }
      );
    } else if (!user.imageUrl && profile.picture) {
      user = await db.user.update({
        where: { id: user.id },
        data: { imageUrl: profile.picture },
      });
    }

    const { token, expiresAt } = await createSessionRecord(user.id);
    const res = NextResponse.redirect(new URL("/dashboard", origin));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("[google] sign-in failed:", err);
    return fail("google_failed");
  }
}
