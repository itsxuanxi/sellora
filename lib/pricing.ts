/**
 * The single source of truth for what Sellora costs.
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
 */

export type PaidPlanId = "starter" | "growth";
export type PlanId = "free" | PaidPlanId | "enterprise";
export type BillingCycle = "monthly" | "yearly";

/** Full-access trial on Starter and Growth. Enforced in two places that both
 *  read this constant: the Stripe trial period and the trial limits below. */
export const TRIAL_DAYS = 14;

export interface PlanFeature {
  label: string;
  /** on the roadmap, not yet shipped — always surfaced as a "Planned" badge */
  planned?: boolean;
}

export interface PlanTier {
  id: PlanId;
  name: string;
  /** Monthly and yearly list price. For `startingAt` tiers these are floors
   *  quoted in a sales conversation, not a self-serve charge. */
  monthlyCents: number;
  yearlyCents: number;
  /** the published number is a starting point, not the price */
  startingAt: boolean;
  /** can be bought without talking to anyone */
  selfServe: boolean;
  mostPopular: boolean;
  /** who the plan is for — one sentence, shown under the price */
  audience: string;
  /** the four capacity numbers, shown above the feature list */
  capacity: string[];
  features: PlanFeature[];
  cta: { label: string; kind: "signup" | "sales" };
}

/** Ordered as displayed, left to right. */
export const PLAN_TIERS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyCents: 9900,
    yearlyCents: 99000,
    startingAt: false,
    selfServe: true,
    mostPopular: false,
    audience:
      "For founders and 1–3 person sales teams building their first AI-assisted revenue workflow.",
    capacity: [
      "3 users",
      "1 data connection",
      "Up to 1,000 active opportunities",
      "5,000 AI actions per month",
    ],
    features: [
      { label: "Buying signal monitoring" },
      { label: "Deal prioritization" },
      { label: "Next-best-action recommendations" },
      { label: "Website Chat and Follow-up" },
      { label: "Basic revenue analytics" },
      { label: "Email support" },
    ],
    cta: { label: "Start free trial", kind: "signup" },
  },
  {
    id: "growth",
    name: "Growth",
    monthlyCents: 29900,
    yearlyCents: 299000,
    startingAt: false,
    selfServe: true,
    mostPopular: true,
    audience:
      "For growing sales teams running inbound and outbound from one revenue intelligence layer.",
    capacity: [
      "10 users",
      "Up to 3 data connections",
      "Up to 10,000 active opportunities",
      "30,000 AI actions per month",
    ],
    features: [
      { label: "Everything in Starter" },
      { label: "All Sellora agents" },
      { label: "CRM, email and calendar sync", planned: true },
      { label: "Revenue-at-risk alerts" },
      { label: "Automated workflows" },
      { label: "Team revenue analytics" },
      { label: "Human approval controls" },
      { label: "Priority support" },
    ],
    cta: { label: "Start free trial", kind: "signup" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyCents: 150000,
    yearlyCents: 1800000,
    startingAt: true,
    selfServe: false,
    mostPopular: false,
    audience:
      "For organizations that need custom integrations, security reviews and deployment support.",
    capacity: ["25+ users", "Custom usage limits"],
    features: [
      { label: "Salesforce and custom integrations", planned: true },
      { label: "SSO and SAML", planned: true },
      { label: "Role-based access", planned: true },
      { label: "Audit logs", planned: true },
      { label: "Custom data retention", planned: true },
      { label: "Custom agents and workflows" },
      { label: "Security review support" },
      { label: "Service-level agreement" },
      { label: "Dedicated customer success manager" },
    ],
    cta: { label: "Contact sales", kind: "sales" },
  },
];

/** Capabilities every plan gets. Only things that exist today. */
export const UNIVERSAL_FEATURES = [
  "Pipeline monitoring",
  "Explainable recommendations",
  "Human-controlled customer actions",
  "Secure data handling",
  "Cancel anytime on monthly plans",
];

/** Rounded-down whole-percent saving from paying yearly, across the
 *  self-serve plans. Computed, so it can never contradict the prices. */
export const YEARLY_SAVING_PERCENT = (() => {
  const selfServe = PLAN_TIERS.filter((t) => t.selfServe);
  const savings = selfServe.map(
    (t) => 1 - t.yearlyCents / (t.monthlyCents * 12)
  );
  return Math.round(Math.min(...savings) * 100);
})();

/** "$99" / "$1,500" — whole dollars, no trailing ".00". */
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
  /** the big number, e.g. "$990" */
  amount: string;
  /** the unit beside it, e.g. "/year" — empty when the note carries it */
  period: string;
  /** the prefix for floor pricing, e.g. "Starting at" */
  prefix: string | null;
  /** the line under the price, e.g. "billed yearly" */
  note: string | null;
  /** the softer second line, e.g. "Equivalent to $82.50/month" */
  equivalent: string | null;
}

/**
 * Everything the price block of a card renders, for one plan and one cycle.
 * The card itself holds no pricing logic, so switching cycle updates these
 * few strings and nothing about the card's structure or height.
 */
export function displayPrice(tier: PlanTier, cycle: BillingCycle): DisplayPrice {
  const prefix = tier.startingAt ? "Starting at" : null;

  if (cycle === "monthly") {
    return {
      amount: formatDollars(tier.monthlyCents),
      period: "/month",
      prefix,
      note: tier.selfServe ? "billed monthly" : "or custom annual contract",
      equivalent: null,
    };
  }

  return {
    amount: formatDollars(tier.yearlyCents),
    period: "/year",
    prefix,
    note: tier.selfServe ? "billed yearly" : "custom annual contract",
    equivalent: tier.selfServe
      ? `Equivalent to ${formatDollarsExact(tier.yearlyCents / 12)}/month`
      : null,
  };
}

export function tierById(id: PlanId): PlanTier | undefined {
  return PLAN_TIERS.find((t) => t.id === id);
}
