import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, resolvePlanId } from "@/lib/billing";
import { db } from "@/lib/db";

/**
 * Stripe webhook: keeps subscription state in sync with reality.
 * Configure the endpoint in Stripe → Developers → Webhooks pointing at
 * /api/webhooks/stripe with events:
 *   checkout.session.completed, customer.subscription.updated,
 *   customer.subscription.deleted, invoice.paid, invoice.payment_failed
 * and set STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch (err) {
    console.error("[stripe] webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.metadata?.orgId;
        const plan = session.metadata?.plan;
        const interval = session.metadata?.interval;
        if (!orgId || !plan) break;
        await db.organization.update({
          where: { id: orgId },
          data: {
            plan: resolvePlanId(plan),
            planInterval: interval ?? "month",
            // Checkout opens on a trial (see startCheckout), so the org is
            // trialing until Stripe reports the first successful charge.
            planStatus: session.metadata?.trial === "true" ? "trialing" : "active",
            stripeCustomerId:
              typeof session.customer === "string" ? session.customer : undefined,
            stripeSubscriptionId:
              typeof session.subscription === "string"
                ? session.subscription
                : undefined,
          },
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;
        const renewsAt = sub.items.data[0]?.current_period_end;
        await db.organization.update({
          where: { id: orgId },
          data: {
            plan: sub.metadata?.plan
              ? resolvePlanId(sub.metadata.plan)
              : undefined,
            planInterval: sub.metadata?.interval ?? undefined,
            // "trialing" is kept distinct from "active": planOf() meters a
            // trial against TRIAL_LIMITS, so collapsing the two would hand
            // every trial the full paid allowance.
            planStatus: sub.cancel_at_period_end
              ? "canceled"
              : sub.status === "trialing"
                ? "trialing"
                : sub.status === "active"
                  ? "active"
                  : sub.status === "past_due"
                    ? "past_due"
                    : "canceled",
            planRenewsAt: renewsAt ? new Date(renewsAt * 1000) : null,
          },
        });
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object;
        // Stripe also creates a zero-dollar invoice at the beginning of a
        // trial. Only a real successful charge should move the workspace from
        // trialing to active.
        if (invoice.amount_paid <= 0) break;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const periodEnd = invoice.lines.data[0]?.period?.end;
        await db.organization.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            planStatus: "active",
            planRenewsAt: periodEnd ? new Date(periodEnd * 1000) : undefined,
          },
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        await db.organization.updateMany({
          where: { stripeCustomerId: customerId },
          data: { planStatus: "past_due" },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;
        await db.organization.update({
          where: { id: orgId },
          data: {
            plan: "free",
            planInterval: null,
            planStatus: null,
            planRenewsAt: null,
            stripeSubscriptionId: null,
          },
        });
        break;
      }
    }
  } catch (err) {
    console.error(`[stripe] failed to handle ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
