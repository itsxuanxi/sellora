import { test } from "node:test";
import assert from "node:assert/strict";
import {
  billingMode,
  eventIsCurrentSubscription,
  isStripeLive,
  priceIdFor,
  priceMatchesPublished,
} from "@/lib/billing";
import { FREE_PLAN, PLAN_TIERS } from "@/lib/pricing";

/**
 * Billing is the one part of the product where a bug takes money, so the
 * parts that can be tested without Stripe are tested here: which price is
 * charged, whether it still agrees with the published one, and which
 * subscription events are allowed to change a plan.
 */

// ── Which price gets charged ──────────────────────────────────────────────

test("a plan uses its configured Stripe Price when the account has one", () => {
  const env = {
    STRIPE_PRICE_STARTER_MONTHLY: "price_starter_m",
    STRIPE_PRICE_STARTER_YEARLY: "price_starter_y",
    STRIPE_PRICE_GROWTH_MONTHLY: "price_growth_m",
  };

  assert.equal(priceIdFor("starter", "month", env), "price_starter_m");
  assert.equal(priceIdFor("starter", "year", env), "price_starter_y");
  assert.equal(priceIdFor("growth", "month", env), "price_growth_m");
  // Not configured: checkout falls back to building the line item inline.
  assert.equal(priceIdFor("growth", "year", env), null);
});

test("an empty or blank variable counts as not configured", () => {
  // A half-filled .env is the normal state of a project mid-setup, and ""
  // passed to Stripe as a price id is a 400 rather than a fallback.
  const env = {
    STRIPE_PRICE_STARTER_MONTHLY: "",
    STRIPE_PRICE_STARTER_YEARLY: "   ",
  };
  assert.equal(priceIdFor("starter", "month", env), null);
  assert.equal(priceIdFor("starter", "year", env), null);
});

test("every self-serve plan and interval has a variable name that can be set", () => {
  // Guards the naming: a plan added to PLAN_TIERS with no corresponding
  // variable would silently never use a configured price.
  const env = Object.fromEntries(
    PLAN_TIERS.filter((t) => t.selfServe).flatMap((t) => [
      [`STRIPE_PRICE_${t.id.toUpperCase()}_MONTHLY`, `price_${t.id}_m`],
      [`STRIPE_PRICE_${t.id.toUpperCase()}_YEARLY`, `price_${t.id}_y`],
    ])
  );

  for (const tier of PLAN_TIERS.filter((t) => t.selfServe)) {
    const id = tier.id as "starter" | "growth";
    assert.ok(priceIdFor(id, "month", env), `${tier.id} monthly has no variable`);
    assert.ok(priceIdFor(id, "year", env), `${tier.id} yearly has no variable`);
  }
});

// ── Published price vs charged price ──────────────────────────────────────

test("a Stripe price that matches the published one is accepted", () => {
  const starter = PLAN_TIERS.find((t) => t.id === "starter")!;
  const result = priceMatchesPublished(
    {
      unit_amount: starter.monthlyCents,
      currency: "usd",
      recurring: { interval: "month" },
    },
    { cents: starter.monthlyCents, interval: "month" }
  );
  assert.equal(result.ok, true);
});

test("a Stripe price edited in the dashboard is refused, not charged", () => {
  // The scenario: someone changes the amount in Stripe and the marketing page
  // keeps showing the old one. Charging it would be the single worst bug this
  // product could have.
  const starter = PLAN_TIERS.find((t) => t.id === "starter")!;
  const result = priceMatchesPublished(
    { unit_amount: starter.monthlyCents + 5000, currency: "usd", recurring: { interval: "month" } },
    { cents: starter.monthlyCents, interval: "month" }
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /cents/);
});

test("a monthly price configured against the yearly slot is refused", () => {
  const starter = PLAN_TIERS.find((t) => t.id === "starter")!;
  const result = priceMatchesPublished(
    { unit_amount: starter.yearlyCents, currency: "usd", recurring: { interval: "month" } },
    { cents: starter.yearlyCents, interval: "year" }
  );
  assert.equal(result.ok, false);
});

test("a price in another currency is refused", () => {
  const result = priceMatchesPublished(
    { unit_amount: 9900, currency: "eur", recurring: { interval: "month" } },
    { cents: 9900, interval: "month" }
  );
  assert.equal(result.ok, false);
});

test("a one-off price in a subscription slot is refused", () => {
  const result = priceMatchesPublished(
    { unit_amount: 9900, currency: "usd", recurring: null },
    { cents: 9900, interval: "month" }
  );
  assert.equal(result.ok, false);
});

// ── Which subscription events may change a plan ───────────────────────────

test("an event about the org's current subscription is accepted", () => {
  assert.equal(eventIsCurrentSubscription("sub_live", "sub_live"), true);
});

test("a late event about a replaced subscription cannot downgrade a payer", () => {
  // Cancel, then re-subscribe. Stripe does not promise order, so the old
  // deletion can land after the new checkout — and acting on it would set a
  // workspace that is being charged back to Free.
  assert.equal(eventIsCurrentSubscription("sub_new", "sub_old"), false);
});

test("the first event for an org with nothing recorded is accepted", () => {
  // Otherwise the very first subscription could never be written.
  assert.equal(eventIsCurrentSubscription(null, "sub_first"), true);
});

test("a simulated dev subscription does not block real Stripe events", () => {
  // Dev mode writes `sim_…` ids with no payment behind them. A real
  // subscription arriving afterwards must be allowed to take over.
  assert.equal(eventIsCurrentSubscription("sim_abc123", "sub_real"), true);
});

// ── Which mode is this deployment in ──────────────────────────────────────

test("a live key is the only thing that counts as charging real money", () => {
  // The dangerous state is a test key in production: checkout succeeds, the
  // webhook fires, the plan flips to active, and nobody is billed. Every
  // signal downstream says "paying customer", so nothing catches it until
  // somebody reads a bank statement. The mode has to be visible.
  const key = process.env.STRIPE_SECRET_KEY;
  try {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc123";
    assert.equal(isStripeLive(), true);
    assert.equal(billingMode(), "live");

    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    assert.equal(isStripeLive(), false, "a test key must never read as live");
    assert.equal(billingMode(), "test");

    delete process.env.STRIPE_SECRET_KEY;
    assert.equal(isStripeLive(), false);
    assert.equal(billingMode(), "unconfigured");
  } finally {
    if (key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = key;
  }
});

test("a restricted or malformed key is not treated as live", () => {
  const key = process.env.STRIPE_SECRET_KEY;
  try {
    for (const candidate of ["rk_live_abc", "pk_live_abc", "", "sk_live", "SK_LIVE_ABC"]) {
      process.env.STRIPE_SECRET_KEY = candidate;
      assert.equal(isStripeLive(), false, `${candidate} should not read as live`);
    }
  } finally {
    if (key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = key;
  }
});

// ── Free really is free ───────────────────────────────────────────────────

test("the free plan is buyable without a card, and says so", () => {
  // Signing up writes an Organization on the free plan and touches Stripe
  // nowhere. The copy is allowed to promise that because no code path leads
  // from sign-up to a payment method.
  assert.match(FREE_PLAN.note, /no card/i);
  assert.ok(!FREE_PLAN.note.toLowerCase().includes("trial"));
});

test("free is not a self-serve checkout tier", () => {
  // startCheckout refuses anything that is not a paid, self-serve plan, so
  // "Start free" can never open Stripe.
  assert.ok(
    !PLAN_TIERS.some((t) => t.id === "free"),
    "free must not appear among the purchasable tiers"
  );
});
