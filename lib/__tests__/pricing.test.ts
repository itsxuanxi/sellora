import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FREE_PLAN,
  PLAN_TIERS,
  YEARLY_SAVING_PERCENT,
  allowanceLabel,
  capacityLabel,
  displayPrice,
} from "@/lib/pricing";

// The pricing page makes arithmetic promises to a buyer and lib/billing.ts
// charges a card against the same constants. These guard the promises.
//
// lib/billing.ts itself is server-only and pulls in Prisma, so the enforcement
// side is not asserted here. It no longer needs to be: LIMITS is built from
// PLAN_TIERS and FREE_PLAN rather than typed a second time, so there is only
// one set of numbers left to be wrong.

test("annual is exactly two months free on every self-serve plan", () => {
  // The old Enterprise tier was 12 x the monthly price while the other two
  // were ~17% off, which reads as a pricing bug on a page whose whole job is
  // to look considered.
  for (const tier of PLAN_TIERS) {
    if (!tier.selfServe) continue;
    assert.equal(
      tier.yearlyCents,
      tier.monthlyCents * 10,
      `${tier.name} annual is not ten months of its monthly price`
    );
  }
  assert.equal(YEARLY_SAVING_PERCENT, 17);
});

test("a quoted plan publishes no figure at all", () => {
  // Printing a floor on a tier with no customers caps the ceiling forever.
  for (const tier of PLAN_TIERS) {
    if (!tier.customPrice) continue;
    assert.equal(tier.monthlyCents, 0);
    assert.equal(tier.yearlyCents, 0);
    assert.equal(tier.selfServe, false, `${tier.name} must not be self-serve`);

    for (const cycle of ["monthly", "yearly"] as const) {
      const shown = displayPrice(tier, cycle);
      assert.equal(shown.amount, "Custom");
      assert.match(
        `${shown.amount}${shown.period}${shown.note ?? ""}`,
        /^[^0-9]*$/,
        `${tier.name} leaks a number onto the page`
      );
    }
  }
});

test("capacity rises strictly from Free through to the top plan", () => {
  // A ladder only creates an upgrade path if every rung is higher than the
  // one below it. The figures this replaced (1,000 then 10,000 opportunities)
  // were above anything the target market tracks, so the meter never fired
  // and a Starter customer had no reason to ever become a Pro one.
  const rungs = [FREE_PLAN.limits, ...PLAN_TIERS.map((t) => t.limits)];

  for (let i = 1; i < rungs.length; i++) {
    const below = rungs[i - 1];
    const here = rungs[i];
    for (const key of ["opportunities", "aiActions"] as const) {
      if (here[key] === null) continue; // unlimited tops the ladder
      assert.notEqual(below[key], null, `unlimited ${key} appears below rung ${i}`);
      assert.ok(
        here[key]! > below[key]!,
        `rung ${i} does not raise ${key} above ${below[key]}`
      );
    }
  }

  // Only the last rung may be unlimited.
  const unlimited = rungs.findIndex((r) => r.opportunities === null);
  if (unlimited !== -1) assert.equal(unlimited, rungs.length - 1);
});

test("every published capacity string comes from the enforced number", () => {
  // The display strings used to be hand-typed beside the integers, which is
  // how a card ends up quoting a limit the app does not enforce.
  for (const tier of PLAN_TIERS) {
    const { opportunities, aiActions } = tier.limits;

    assert.equal(
      capacityLabel(opportunities),
      opportunities === null ? "Unlimited" : opportunities.toLocaleString("en-US")
    );
    if (aiActions !== null) {
      assert.ok(
        allowanceLabel(aiActions).includes(aiActions.toLocaleString("en-US")),
        `${tier.name}'s allowance line omits its own number`
      );
    }
  }
});

test("the free plan's summary quotes its own limits", () => {
  // The sentence a visitor reads and the ceiling they hit must agree.
  for (const limit of [FREE_PLAN.limits.opportunities, FREE_PLAN.limits.aiActions]) {
    assert.ok(
      FREE_PLAN.summary.includes(capacityLabel(limit)),
      `the free summary does not mention ${limit}`
    );
  }
});

test("exactly one plan is the recommended one", () => {
  assert.equal(PLAN_TIERS.filter((t) => t.mostPopular).length, 1);
});

test("nothing on the page starts a clock or asks for a card", () => {
  // Evaluation happens on a standing free plan. A countdown is the wrong shape
  // for a product whose value arrives when a prospect replies, days later.
  const copy = [
    FREE_PLAN.cta,
    FREE_PLAN.note,
    FREE_PLAN.summary,
    ...PLAN_TIERS.flatMap((t) => [t.cta.label, t.ctaNote, t.audience]),
  ]
    .join(" ")
    .toLowerCase();

  for (const banned of ["trial", "card required", "days left", "expires"]) {
    assert.ok(!copy.includes(banned), `pricing copy still says "${banned}"`);
  }
});
