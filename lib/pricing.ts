/**
 * The single source of truth for what Selryn costs.
 *
 * Both the marketing pricing screen (components/marketing/home/pricing.tsx)
 * and the Stripe Checkout amounts (lib/billing.ts) read the cents below, so a
 * published price physically cannot drift from what a card is charged. The
 * file is deliberately free of `server-only` and of any Prisma/Stripe import
 * so the client bundle can use it too.
 *
 * Money is stored once, in cents, per plan — never once per billing cycle.
 * Everything a card shows for a cycle (headline, period, billing note, the
 * "equivalent to $x/month" line) is derived from those two numbers, which is
 * what lets the cycle toggle swap a few strings instead of a whole card.
 *
 * Feature rows carry a `planned` flag rather than being quietly listed. A row
 * marked planned is on the roadmap and is rendered with a visible badge — no
 * security, compliance or integration capability is claimed before it ships.
 *
 * ── One meter, not four ──────────────────────────────────────────────────
 * A plan is chosen on exactly one number: how many opportunities Selryn is
 * actively working. Seats and data connections are unlimited everywhere (see
 * UNIVERSAL_CAPACITY), and the monthly AI-action allowance is stated as an
 * inclusion rather than a limit.
 *
 * That last distinction is deliberate and it is not cosmetic. A buyer cannot
 * estimate how many AI actions they will use, so metering them as a purchase
 * decision buys confusion and then a customer who throttles their own usage
 * to stay under a cap — which is precisely the habit the product needs them
 * to form. The allowance exists to bound cost exposure, not to be shopped.
 */

/**
 * Persisted plan ids. These are written to `Organization.plan` and must not be
 * renamed: `name` below carries the display copy, which is why the two are
 * separate fields.
 *
 * In particular "growth" stays "growth" even though it now displays as "Pro".
 * `pro` is already taken as a LEGACY_PLAN_IDS key in lib/billing.ts, where it
 * maps to Starter — an org stored as "pro" predates this naming and is on the
 * cheaper tier. Promoting "pro" to a live id would silently move every one of
 * those orgs onto the $299 plan, with no way to tell the two apart afterwards.
 */
export type PaidPlanId = "starter" | "growth";
export type PlanId = "free" | PaidPlanId | "enterprise";
export type BillingCycle = "monthly" | "yearly";

export interface PlanFeature {
  label: string;
  /** on the roadmap, not yet shipped — always surfaced as a "Planned" badge */
  planned?: boolean;
}

/**
 * A plan's metered ceilings, as integers. `null` is unlimited.
 *
 * These are the only place the numbers are written down. lib/billing.ts builds
 * its enforced LIMITS from them and the cards below render their display
 * strings from them, so the figure a buyer reads and the figure the app
 * actually enforces cannot drift apart — the same guarantee this file already
 * makes for prices.
 */
export interface PlanLimitSpec {
  opportunities: number | null;
  aiActions: number | null;
}

/** The one number a plan is chosen on, with the sentence that explains it. */
export interface PlanHeadline {
  label: string;
  /** Plain English, set directly under the number. */
  detail: string;
}

/** "150" / "Unlimited" — the headline figure for a plan. */
export function capacityLabel(limit: number | null): string {
  return limit === null ? "Unlimited" : limit.toLocaleString("en-US");
}

/** The quiet allowance line under the headline number. */
export function allowanceLabel(limit: number | null): string {
  return limit === null
    ? "AI actions sized to your volume"
    : `Includes ${limit.toLocaleString("en-US")} AI actions a month`;
}

