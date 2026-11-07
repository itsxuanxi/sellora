import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  eventIsCurrentSubscription,
  getStripe,
  resolvePlanId,
} from "@/lib/billing";
import { db } from "@/lib/db";

/**
 * Stripe webhook: keeps subscription state in sync with reality.
 * Configure the endpoint in Stripe → Developers → Webhooks pointing at
 * /api/webhooks/stripe with events:
 *   checkout.session.completed, customer.subscription.updated,
 *   customer.subscription.deleted, invoice.paid, invoice.payment_failed
 * and set STRIPE_WEBHOOK_SECRET.
 *
 * ── Delivery is at-least-once and unordered ──
 *
 * Both of those are Stripe's documented behaviour and both can downgrade a
 * paying workspace if the handler assumes otherwise. The two guards here:
 *
 *  1. A subscription event is ignored unless it is about the subscription
 *     this org is currently on. The case that bites is a customer who
 *     cancels and re-subscribes: the older `deleted` can arrive after the
 *     newer checkout, and without this it sets them back to Free while their
 *     card is being charged.
 *
 *  2. `customer.subscription.updated` re-reads the subscription from Stripe
 *     instead of trusting the payload it arrived with. A webhook body is a
 *     snapshot of the moment the event was created; two of them delivered out
 *     of order write the older state last. Re-reading makes order irrelevant,
 *     at the cost of one API call on an uncommon event.
 *
 * The request body must be read as raw text for signature verification —
 * `await req.text()` below, which in the App Router is the unparsed body.
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
            // Checkout no longer opens on a trial — evaluation happens on the
            // Free plan — so a completed session is a paying subscription.
            planStatus: "active",
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
        const stale = event.data.object;
        const orgId = stale.metadata?.orgId;
        if (!orgId) break;

        const org = await db.organization.findUnique({
          where: { id: orgId },
          select: { stripeSubscriptionId: true },
        });
        if (!org) break;
        if (!eventIsCurrentSubscription(org.stripeSubscriptionId, stale.id)) {
          console.info(
            `[stripe] ignoring update for ${stale.id}; org ${orgId} is on ${org.stripeSubscriptionId}`
          );
          break;
        }

        // Current state, not the state at the moment the event was created.
        const sub = await stripe.subscriptions.retrieve(stale.id);
        const renewsAt = sub.items.data[0]?.current_period_end;
        await db.organization.update({
          where: { id: orgId },
          data: {
            plan: sub.metadata?.plan
              ? resolvePlanId(sub.metadata.plan)
              : undefined,
            planInterval: sub.metadata?.interval ?? undefined,
            // Stripe can still report "trialing" for a subscription created
            // under the old card-required trial. Those orgs entered a card and
            // will be charged, and there are no trial-specific limits left to
            // meter them against, so they read as active.
            planStatus: sub.cancel_at_period_end
              ? "canceled"
              : sub.status === "trialing" || sub.status === "active"
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
        // Stripe issues zero-dollar invoices for prorations and full-discount
        // periods. Only a real successful charge should confirm a workspace as
        // paying.
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

        // The dangerous one. A delayed deletion for a subscription the org has
        // already replaced would cancel a live, paid plan.
        const org = await db.organization.findUnique({
          where: { id: orgId },
          select: { stripeSubscriptionId: true },
        });
        if (!org) break;
        if (!eventIsCurrentSubscription(org.stripeSubscriptionId, sub.id)) {
          console.info(
            `[stripe] ignoring deletion of ${sub.id}; org ${orgId} is on ${org.stripeSubscriptionId}`
          );
          break;
        }

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
