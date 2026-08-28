"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  CRM_OPTIONS,
  DEMO_INBOX,
  OPPORTUNITY_VOLUMES,
  TEAM_SIZES,
  labelFor,
  validateDemoRequest,
  type DemoRequestResult,
} from "@/lib/marketing/demo-request";

/**
 * Receives a demo request.
 *
 * Order of operations is the whole design:
 *
 *   1. Validate on the server. The client also validates, but only this parse
 *      decides anything.
 *   2. Rate limit, before any write.
 *   3. Store the request. This is the record.
 *   4. Notify by email, best effort.
 *
 * Storing before notifying is what stops a Resend outage - or simply a
 * deployment with no API key - from losing a lead somebody spent two minutes
 * typing. It is also what makes the success screen honest: it appears because
 * the request is durably saved, not because a mail provider accepted a
 * message. A send failure is recorded on the row and surfaced in the logs
 * rather than shown to the visitor, who has done nothing wrong and can do
 * nothing about it.
 */

/**
 * Where submissions are delivered.
 *
 * Environment-driven so the destination can be changed without a code change
 * or a deploy - rerouting who reads incoming leads is an operational decision,
 * not an engineering one. Falls back to the address on the page so a
 * deployment that never sets it still delivers somewhere real rather than
 * silently nowhere.
 */
function demoNotifyEmail(): string {
  return process.env.DEMO_NOTIFY_EMAIL?.trim() || DEMO_INBOX;
}

/** Per-hour caps. Generous enough that no real person meets them. */
const MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_PER_IP_PER_HOUR = 8;

/**
 * Best-effort client IP.
 *
 * Reads the leftmost x-forwarded-for entry, which on Vercel is the real client.
 * Spoofable in general, which is why it is a coarse throttle and never an
 * identity or an authorization decision.
 */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return h.get("x-real-ip")?.slice(0, 64) ?? null;
}

export async function submitDemoRequest(
  input: unknown
): Promise<DemoRequestResult> {
  const parsed = validateDemoRequest(input);

  if (!parsed.ok) {
    // The honeypot is filled: this is a bot. Reported as a generic failure
    // rather than "you tripped the honeypot", which would just teach the next
    // script to leave the field alone.
    if (parsed.errors.website) {
      return { ok: false, formError: "Could not submit the form. Please try again." };
    }
    return { ok: false, errors: parsed.errors };
  }

  const values = parsed.values;

  try {
    const ip = await clientIp();
    const h = await headers();
    const since = new Date(Date.now() - 60 * 60 * 1000);

    const [byEmail, byIp] = await Promise.all([
      db.demoRequest.count({
        where: { workEmail: values.workEmail, createdAt: { gte: since } },
      }),
      ip
        ? db.demoRequest.count({ where: { ip, createdAt: { gte: since } } })
        : Promise.resolve(0),
    ]);

    if (byEmail >= MAX_PER_EMAIL_PER_HOUR || byIp >= MAX_PER_IP_PER_HOUR) {
      return {
        ok: false,
        formError:
          `We already have a request from you. Someone will be in touch shortly - email ${DEMO_INBOX} if it is urgent.`,
      };
    }

    // ── The record ──
    const request = await db.demoRequest.create({
      data: {
        fullName: values.fullName,
        workEmail: values.workEmail,
        company: values.company,
        role: values.role,
        teamSize: values.teamSize,
        crm: values.crm || null,
        opportunityVolume: values.opportunityVolume || null,
        goal: values.goal,
        heardFrom: values.heardFrom || null,
        ip,
        userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
      },
    });

    // ── The notification ──
    // Deliberately after the write and outside its failure path.
    try {
      const result = await sendEmail({
        to: demoNotifyEmail(),
        subject: `Demo request: ${values.company} (${values.fullName})`,
        body: formatNotification(values),
        // Replies go to the person who asked, not to the inbox itself.
        from: process.env.RESEND_FROM_EMAIL || null,
      });

      await db.demoRequest.update({
        where: { id: request.id },
        data: {
          notifyStatus: result.simulated ? "SIMULATED" : "SENT",
          notifiedAt: new Date(),
        },
      });

      if (result.simulated) {
        // Loud, because a production deployment in this state is silently
        // collecting leads nobody is reading.
        console.warn(
          `[demo-request] ${request.id} stored but NOT emailed - RESEND_API_KEY is not set.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[demo-request] ${request.id} stored, notification failed:`, message);
      await db.demoRequest.update({
        where: { id: request.id },
        data: { notifyStatus: "FAILED", notifyError: message.slice(0, 500) },
      });
      // Still a success for the visitor. Their request is saved; the broken
      // part is ours to fix, and telling them to retry would create duplicates.
    }

    return { ok: true };
  } catch (err) {
    // Only a storage failure reaches here, and that is the one case where the
    // request really is lost - so it must not report success.
    console.error("[demo-request] could not store request:", err);
    return {
      ok: false,
      formError: `Something went wrong on our side. Please email ${DEMO_INBOX} and we will pick it up.`,
    };
  }
}

/** Plain-text notification. Readable in any client, greppable in an inbox. */
function formatNotification(v: {
  fullName: string;
  workEmail: string;
  company: string;
  role: string;
  teamSize: string;
  crm?: string;
  opportunityVolume?: string;
  goal: string;
  heardFrom?: string;
}): string {
  return [
    `New demo request from ${v.company}`,
    "",
    `Name:            ${v.fullName}`,
    `Work email:      ${v.workEmail}`,
    `Company:         ${v.company}`,
    `Role:            ${v.role}`,
    `Sales team size: ${labelFor(TEAM_SIZES, v.teamSize)}`,
    `Current CRM:     ${labelFor(CRM_OPTIONS, v.crm)}`,
    `Monthly active opportunities: ${labelFor(OPPORTUNITY_VOLUMES, v.opportunityVolume)}`,
    `Heard about us:  ${v.heardFrom || "Not provided"}`,
    "",
    "What they want Selryn to improve:",
    v.goal,
    "",
    `Reply directly to ${v.workEmail}.`,
  ].join("\n");
}
