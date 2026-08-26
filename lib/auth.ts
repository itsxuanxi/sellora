import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLocalSessionUser } from "@/lib/local-auth";
import { isClerkEnabled } from "@/lib/flags";

/**
 * Two auth modes share one session shape:
 * - Clerk keys configured → Clerk owns sign-in/sign-up; users are provisioned
 *   into a workspace on first login.
 * - No Clerk keys → the built-in email/password system (lib/local-auth.ts)
 *   with database sessions, plus a one-click shared demo workspace.
 */

export { isClerkEnabled };

export const DEMO_CLERK_ID = "demo_user";

export type SessionContext = Prisma.UserGetPayload<{
  include: { org: { include: { settings: true } } };
}>;

const userInclude = { org: { include: { settings: true } } } as const;

export async function provisionWorkspace(
  authId: string,
  email: string | null,
  name: string | null,
  opts?: {
    imageUrl?: string | null;
    passwordHash?: string | null;
    phone?: string | null;
  }
): Promise<SessionContext> {
  await db.organization.create({
    data: {
      name: name ? `${name.split(" ")[0]}'s Workspace` : "My Workspace",
      settings: { create: {} },
      users: {
        create: {
          clerkId: authId,
          email,
          phone: opts?.phone ?? null,
          name,
          imageUrl: opts?.imageUrl ?? null,
          passwordHash: opts?.passwordHash ?? null,
          role: "owner",
        },
      },
    },
  });
  return db.user.findUniqueOrThrow({
    where: { clerkId: authId },
    include: userInclude,
  });
}

/** Returns the shared demo workspace user, creating it if the seed never ran. */
export async function getOrCreateDemoUser(): Promise<SessionContext> {
  const user = await db.user.findUnique({
    where: { clerkId: DEMO_CLERK_ID },
    include: userInclude,
  });
  if (user) return user;
  return provisionWorkspace(DEMO_CLERK_ID, "demo@sellora.ai", "Demo User");
}

async function loadSession(): Promise<SessionContext | null> {
  if (!isClerkEnabled) {
    return getLocalSessionUser();
  }

  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.user.findUnique({
    where: { clerkId: userId },
    include: userInclude,
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "unknown@sellora.ai";
  const name = clerkUser
    ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null
    : null;
  return provisionWorkspace(userId, email, name, { imageUrl: clerkUser?.imageUrl });
}

/** For UI that only needs to know whether someone is signed in (e.g. navbar). */
export async function getAuthState(): Promise<{ signedIn: boolean }> {
  if (isClerkEnabled) {
    const { userId } = await auth();
    return { signedIn: Boolean(userId) };
  }
  return { signedIn: Boolean(await getLocalSessionUser()) };
}

/**
 * Resolves the signed-in user and their organization, provisioning a
 * workspace on first login. Cached per-request. Redirects to /sign-in when
 * unauthenticated.
 */
export const requireSession = cache(async (): Promise<SessionContext> => {
  const session = await loadSession();
  if (!session) redirect("/sign-in");
  return session;
});
