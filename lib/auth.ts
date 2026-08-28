import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLocalSessionUser } from "@/lib/local-auth";
import { isClerkEnabled } from "@/lib/flags";
import { SAMPLE_ORG, seedSampleData } from "@/lib/sample-data";

/**
 * Two auth modes share one session shape:
 * - Clerk keys configured → Clerk owns sign-in/sign-up; users are provisioned
 *   into a workspace on first login.
 * - No Clerk keys → the built-in email/password system (lib/local-auth.ts)
 *   with database sessions, plus one-click access to a throwaway sandbox
 *   workspace (`createSandboxWorkspace`).
 */

export { isClerkEnabled };

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

/** How long an anonymous sandbox workspace survives before it is reaped. */
const SANDBOX_TTL_DAYS = 7;

/** Reaps expired sandboxes opportunistically, a few at a time. */
async function reapExpiredSandboxes(): Promise<void> {
  try {
    const stale = await db.organization.findMany({
      where: { isSample: true, sampleExpiresAt: { lt: new Date() } },
      select: { id: true },
      take: 20,
    });
    if (stale.length === 0) return;
    await db.organization.deleteMany({ where: { id: { in: stale.map((o) => o.id) } } });
  } catch {
    // Housekeeping must never block someone opening the demo.
  }
}

/**
 * Provisions a throwaway sandbox workspace and fills it with sample data.
 *
 * One org per visitor rather than one shared demo org: the sandbox is the real
 * product with real writes, so two people exploring at once would otherwise be
 * approving and dismissing each other's recommendations.
 *
 * `isSample` on the organization is what makes this safe — every outbound
 * effect checks it (lib/sandbox.ts) and refuses to leave the building.
 */
export async function createSandboxWorkspace(): Promise<SessionContext> {
  await reapExpiredSandboxes();

  const authId = `sandbox_${randomUUID()}`;
  // User.email is unique, so sandboxes cannot share the sample sender address.
  // `.invalid` is reserved by RFC 2606 and can never resolve to a real inbox,
  // which is the point: this account must be undeliverable by construction.
  const email = `${authId}@sandbox.invalid`;

  const org = await db.organization.create({
    data: {
      name: SAMPLE_ORG.name,
      isSample: true,
      sampleExpiresAt: new Date(Date.now() + SANDBOX_TTL_DAYS * 86_400_000),
      settings: { create: {} },
      users: {
        create: {
          clerkId: authId,
          email,
          name: SAMPLE_ORG.senderName,
          role: "owner",
        },
      },
    },
  });

  await seedSampleData(db, org.id, { applyIdentity: true });

  return db.user.findUniqueOrThrow({ where: { clerkId: authId }, include: userInclude });
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
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "unknown@selryn.ai";
  const name = clerkUser
    ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null
    : null;
  return provisionWorkspace(userId, email, name, { imageUrl: clerkUser?.imageUrl });
}

/** For UI that only needs to know whether someone is signed in (e.g. navbar). */
export async function getAuthState(): Promise<{ signedIn: boolean }> {
  try {
    if (isClerkEnabled) {
      const { userId } = await auth();
      return { signedIn: Boolean(userId) };
    }
    return { signedIn: Boolean(await getLocalSessionUser()) };
  } catch (error) {
    // Preserve Next.js control-flow errors used for redirects and dynamic
    // rendering; only real authentication/backend failures degrade safely.
    unstable_rethrow(error);
    // Authentication status only changes the marketing CTA destination. A
    // transient database/auth outage must not take the public homepage down;
    // fail closed to the sign-in link and let protected routes enforce the
    // real session normally.
    console.error("[auth] could not resolve marketing auth state", error);
    return { signedIn: false };
  }
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
