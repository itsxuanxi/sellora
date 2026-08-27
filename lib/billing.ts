import "server-only";
import Stripe from "stripe";
import type { Organization } from "@prisma/client";
import { db } from "@/lib/db";
import {
  PLAN_TIERS,
  TRIAL_DAYS,
  type PaidPlanId,
  type PlanId,
} from "@/lib/pricing";

/**
 * Subscription billing via Stripe Checkout. Prices are created inline
 * (price_data) so no Stripe dashboard setup is needed beyond API keys.
 * Without STRIPE_SECRET_KEY the upgrade flow activates the plan directly in
 * dev mode ("sim_" ids, no payment) so the product remains fully testable.
 *
 * The amounts are NOT declared here. They come from lib/pricing.ts, the same
 * module the marketing pricing screen renders from, so the published price and
 * the charged price are one value with one definition. Changing a price is a
 * one-line edit there that moves the card and the invoice together.
 */

export type { PlanId, PaidPlanId };
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
  /** buyable without a sales conversation */
  selfServe: boolean;
  limits: PlanLimits;
}

/**
 * Enforceable limits per plan. These are the counters the app actually meters:
 * `prospects` is what the pricing page calls active opportunities, and
 * `emailsPerMonth` is what it calls AI actions per month — the numbers match
 * the published ones. Seats and data connections appear on the pricing page
 * but are not metered yet (orgs are single-tenant today), so they are stated
 * there and deliberately absent here rather than faked with a limit nothing
 * checks.
 */
const LIMITS: Record<PlanId, PlanLimits> = {
  // Not sold — the state an org sits in before it subscribes and after a
  // subscription ends. Small enough to evaluate with, not to operate on.
  free: { prospects: 25, emailsPerMonth: 50, campaigns: 1 },
  starter: { prospects: 1000, emailsPerMonth: 5000, campaigns: 3 },
  growth: { prospects: 10000, emailsPerMonth: 30000, campaigns: Infinity },
  // Sized per contract; the record keeps a permissive default so a manually
  // provisioned org is never blocked by a limit nobody agreed to.
  enterprise: {
    prospects: Infinity,
    emailsPerMonth: Infinity,
    campaigns: Infinity,
  },
};

/**
 * What a Starter or Growth trial actually grants. Full product access, capped
 * below the paid tiers so a trial cannot be run as a free production account.
 * Not advertised on the pricing page: the promise there is 14 days of full
 * access, and quoting caps would turn that into a credits conversation.
 */
export const TRIAL_LIMITS: PlanLimits = {
  prospects: 500,
  emailsPerMonth: 2000,
  campaigns: 2,
};

export { TRIAL_DAYS };

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    monthlyCents: 0,
    yearlyCents: 0,
    selfServe: false,
    limits: LIMITS.free,
  },
  ...Object.fromEntries(
    PLAN_TIERS.map((tier) => [
      tier.id,
      {
        id: tier.id,
        name: tier.name,
        monthlyCents: tier.monthlyCents,
        yearlyCents: tier.yearlyCents,
        selfServe: tier.selfServe,
        limits: LIMITS[tier.id],
      } satisfies PlanDef,
    ])
  ),
} as Record<PlanId, PlanDef>;

/**
 * Plan ids stored before the Starter/Growth/Enterprise rename. Orgs still
 * carrying them keep working and are read as their successor tier rather than
 * silently dropping to Free limits, which is what an unknown id would do.
 */
const LEGACY_PLAN_IDS: Record<string, PlanId> = {
  pro: "starter",
  max: "growth",
};

/** Normalises a stored `Organization.plan` string to a current plan id. */
export function resolvePlanId(stored: string): PlanId {
  if (stored in PLANS) return stored as PlanId;
  return LEGACY_PLAN_IDS[stored] ?? "free";
}

export const isStripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

/**
 * The plan an org is actually operating under right now — which is not always
 * the plan it is nominally on. A canceled subscription falls back to Free, and
 * a trial keeps the plan's name and price while metering against TRIAL_LIMITS.
 */
export function planOf(org: Organization): PlanDef {
  const planId = resolvePlanId(org.plan);
  const plan = PLANS[planId];

  // Expired/canceled subscriptions fall back to free limits.
  if (planId !== "free" && org.planStatus === "canceled") {
    return PLANS.free;
  }

  if (org.planStatus === "trialing" && plan.selfServe) {
    return { ...plan, limits: TRIAL_LIMITS };
  }

  return plan;
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
    const scope = org.planStatus === "trialing" ? `${plan.name} trial` : `${plan.name} plan`;
    return `You've reached the ${scope} limit of ${limit} ${noun}. Upgrade in Settings → Billing to continue.`;
  }
  return null;
}