export interface PlanTier {
  id: PlanId;
  name: string;
  /** Monthly and yearly list price. Both are 0 on a `customPrice` tier. */
  monthlyCents: number;
  yearlyCents: number;
  /**
   * Quoted in a conversation, never printed. The card shows "Custom" and no
   * figure — publishing a number on a tier with no customers caps the ceiling
   * forever, and the first buyer who would have paid far more never does.
   */
  customPrice: boolean;
  /** can be bought without talking to anyone */
  selfServe: boolean;
  mostPopular: boolean;
  /** who the plan is for — one sentence, shown under the price */
  audience: string;
  /** the enforced ceilings, and the only place they are written down */
  limits: PlanLimitSpec;
  /** how to label the single capacity number the plan is decided on */
  headline: PlanHeadline;
  features: PlanFeature[];
  cta: { label: string; kind: "signup" | "sales" };
  /** the small line under the button */
  ctaNote: string;
}

/** Ordered as displayed, left to right. */
export const PLAN_TIERS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyCents: 9900,
    yearlyCents: 99000,
    customPrice: false,
    selfServe: true,
    mostPopular: false,
    audience:
      "For founders and small teams running their first AI-assisted revenue workflow.",
    limits: { opportunities: 150, aiActions: 1_000 },
    headline: {
      label: "Active opportunities",
      detail:
        "Live deals Selryn is watching for you. Closed and archived deals don't count.",
    },
    features: [
      { label: "Buying-signal monitoring" },
      { label: "Deal prioritization" },
      { label: "Next-best-action with the evidence attached" },
      { label: "Human approval on every customer-facing send" },
      { label: "Revenue analytics" },
      { label: "Email support" },
    ],
    cta: { label: "Get Starter", kind: "signup" },
    ctaNote: "Upgrade whenever you're ready.",
  },
  {
    id: "growth",
    name: "Pro",
    monthlyCents: 29900,
    yearlyCents: 299000,
    customPrice: false,
    selfServe: true,
    mostPopular: true,
    audience:
      "For growing teams running inbound and outbound from one revenue layer.",
    limits: { opportunities: 750, aiActions: 3_000 },
    headline: {
      label: "Active opportunities",
      detail:
        "Five times Starter's capacity, with alerts and workflows on top.",
    },
    features: [
      { label: "Everything in Starter" },
      { label: "All Selryn agents" },
      { label: "Revenue-at-risk alerts" },
      { label: "Automated workflows" },
      { label: "Team revenue analytics" },
      { label: "Priority support" },
    ],
    cta: { label: "Get Pro", kind: "signup" },
    ctaNote: "Cancel anytime on monthly.",
  },
  {
    id: "enterprise",
    name: "Scale",
    monthlyCents: 0,
    yearlyCents: 0,
    customPrice: true,
    selfServe: false,
    mostPopular: false,
    audience:
      "For teams past 750 live opportunities, or with requirements of their own.",
    limits: { opportunities: null, aiActions: null },
    headline: {
      label: "Active opportunities",
      detail: "No cap, sized to your pipeline rather than to a tier.",
    },
    features: [
      { label: "Everything in Pro" },
      { label: "Custom agents and workflows" },
      { label: "Onboarding support" },
      { label: "Service-level agreement" },
      { label: "A named contact, not a queue" },
    ],
    cta: { label: "Talk to us", kind: "sales" },
    ctaNote: "Annual contracts, priced to your volume.",
  },
];

/**
 * What every plan gets regardless of price, lifted out of the cards.
 *
 * These were four rows inside each card, where a number beside "users" reads
 * as a restriction. Stated once above the cards they read as a promise, which
 * is what they actually are: neither seats nor connections are metered
 * anywhere in lib/billing.ts, so the old per-plan counts were advertising a
 * limit the product never enforced.
 */
export const UNIVERSAL_CAPACITY = {
  headline: "Unlimited team members · Unlimited data connections",
  detail:
    "On every plan, including Free. We don't charge per seat and we don't charge per integration — add your whole team, connect your whole stack.",
};

