import "server-only";
import Stripe from "stripe";
import type { Organization } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Subscription billing via Stripe Checkout. Prices are created inline
 * (price_data) so no Stripe dashboard setup is needed beyond API keys.
 * Without STRIPE_SECRET_KEY the upgrade flow activates the plan directly in
 * dev mode ("sim_" ids, no payment) so the product remains fully testable.
 */

export type PlanId = "free" | "pro" | "max";
export type BillingInterval = "month" | "year";

export interface PlanLimits {
  prospects: number;
  emailsPerMonth: number;
  campaigns: number;
}

export interface PlanDef {
  id: PlanId;
  name: string;
  monthlyCents: number;
  yearlyCents: number;
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    monthlyCents: 0,
    yearlyCents: 0,
    limits: { prospects: 25, emailsPerMonth: 50, campaigns: 1 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyCents: 1999,
    yearlyCents: 19999,
    limits: { prospects: 500, emailsPerMonth: 1000, campaigns: 2 },
  },
  max: {
    id: "max",
    name: "Max",
    monthlyCents: 3999,
    yearlyCents: 39999,
    limits: { prospects: 5000, emailsPerMonth: 10000, campaigns: Infinity },
  },
};

export const isStripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

export function planOf(org: Organization): PlanDef {
  const plan = PLANS[org.plan as PlanId];
  // Expired/canceled subscriptions fall back to free limits.
  if (!plan || (org.plan !== "free" && org.planStatus === "canceled")) {
    return PLANS.free;
  }
  return plan ?? PLANS.free;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Checks a plan limit before creating a resource. Returns an error string or null. */
export async function checkPlanLimit(
  org: Organization,
  kind: keyof PlanLimits
): Promise<string | null> {
  const plan = planOf(org);
  const limit = plan.limits[kind];
  if (!Number.isFinite(limit)) return null;

  let current = 0;
  if (kind === "prospects") {
    current = await db.prospect.count({ where: { orgId: org.id } });
  } else if (kind === "campaigns") {
    current = await db.campaign.count({ where: { orgId: org.id } });
  } else {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [emails, followUps] = await Promise.all([
      db.email.count({ where: { orgId: org.id, sentAt: { gte: monthStart } } }),
      db.followUp.count({
        where: { email: { orgId: org.id }, sentAt: { gte: monthStart } },
      }),
    ]);
    current = emails + followUps;
  }

  if (current >= limit) {
    const noun =
      kind === "prospects"
        ? "prospects"
        : kind === "campaigns"
          ? "campaigns"
          : "emails this month";
    return `You've reached the ${plan.name} plan limit of ${limit} ${noun}. Upgrade in Settings → Billing to continue.`;
  }
  return null;
}
