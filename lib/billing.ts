import "server-only";
import Stripe from "stripe";
import type { Organization } from "@prisma/client";
import { db } from "@/lib/db";
import {
  FREE_PLAN,
  PLAN_TIERS,
  type PaidPlanId,
  type PlanId,
  type PlanLimitSpec,
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
 * the published ones. Seats and data connections are not metered at all, which
 * is why the pricing page now states them as unlimited rather than printing a
 * per-plan count nothing here ever checked.
 *
 * The published figures used to be 1,000 and 10,000 opportunities. Nothing in
 * the target market tracks that many, so the meter never fired and a Starter
 * customer had no reason to ever become a Pro one — the pricing had no
 * expansion path at all. The numbers below are set where a growing team
 * actually crosses them.
 *
 * `emailsPerMonth` also bounds real model spend: an AI action is an OpenAI
 * call, so a generous-sounding 30,000 was a promise that would have cost more
 * to honour than the plan charged.
 */
/** `null` on a PlanLimitSpec means unlimited, which meters as Infinity. */
const cap = (n: number | null): number => n ?? Infinity;

/** Campaign ceilings are not published, so they stay local to enforcement. */
const CAMPAIGN_LIMITS: Record<PlanId, number> = {
  free: 1,
  starter: 3,
  growth: Infinity,
  enterprise: Infinity,
};

const specOf = (id: PlanId): PlanLimitSpec =>
  id === "free"
    ? FREE_PLAN.limits
    : (PLAN_TIERS.find((t) => t.id === id)?.limits ?? {
        opportunities: null,
        aiActions: null,
      });

const LIMITS: Record<PlanId, PlanLimits> = Object.fromEntries(
  (["free", "starter", "growth", "enterprise"] as PlanId[]).map((id) => {
    const spec = specOf(id);
    return [
      id,
      {
        prospects: cap(spec.opportunities),
        emailsPerMonth: cap(spec.aiActions),
        campaigns: CAMPAIGN_LIMITS[id],
      } satisfies PlanLimits,
    ];
  })
) as Record<PlanId, PlanLimits>;

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

/**
 * Whether this deployment charges real money.
 *
 * Derived from the key's documented prefix, never from the key itself, so
 * the answer can be shown in the UI without the secret going anywhere near
 * a client bundle.
 *
 * It needs showing. A test key in production is the worst of the three
 * states this can be in: checkout succeeds, Stripe returns a subscription,
 * the webhook fires, the workspace flips to active, the customer sees a
 * receipt-shaped confirmation — and no money moves. Everything downstream
 * reports success, so nothing surfaces the problem until someone reconciles
 * a bank statement. "Stripe is configured" is not the same claim as
 * "customers are being billed", and the product should not conflate them.
 */
export function isStripeLive(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
}

/** What the billing UI should say about the mode it is running in. */
export type BillingMode = "live" | "test" | "unconfigured";

export function billingMode(): BillingMode {
  if (!process.env.STRIPE_SECRET_KEY) return "unconfigured";
  return isStripeLive() ? "live" : "test";
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  // No apiVersion passed on purpose: stripe-node sends its own pinned version
  // (`ApiVersion` in the package) rather than the account default, so the wire
  // version moves only when the dependency is upgraded. Writing it here again
  // would create a second place to keep in step with the first.
  return key ? new Stripe(key) : null;
}

/**
 * A Stripe Price id for a plan and interval, when the account has one.
 *
 * Optional by design. Without one, checkout builds the line item inline from
 * `lib/pricing.ts` and nothing needs configuring in the Stripe dashboard,
 * which is what makes the product runnable from a clean account. The cost of
 * that is one ad-hoc Product per Checkout Session: Stripe creates a new
 * product whenever `price_data.product_data` is used, so a dashboard with a
 * hundred subscribers has a hundred near-identical products and revenue
 * cannot be grouped by plan.
 *
 * Setting the four variables below switches to real Prices and fixes that,
 * without changing anything else:
 *
 *   STRIPE_PRICE_STARTER_MONTHLY   STRIPE_PRICE_STARTER_YEARLY
 *   STRIPE_PRICE_GROWTH_MONTHLY    STRIPE_PRICE_GROWTH_YEARLY
 *
 * ("growth" is the stored id of the plan displayed as Pro — see PaidPlanId.)
 */
export function priceIdFor(
  planId: PaidPlanId,
  interval: BillingInterval,
  // A plain record rather than NodeJS.ProcessEnv so a test can pass the four
  // variables it cares about instead of a whole environment.
  env: Record<string, string | undefined> = process.env
): string | null {
  const key = `STRIPE_PRICE_${planId.toUpperCase()}_${
    interval === "year" ? "YEARLY" : "MONTHLY"
  }`;
  const value = env[key]?.trim();
  return value ? value : null;
}

/**
 * Whether a configured Stripe Price still agrees with the published one.
 *
 * The whole point of lib/pricing.ts is that the number on the marketing page
 * and the number on the invoice have one definition. A Price id configured in
 * Stripe is a second definition, editable by anyone with dashboard access and
 * invisible from here — so it is checked before it is charged, and a
 * disagreement refuses the checkout instead of billing a figure the customer
 * was never shown.
 */
export function priceMatchesPublished(
  price: { unit_amount: number | null; currency: string; recurring: { interval: string } | null },
  expected: { cents: number; interval: BillingInterval }
): { ok: true } | { ok: false; reason: string } {
  if (price.unit_amount !== expected.cents) {
    return {
      ok: false,
      reason: `Stripe has ${price.unit_amount ?? "no"} cents for this price and Selryn publishes ${expected.cents}`,
    };
  }
  if (price.currency !== "usd") {
    return { ok: false, reason: `Stripe has this price in ${price.currency}, not usd` };
  }
  if (price.recurring?.interval !== expected.interval) {
    return {
      ok: false,
      reason: `Stripe bills this price every ${price.recurring?.interval ?? "once"}, not every ${expected.interval}`,
    };
  }
  return { ok: true };
}

/**
 * Whether a subscription event is about the subscription this org is on.
 *
 * Stripe delivers at least once and does not promise order. The case that
 * actually bites: a customer cancels and re-subscribes, and the older
 * `customer.subscription.deleted` lands after the newer checkout — which
 * would set a paying workspace back to Free. An org with no subscription id
 * recorded yet accepts the event, because that is the first one arriving.
 */
export function eventIsCurrentSubscription(
  storedSubscriptionId: string | null,
  eventSubscriptionId: string
): boolean {
  if (!storedSubscriptionId) return true;
  if (storedSubscriptionId.startsWith("sim_")) return true;
  return storedSubscriptionId === eventSubscriptionId;
}

/**
 * The plan an org is actually operating under right now — which is not always
 * the plan it is nominally on: a canceled subscription falls back to Free.
 *
 * There is no longer a trial state to resolve. Signup lands on the standing
 * Free plan, so an org is either paying or on Free, and `planStatus` only ever
 * distinguishes active from canceled.
 */
export function planOf(org: Organization): PlanDef {
  const planId = resolvePlanId(org.plan);
  const plan = PLANS[planId];

  // A cancel-at-period-end subscription keeps paid access through the date
  // Stripe already charged for. The deletion webhook clears the plan when
  // that date arrives; this time check is a safe fallback if it is delayed.
  if (
    planId !== "free" &&
    org.planStatus === "canceled" &&
    (!org.planRenewsAt || org.planRenewsAt <= new Date())
  ) {
    return PLANS.free;
  }

  // An org left on a legacy "trialing" status from the old card-required
  // trial keeps the plan it paid for. There is nothing to downgrade it to:
  // the trial-specific limits are gone, and a trialing org was always one
  // that had already entered a card.
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
    const scope = `${plan.name} plan`;
    return `You've reached the ${scope} limit of ${limit} ${noun}. Upgrade in Settings → Billing to continue.`;
  }
  return null;
}