/**
 * The free plan, shown as a strip under the cards rather than a fourth card.
 *
 * It replaces the old 14-day card-required trial. A countdown is the wrong
 * shape for this product: signals accumulate, a draft is approved and sent,
 * and a reply lands days later — so a two-week clock tends to run out just
 * before the thing that would have convinced anyone. A standing free tier has
 * no clock to run out, and the upgrade prompt fires at the limit, when the
 * buyer is engaged and holding evidence.
 */
const FREE_LIMITS: PlanLimitSpec = { opportunities: 25, aiActions: 100 };

export const FREE_PLAN = {
  name: "Free",
  limits: FREE_LIMITS,
  cta: "Start free",
  note: "No credit card. No time limit.",
  /** Built from the limits above rather than typed beside them, so the
   *  sentence cannot end up quoting a number the app does not enforce. */
  summary:
    `Track ${capacityLabel(FREE_LIMITS.opportunities)} active opportunities and ` +
    `${capacityLabel(FREE_LIMITS.aiActions)} AI actions a month, with your whole ` +
    `team and every data source included.`,
};

/** The three terms a buyer stalls on, answered where they stall. */
export const METRIC_DEFINITIONS: { term: string; definition: string }[] = [
  {
    term: "Active opportunity",
    definition:
      "One live deal Selryn is watching for you. Closed and archived deals don't count, so the number only reflects work in flight.",
  },
  {
    term: "AI action",
    definition:
      "One piece of work Selryn does — researching an account, scoring a deal, or drafting a message for you to approve.",
  },
  {
    term: "Data connection",
    definition:
      "Any source you plug in: your CRM, your inbox, a calendar, or a CSV. Unlimited on every plan.",
  },
];

/** Capabilities every plan gets. Only things that exist today. */
export const UNIVERSAL_FEATURES = [
  "Pipeline monitoring",
  "Explainable recommendations",
  "Human-controlled customer actions",
  "Your data is never used to train shared models",
  "Secure data handling",
  "Cancel anytime on monthly plans",
];

/** Rounded whole-percent saving from paying yearly, across the self-serve
 *  plans. Computed, so it can never contradict the prices. */
export const YEARLY_SAVING_PERCENT = (() => {
  const selfServe = PLAN_TIERS.filter((t) => t.selfServe && !t.customPrice);
  const savings = selfServe.map(
    (t) => 1 - t.yearlyCents / (t.monthlyCents * 12)
  );
  return Math.round(Math.min(...savings) * 100);
})();

/** "$99" / "$2,990" — whole dollars, no trailing ".00". */
export function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** "$82.50" — always two decimals, for the yearly-to-monthly equivalent. */
export function formatDollarsExact(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface DisplayPrice {
  /** the big number, e.g. "$1,490" — or "Custom" on a quoted tier */
  amount: string;
  /** the unit beside it, e.g. "/year" — empty when the note carries it */
  period: string;
  /** the line under the price, e.g. "billed yearly" */
  note: string | null;
  /** the softer second line, e.g. "Equivalent to $124.17/month" */
  equivalent: string | null;
}

/**
 * Everything the price block of a card renders, for one plan and one cycle.
 * The card itself holds no pricing logic, so switching cycle updates these
 * few strings and nothing about the card's structure or height.
 */
export function displayPrice(tier: PlanTier, cycle: BillingCycle): DisplayPrice {
  if (tier.customPrice) {
    return {
      amount: "Custom",
      period: "",
      note: "Annual contract",
      equivalent: null,
    };
  }

  if (cycle === "monthly") {
    return {
      amount: formatDollars(tier.monthlyCents),
      period: "/month",
      note: "billed monthly",
      equivalent: null,
    };
  }

  return {
    amount: formatDollars(tier.yearlyCents),
    period: "/year",
    note: "billed yearly",
    equivalent: `Equivalent to ${formatDollarsExact(tier.yearlyCents / 12)}/month`,
  };
}

export function tierById(id: PlanId): PlanTier | undefined {
  return PLAN_TIERS.find((t) => t.id === id);
}
