"use server";

import { redirect } from "next/navigation";
import {
  getOrCreateDemoUser,
  isClerkEnabled,
  provisionWorkspace,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createSession, destroySession } from "@/lib/local-auth";
import {
  generateOtpCode,
  hashOtpCode,
  normalizeIdentifier,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_MINUTES,
  type OtpChannel,
} from "@/lib/otp";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isSmsEnabled, sendSms } from "@/lib/sms";
import { actionError, type ActionResult } from "@/lib/types";
import { signInSchema, signUpSchema } from "@/lib/validators";

/**
 * Built-in email/password auth. These actions are only reachable when Clerk
 * is not configured — with Clerk enabled, its components own these flows.
 */

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult> {
  if (isClerkEnabled) return { ok: false, error: "Managed sign-up is enabled." };
  try {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, error: "An account with this email already exists. Sign in instead." };
    }

    const user = await provisionWorkspace(
      `local_${crypto.randomUUID().replace(/-/g, "")}`,
      email,
      name,
      { passwordHash: hashPassword(password) }
    );
    await createSession(user.id);
  } catch (err) {
    return actionError(err, "Could not create your account. Please try again.");
  }
  redirect("/dashboard");
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  if (isClerkEnabled) return { ok: false, error: "Managed sign-in is enabled." };
  try {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const { email, password } = parsed.data;

    const user = await db.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return { ok: false, error: "Invalid email or password." };
    }
    await createSession(user.id);
  } catch (err) {
    return actionError(err, "Could not sign you in. Please try again.");
  }
  redirect("/dashboard");
}

// ── OTP (email / phone verification-code) sign-in ─────────────────────────

/**
 * Sends a 6-digit sign-in code to an email address or phone number.
 * Email codes go through Resend when a key is configured; without one (and
 * for SMS, until a provider is wired up) the code is returned as `devCode`
 * so the flow stays fully usable in development.
 */
export async function requestOtp(rawIdentifier: string): Promise<
  ActionResult<{ channel: OtpChannel; devCode?: string }>
> {
  if (isClerkEnabled) return { ok: false, error: "Managed sign-in is enabled." };
  try {
    const identifier = normalizeIdentifier(rawIdentifier);
    if (!identifier) {
      return { ok: false, error: "Enter a valid email address or phone number." };
    }

    const existing = await db.verificationCode.findUnique({
      where: { identifier: identifier.value },
    });
    if (
      existing &&
      Date.now() - existing.createdAt.getTime() < OTP_RESEND_SECONDS * 1000
    ) {
      return {
        ok: false,
        error: `Please wait ${OTP_RESEND_SECONDS} seconds before requesting another code.`,
      };
    }

    // The code is only ever surfaced in the UI during local development.
    // In production it must reach the user through a real channel.
    const devMode = process.env.NODE_ENV !== "production";
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await db.verificationCode.upsert({
      where: { identifier: identifier.value },
      create: { identifier: identifier.value, codeHash: hashOtpCode(code), expiresAt },
      update: { codeHash: hashOtpCode(code), expiresAt, attempts: 0, createdAt: new Date() },
    });

    if (identifier.channel === "email") {
      const result = await sendEmail({
        to: identifier.value,
        subject: `${code} is your Sellora sign-in code`,
        body: `Your Sellora sign-in code is:\n\n${code}\n\nIt expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.`,
      });
      if (result.simulated && !devMode) {
        return {
          ok: false,
          error: "Email delivery isn't set up yet. Please try again later.",
        };
      }
      return {
        ok: true,
        data: {
          channel: "email",
          ...(result.simulated && devMode ? { devCode: code } : {}),
        },
      };
    }

    if (isSmsEnabled) {
      await sendSms(
        identifier.value,
        `${code} is your Sellora sign-in code. It expires in ${OTP_TTL_MINUTES} minutes.`
      );
      return { ok: true, data: { channel: "phone" } };
    }
    // No SMS provider configured. Never leak the code in production; steer
    // the user to email instead.
    if (!devMode) {
      return {
        ok: false,
        error: "Phone sign-in isn't available yet — please sign in with your email.",
      };
    }
    return { ok: true, data: { channel: "phone", devCode: code } };
  } catch (err) {
    return actionError(err, "Could not send the code. Please try again.");
  }
}

/**
 * Verifies a sign-in code. Unknown identifiers get a fresh workspace
 * automatically (sign-up and sign-in are the same flow).
 */
export async function verifyOtp(
  rawIdentifier: string,
  code: string
): Promise<ActionResult> {
  if (isClerkEnabled) return { ok: false, error: "Managed sign-in is enabled." };
  try {
    const identifier = normalizeIdentifier(rawIdentifier);
    if (!identifier) {
      return { ok: false, error: "Enter a valid email address or phone number." };
    }
    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return { ok: false, error: "Enter the 6-digit code." };
    }

    const record = await db.verificationCode.findUnique({
      where: { identifier: identifier.value },
    });
    if (!record || record.expiresAt < new Date()) {
      return { ok: false, error: "This code has expired — request a new one." };
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return { ok: false, error: "Too many attempts — request a new code." };
    }
    if (record.codeHash !== hashOtpCode(cleanCode)) {
      await db.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return { ok: false, error: "That code isn't right — check and try again." };
    }

    await db.verificationCode.delete({ where: { id: record.id } });

    const user =
      identifier.channel === "email"
        ? await db.user.findUnique({ where: { email: identifier.value } })
        : await db.user.findUnique({ where: { phone: identifier.value } });

    const sessionUser =
      user ??
      (await provisionWorkspace(
        `local_${crypto.randomUUID().replace(/-/g, "")}`,
        identifier.channel === "email" ? identifier.value : null,
        null,
        identifier.channel === "phone" ? { phone: identifier.value } : undefined
      ));

    await createSession(sessionUser.id);
  } catch (err) {
    return actionError(err, "Could not verify the code. Please try again.");
  }
  redirect("/dashboard");
}

/** One-click access to the shared, seeded demo workspace. */
export async function signInToDemo(): Promise<ActionResult> {
  if (isClerkEnabled) return { ok: false, error: "Demo mode is disabled." };
  try {
    const demo = await getOrCreateDemoUser();
    await createSession(demo.id);
  } catch (err) {
    return actionError(err, "Could not open the demo workspace.");
  }
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}
