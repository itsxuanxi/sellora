"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  formatPrice,
  getStripe,
  PLANS,
  type BillingInterval,
} from "@/lib/billing";
import type { PaidPlanId } from "@/lib/pricing";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Starts a subscription upgrade. With Stripe configured this redirects to
 * Stripe Checkout (real payment); without it the plan is activated directly
 * in dev mode so the full billing loop stays testable.
 *
 * There is no trial here any more. Evaluation happens on the standing Free
 * plan, which needs no card at all, so by the time anyone reaches this action
 * they have already decided to pay and the first charge is immediate. Stripe
 * hosts the card form and keeps card data out of Selryn.
 *
 * Scale is intentionally unreachable here: it is quoted, not bought, so its
 * CTA goes to sales and there is no self-serve path that could charge a
 * figure nobody agreed to.
 */
export async function startCheckout(
  planId: PaidPlanId,
  interval: BillingInterval
): Promise<ActionResult<{ simulated: boolean }>> {
  const plan = PLANS[planId];
  if (!plan || !plan.selfServe) {
    return { ok: false, error: "That plan isn't available for self-serve checkout." };
  }

  let checkoutUrl: string | null = null;
  try {
    const session = await requireSession();
    const org = session.org;
    const stripe = getStripe();

    if (org.isSample) {
      return {
        ok: false,
        error: "Create a real workspace before starting a paid subscription.",
      };
    }

    if (
      org.stripeSubscriptionId &&
      !org.stripeSubscriptionId.startsWith("sim_")
    ) {
      return {
        ok: false,
        error: "You already have a Stripe subscription. Use Manage card & invoices instead.",
      };
    }

    if (!stripe) {
      // Dev mode: activate the same subscription Stripe would, clearly marked
      // simulated, so plan limits and the billing UI are exercised without
      // payment keys.
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
      // Stripe's `card` method accepts eligible debit and credit cards. Stripe
      // Checkout also handles 3DS/SCA authentication without card data ever
      // touching Selryn's servers.
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            recurring: { interval },
            product_data: {
              name: `Selryn ${plan.name}`,
              description: `${plan.name} plan · ${formatPrice(amount)}/${interval}`,
            },
          },
        },
      ],
      payment_method_collection: "always",
      success_url: `${appUrl()}/settings?tab=billing&checkout=success`,
      cancel_url: `${appUrl()}/settings?tab=billing&checkout=canceled`,
      metadata: { orgId: org.id, plan: plan.id, interval },
      subscription_data: {
        metadata: { orgId: org.id, plan: plan.id, interval },
      },
    });
    checkoutUrl = checkout.url;
  } catch (err) {
    return actionError(err, "Could not start checkout. Please try again.");
  }

  if (checkoutUrl) redirect(checkoutUrl);
  return { ok: false, error: "Stripe did not return a checkout link." };
}

/** Opens Stripe's hosted portal for cards, invoices, and cancellation. */
export async function openBillingPortal(): Promise<ActionResult> {
  let portalUrl: string | null = null;
  try {
    const session = await requireSession();
    const org = session.org;
    const stripe = getStripe();

    if (org.isSample) {
      return { ok: false, error: "Billing is disabled in the sample workspace." };
    }
    if (!stripe || !org.stripeCustomerId) {
      return { ok: false, error: "No Stripe billing account is available yet." };
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${appUrl()}/settings?tab=billing`,
    });
    portalUrl = portal.url;
  } catch (err) {
    return actionError(err, "Could not open billing management. Please try again.");
  }

  if (portalUrl) redirect(portalUrl);
  return { ok: false, error: "Stripe did not return a billing portal link." };
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
      const subscription = await stripe.subscriptions.update(org.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      const periodEnd = subscription.items.data[0]?.current_period_end;
      await db.organization.update({
        where: { id: org.id },
        data: {
          planStatus: "canceled",
          planRenewsAt: periodEnd ? new Date(periodEnd * 1000) : org.planRenewsAt,
        },
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
