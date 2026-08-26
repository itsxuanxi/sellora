"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAgentAction } from "@/lib/agent";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";

function revalidateAccounts(id?: string) {
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/agent");
  if (id) revalidatePath(`/accounts/${id}`);
}

const accountSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(160),
  domain: z.string().trim().max(200).optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  companySize: z.string().trim().max(40).optional().or(z.literal("")),
  region: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function createAccount(
  input: z.infer<typeof accountSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

    const existing = await db.account.findUnique({
      where: { orgId_name: { orgId: session.orgId, name: parsed.data.name } },
    });
    if (existing) return { ok: false, error: "An account with this name already exists." };

    const account = await db.account.create({
      data: {
        orgId: session.orgId,
        name: parsed.data.name,
        domain: parsed.data.domain || null,
        industry: parsed.data.industry || null,
        companySize: parsed.data.companySize || null,
        region: parsed.data.region || null,
        source: "manual",
        verified: true,
      },
    });
    // Link any existing contacts with the same company name.
    await db.prospect.updateMany({
      where: { orgId: session.orgId, company: parsed.data.name, accountId: null },
      data: { accountId: account.id },
    });
    revalidateAccounts();
    return { ok: true, data: { id: account.id } };
  } catch (err) {
    return actionError(err, "Could not create the account.");
  }
}

/**
 * Builds accounts from existing contacts (grouped by company) and queues
 * research + scoring for each new account, honoring the autonomy mode.
 */
export async function importAccountsFromContacts(): Promise<
  ActionResult<{ created: number; linked: number; queued: number }>
> {
  try {
    const session = await requireSession();
    const unlinked = await db.prospect.findMany({
      where: { orgId: session.orgId, accountId: null },
    });
    if (unlinked.length === 0) {
      return { ok: false, error: "All contacts are already linked to accounts." };
    }

    const byCompany = new Map<string, typeof unlinked>();
    for (const p of unlinked) {
      const key = p.company.trim();
      if (!key) continue;
      byCompany.set(key, [...(byCompany.get(key) ?? []), p]);
    }

    let created = 0;
    let linked = 0;
    const newAccountIds: string[] = [];

    for (const [company, contacts] of byCompany) {
      const first = contacts[0];
      let account = await db.account.findUnique({
        where: { orgId_name: { orgId: session.orgId, name: company } },
      });
      if (!account) {
        account = await db.account.create({
          data: {
            orgId: session.orgId,
            name: company,
            domain: first.website?.replace(/^https?:\/\//, "").split("/")[0] ?? null,
            industry: first.industry,
            companySize: first.companySize,
            region: first.country,
            source: "imported",
            verified: true,
          },
        });
        created += 1;
        newAccountIds.push(account.id);
      }
      const { count } = await db.prospect.updateMany({
        where: { id: { in: contacts.map((c) => c.id) } },
        data: { accountId: account.id },
      });
      linked += count;
    }

    // Agent follow-up work for each new account (respects autonomy mode).
    let queued = 0;
    for (const accountId of newAccountIds) {
      const account = await db.account.findUnique({ where: { id: accountId } });
      if (!account) continue;
      await createAgentAction(session, {
        type: "research_account",
        title: `Research ${account.name}`,
        detail: "Build an account brief: summary, pain hypotheses, recommended angle.",
        accountId,
        requestedBy: "agent",
      });
      await createAgentAction(session, {
        type: "score_account",
        title: `Score ${account.name} against your ICP`,
        detail: "Explainable fit + intent scoring.",
        accountId,
        requestedBy: "agent",
      });
      queued += 2;
    }

    revalidateAccounts();
    return { ok: true, data: { created, linked, queued } };
  } catch (err) {
    return actionError(err, "Import failed part-way — refresh and retry.");
  }
}

/** Explicit user click: research one account right now. */
export async function researchAccountNow(accountId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const account = await db.account.findFirst({
      where: { id: accountId, orgId: session.orgId },
    });
    if (!account) return { ok: false, error: "Account not found." };
    const action = await createAgentAction(session, {
      type: "research_account",
      title: `Research ${account.name}`,
      accountId,
      executeNow: true,
    });
    revalidateAccounts(accountId);
    if (action.status === "FAILED") {
      return { ok: false, error: action.error ?? "Research failed." };
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Research failed. Please try again.");
  }
}

/** Explicit user click: score one account right now. */
export async function scoreAccountNow(accountId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const account = await db.account.findFirst({
      where: { id: accountId, orgId: session.orgId },
    });
    if (!account) return { ok: false, error: "Account not found." };
    const action = await createAgentAction(session, {
      type: "score_account",
      title: `Score ${account.name} against your ICP`,
      accountId,
      executeNow: true,
    });
    revalidateAccounts(accountId);
    if (action.status === "FAILED") {
      return { ok: false, error: action.error ?? "Scoring failed." };
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Scoring failed. Please try again.");
  }
}

export async function deleteAccount(accountId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const { count } = await db.account.deleteMany({
      where: { id: accountId, orgId: session.orgId },
    });
    if (count === 0) return { ok: false, error: "Account not found." };
    revalidateAccounts();
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not delete the account.");
  }
}
