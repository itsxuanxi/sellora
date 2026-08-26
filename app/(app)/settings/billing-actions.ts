"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  formatPrice,
  getStripe,
  PLANS,
  type BillingInterval,
  type PlanId,
} from "@/lib/billing";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Starts a subscription upgrade. With Stripe configured this redirects to
 * Stripe Checkout (real payment); without it the plan is activated directly
 * in dev mode so the full billing loop stays testable.
 */
export async function startCheckout(
  planId: Exclude<PlanId, "free">,
  interval: BillingInterval
): Promise<ActionResult<{ simulated: boolean }>> {
  const plan = PLANS[planId];
  if (!plan || plan.id === "free") {
    return { ok: false, error: "Unknown plan." };
  }

  let checkoutUrl: string | null = null;
  try {
    const session = await requireSession();
    const org = session.org;
    const stripe = getStripe();

    if (!stripe) {
      // Dev mode: activate immediately, clearly marked as simulated.
      const renewsAt = new Date();
      if (interval === "year") renewsAt.setFullYear(renewsAt.getFullYear() + 1);
      else renewsAt.setMonth(renewsAt.getMonth() + 1);
      await db.organization.update({
        where: { id: org.id },
        data: {
          plan: plan.id,
          planInterval: interval,
          planStatus: "active",
          planRenewsAt: renewsAt,
          stripeSubscriptionId: `sim_${Date.now().toString(36)}`,
        },
      });
      revalidatePath("/settings");
      return { ok: true, data: { simulated: true } };
    }

    // Reuse the Stripe customer across upgrades.
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.email ?? undefined,
        name: org.name,
        metadata: { orgId: org.id },
      });
      customerId = customer.id;
      await db.organization.update({
        where: { id: org.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const amount = interval === "year" ? plan.yearlyCents : plan.monthlyCents;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            recurring: { interval },
            product_data: {
              name: `Sellora ${plan.name}`,
              description: `${plan.name} plan · ${formatPrice(amount)}/${interval}`,
            },
          },
        },
      ],
      success_url: `${appUrl()}/settings?tab=billing&checkout=success`,
      cancel_url: `${appUrl()}/settings?tab=billing&checkout=canceled`,
      metadata: { orgId: org.id, plan: plan.id, interval },
      subscription_data: { metadata: { orgId: org.id, plan: plan.id, interval } },
    });
    checkoutUrl = checkout.url;
  } catch (err) {
    return actionError(err, "Could not start checkout. Please try again.");
  }

  if (checkoutUrl) redirect(checkoutUrl);
  return { ok: false, error: "Stripe did not return a checkout link." };
}

/** Cancels at period end on Stripe, or immediately in dev mode. */
export async function cancelSubscription(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const org = session.org;
    if (org.plan === "free" || !org.stripeSubscriptionId) {
      return { ok: false, error: "There's no active subscription to cancel." };
    }

    const stripe = getStripe();
    if (stripe && !org.stripeSubscriptionId.startsWith("sim_")) {
      await stripe.subscriptions.update(org.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      await db.organization.update({
        where: { id: org.id },
        data: { planStatus: "canceled" },
      });
    } else {
      await db.organization.update({
        where: { id: org.id },
        data: {
          plan: "free",
          planInterval: null,
          planStatus: null,
          planRenewsAt: null,
          stripeSubscriptionId: null,
        },
      });
    }
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not cancel the subscription. Please try again.");
  }
}
