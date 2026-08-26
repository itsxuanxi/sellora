import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * Database-backed sessions for the built-in auth mode (used when Clerk keys
 * are not configured). The cookie stores an opaque random token; the session
 * row carries the expiry. Middleware only checks cookie presence — the real
 * validation happens here on every request.
 */

export const SESSION_COOKIE = "sellora_session";
const SESSION_DAYS = 30;

/** Creates the DB session row and returns the token — no cookie side effect. */
export async function createSessionRecord(
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

/** Session cookie options shared by every place that sets it. */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

/** For Server Actions (signUp / signIn / OTP): sets the cookie via next/headers. */
export async function createSession(userId: string) {
  const { token, expiresAt } = await createSessionRecord(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function getLocalSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { include: { org: { include: { settings: true } } } } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
}
