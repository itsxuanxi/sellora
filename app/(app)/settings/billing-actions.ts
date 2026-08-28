"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  formatPrice,
  getStripe,
  PLANS,
  TRIAL_DAYS,
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
 * Every subscription opens on a TRIAL_DAYS free trial with no card collected,
 * which is what makes the pricing page's "14-day free trial · No credit card
 * required" a description of the flow rather than a claim about it. Stripe
 * only asks for a card when the trial ends.
 *
 * Enterprise is intentionally unreachable here: it is quoted, not bought, so
 * its CTA goes to sales and there is no self-serve path that could charge the
 * "starting at" floor as if it were the price.
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

    if (!stripe) {
      // Dev mode: start the same trial Stripe would, clearly marked simulated,
      // so trial limits and the trial UI are exercised without payment keys.
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
      await db.organization.update({
        where: { id: org.id },
        data: {
          plan: plan.id,
          planInterval: interval,
          planStatus: "trialing",
          planRenewsAt: trialEndsAt,
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
              name: `Selryn ${plan.name}`,
              description: `${plan.name} plan · ${formatPrice(amount)}/${interval}`,
            },
          },
        },
      ],
      // No card up front — Stripe collects one only when the trial converts.
      payment_method_collection: "if_required",
      success_url: `${appUrl()}/settings?tab=billing&checkout=success`,
      cancel_url: `${appUrl()}/settings?tab=billing&checkout=canceled`,
      metadata: { orgId: org.id, plan: plan.id, interval, trial: "true" },
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        // Required whenever payment_method_collection is "if_required": it
        // tells Stripe what to do when the trial ends and no card was ever
        // given. Cancelling is the only ending consistent with promising no
        // credit card — the alternatives invoice or pause an account that
        // never agreed to pay.
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
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
