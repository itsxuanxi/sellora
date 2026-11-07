"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Section } from "@/components/marketing/section";
import {
  FREE_PLAN,
  allowanceLabel,
  capacityLabel,
  METRIC_DEFINITIONS,
  PLAN_TIERS,
  UNIVERSAL_CAPACITY,
  UNIVERSAL_FEATURES,
  YEARLY_SAVING_PERCENT,
  displayPrice,
  type BillingCycle,
  type PlanTier,
} from "@/lib/pricing";

/**
 * Screen 3 — "What does it cost, and how do I start?"
 *
 * Deliberately not a carousel: pricing is the one place a visitor wants to
 * compare things side by side without anything moving. The closing CTA lives
 * here too rather than in its own block, which keeps the page at three
 * screens.
 *
 * The plans, prices, features and CTAs all come from lib/pricing.ts, which
 * lib/billing.ts also reads to build the Stripe Checkout line item — so the
 * number on the card and the number on the card statement are the same
 * number, and there is no second copy of the card markup for yearly.
 *
 * Switching cycle therefore changes four strings inside PriceBlock and
 * nothing else. Every one of those strings sits in a height-reserved slot, so
 * the toggle fades the numbers without moving a single row beneath them.
 */

// Quoted-tier buyers land on the same form: it asks the questions a sales
// conversation would open with anyway, and the page still offers email as the
// fallback.
const SALES_HREF = "/request-demo";

/**
 * Carries the chosen plan to the sign-up page.
 *
 * All three buttons used to land on the same URL, so a visitor who
 * deliberately pressed Pro arrived somewhere with no idea which card they
 * chose and was started on Free without comment. Only applied when the
 * destination is sign-up: a signed-in reader goes to their dashboard, where a
 * plan parameter would mean nothing.
 */
function withPlan(href: string, plan: string): string {
  return href === "/sign-up" ? `${href}?plan=${plan}` : href;
}
const DEMO_HREF = "/request-demo";

export function Pricing({ startHref }: { startHref: string }) {
  // Monthly is the least-commitment option and therefore the clearest default.
  // Visitors can still opt into the discounted yearly plan explicitly.
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <Section id="pricing" className="border-t-0 bg-[var(--mkt-page)]">
      <Reveal>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-brand-deep)]">
          Pricing
        </p>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-[var(--mkt-ink)] sm:text-4xl md:text-[2.7rem]">
          Simple pricing that scales with your pipeline, not your headcount.
        </h2>
        <p className="mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-[var(--mkt-muted)]">
          One meter: how many live deals Selryn is watching. Your whole team is
          included on every plan, and we don&rsquo;t charge per connection.
        </p>
      </Reveal>

      {/* Seats and connections used to be two rows inside every card, where a
          number beside "users" reads as a restriction. Stated once, above the
          cards, the same fact reads as a promise — and three rows leave each
          card, which is most of why the cards now scan. */}
      <Reveal delay={50}>
        <UniversalStrip />
      </Reveal>

      <Reveal delay={60}>
        <CycleToggle cycle={cycle} onChange={setCycle} />
      </Reveal>

      {/* The seven named rows are declared here, on the parent, and each card
          adopts them via grid-rows-subgrid below. That aligns name, price,
          audience, capacity, features and CTA across all three cards at any
          viewport width, with no per-card min-heights to re-tune when a line
          wraps differently. The features row takes 1fr so it absorbs the
          slack and the CTAs land on a single baseline. */}
      <div className="mt-12 grid items-stretch gap-5 md:grid-cols-3 md:gap-y-0 md:[grid-template-rows:auto_auto_auto_auto_1fr_auto_auto]">
        {PLAN_TIERS.map((tier) => (
          <PlanCard
            key={tier.id}
            tier={tier}
            cycle={cycle}
            startHref={startHref}
          />
        ))}
      </div>

      {/* Below the cards, not above: above, a free plan competes with the
          prices and talks the reader out of reading them. Below, it is the
          safety net they reach for once they have. */}
      <Reveal delay={80}>
        <FreeStrip startHref={startHref} />
      </Reveal>

      <Reveal delay={85}>
        <MetricGlossary />
      </Reveal>

      <Reveal delay={88}>
        <p className="mt-7 max-w-3xl text-[13px] leading-relaxed text-[var(--mkt-muted)]">
          Annual plans are two months free, on every plan. Rows marked{" "}
          <span className="font-medium text-[var(--mkt-ink)]">Planned</span> are
          on the roadmap and not yet available.
        </p>
      </Reveal>

      <Reveal delay={90}>
        <AllPlansInclude />
      </Reveal>

      <Reveal delay={100}>
        <ClosingCta startHref={startHref} />
      </Reveal>
    </Section>
  );
}

/* ─────────────────────────── billing cycle ─────────────────────────── */

function CycleToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (next: BillingCycle) => void;
}) {
  const options = [
    { value: "monthly" as const, label: "Monthly" },
    {
      value: "yearly" as const,
      label: `Yearly · Save ${YEARLY_SAVING_PERCENT}%`,
    },
  ];

  return (
    <div
      role="group"
      aria-label="Billing period"
      className="mt-10 flex w-fit items-center gap-1 rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={cycle === option.value}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]",
            cycle === option.value
              ? "bg-[var(--mkt-surface)] font-medium text-[var(--mkt-ink)] shadow-[var(--mkt-shadow-card)]"
              : "text-[var(--mkt-muted)] hover:text-[var(--mkt-ink)]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── plan card ───────────────────────────── */

function PlanCard({
  tier,
  cycle,
  startHref,
}: {
  tier: PlanTier;
  cycle: BillingCycle;
  startHref: string;
}) {
  const featured = tier.mostPopular;
  const isQuoted = tier.cta.kind === "sales";

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border p-7 lg:p-8",
        // The single column is pinned to minmax(0,1fr): a grid's implicit
        // column is auto-sized, which would let the widest price ("$18,000"
        // at text-4xl) set the card's inner width and push the feature text
        // past the padding on narrow 3-up layouts.
        "md:grid md:grid-cols-[minmax(0,1fr)] md:grid-rows-subgrid md:row-span-7",
        featured
          ? // Emphasis by tint and border only — no scale, no lift. A card
            // that grows on hover drags the row's baseline with it.
            "border-[var(--mkt-brand)] bg-[var(--mkt-brand-wash)] shadow-[var(--mkt-shadow-card)]"
          : "border-[var(--mkt-line)] bg-[var(--mkt-surface)]"
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-7 rounded-full bg-[var(--mkt-brand)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-white">
          Most popular
        </span>
      )}

      <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
        {tier.name}
      </h3>

      <PriceBlock tier={tier} cycle={cycle} />

      <p className="mt-5 text-[14px] leading-relaxed text-[var(--mkt-muted)]">
        {tier.audience}
      </p>

      {/* The one number the plan is chosen on, at display size, with the
          sentence that stops a buyer having to guess what it counts. The
          AI-action allowance sits underneath in the same monospace micro-label
          the product uses for field names — a spec, not a decision. */}
      <div className="mt-6 border-t border-[var(--mkt-line)] pt-5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[30px] font-medium leading-none tracking-[-0.02em] text-[var(--mkt-ink)]">
            {capacityLabel(tier.limits.opportunities)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mkt-muted)]">
            {tier.headline.label}
          </span>
        </div>
        <p className="mt-2.5 text-[12.5px] leading-snug text-[var(--mkt-muted)]">
          {tier.headline.detail}
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-[var(--mkt-muted)]">
          {allowanceLabel(tier.limits.aiActions)}
        </p>
      </div>

      <ul className="mt-5 flex-1 space-y-3">
        {tier.features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 size-4 shrink-0 text-[var(--mkt-brand)]"
              aria-hidden
            />
            <span className="text-[14px] leading-snug text-[var(--mkt-muted)]">
              {feature.label}
              {feature.planned && (
                <span className="ml-1.5 inline-block rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-1.5 py-px align-[1px] text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--mkt-muted)]">
                  Planned
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* flex-1 on the feature list above absorbs the slack, which pins this
          CTA to the same height in every card however many rows it has. */}
      <Link
        href={isQuoted ? SALES_HREF : startHref}
        className={cn(
          "mt-8 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]",
          featured
            ? "bg-[var(--mkt-brand)] text-white hover:bg-[var(--mkt-brand-deep)]"
            : "bg-[var(--mkt-ink)] text-[var(--mkt-page)] hover:bg-[#000]"
        )}
      >
        {tier.cta.label}
      </Link>

      <p className="mt-3 text-center text-[12px] text-[var(--mkt-muted)]">
        {tier.ctaNote}
      </p>
    </div>
  );
}

/**
 * The only part of a card that a cycle change touches. Each line lives in a
 * fixed-height slot, so the fade never reflows anything: the "Starting at"
 * row is reserved even where it is empty, and the note/equivalent pair
 * occupies two lines' worth of space whether it uses one or two.
 */
function PriceBlock({ tier, cycle }: { tier: PlanTier; cycle: BillingCycle }) {
  const price = displayPrice(tier, cycle);

  return (
    <div key={cycle} className="animate-price-fade">
      {/* The "Starting at" row is gone with the published Scale price: a
          quoted tier shows "Custom" and nothing else, so there is no floor on
          the page for a buyer to anchor a negotiation to. */}
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-4xl font-medium tracking-tight text-[var(--mkt-ink)]">
          {price.amount}
        </span>
        <span className="text-sm text-[var(--mkt-muted)]">{price.period}</span>
      </div>
      <div className="mt-2 h-[34px]">
        {price.note && (
          <p className="text-[12.5px] leading-[17px] text-[var(--mkt-muted)]">
            {price.note}
          </p>
        )}
        {price.equivalent && (
          <p className="text-[12.5px] leading-[17px] text-[var(--mkt-brand-deep)]">
            {price.equivalent}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── what every plan includes, once ─────────────────── */

/**
 * The page's best argument, stated before any price is read.
 *
 * Neither seats nor data connections are metered anywhere in lib/billing.ts,
 * so the per-plan counts the cards used to print were advertising a limit the
 * product never enforced. Saying it once, plainly, is both more honest and a
 * better sales line than three cards each disclosing a different cap.
 */
function UniversalStrip() {
  return (
    <div className="mt-10 rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-6 py-5 sm:px-8">
      <p className="text-balance text-[15px] font-medium tracking-[-0.01em] text-[var(--mkt-ink)] sm:text-[16.5px]">
        {UNIVERSAL_CAPACITY.headline}
      </p>
      <p className="mt-2 max-w-3xl text-pretty text-[13.5px] leading-relaxed text-[var(--mkt-muted)]">
        {UNIVERSAL_CAPACITY.detail}
      </p>
    </div>
  );
}

/* ───────────────────────────── free plan ───────────────────────────── */

/**
 * The standing free plan, replacing a 14-day card-required trial.
 *
 * A countdown is the wrong shape for this product. Signals accumulate, a
 * draft is approved and sent, and a reply lands days later — so a two-week
 * clock tends to expire just before the thing that would have convinced
 * anyone. Nothing here starts a timer, and the upgrade prompt fires at the
 * opportunity limit instead, when the buyer is engaged and holding evidence.
 */
function FreeStrip({ startHref }: { startHref: string }) {
  return (
    <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mkt-ink)]">
            {FREE_PLAN.name}
          </span>
          <span className="text-[15px] font-medium text-[var(--mkt-ink)]">
            Try it before you pay anything.
          </span>
        </div>
        <p className="mt-2.5 max-w-xl text-pretty text-[13.5px] leading-relaxed text-[var(--mkt-muted)]">
          {FREE_PLAN.summary}
        </p>
      </div>

      <div className="shrink-0 sm:text-right">
        <Link
          href={withPlan(startHref, "free")}
          className="group inline-flex h-11 items-center gap-2 rounded-full bg-[var(--mkt-ink)] px-6 text-sm font-medium text-[var(--mkt-page)] transition-colors hover:bg-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]"
        >
          {FREE_PLAN.cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-2.5 text-[12px] text-[var(--mkt-muted)]">
          {FREE_PLAN.note}
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────── what the words mean ──────────────────────── */

/**
 * The three terms a buyer stalls on, answered where they stall.
 *
 * "Closed and archived deals don't count" is the line doing the most work on
 * this page: it is the first question anyone asks silently about a capacity
 * number, and answering it before it is asked reads as confidence.
 */
function MetricGlossary() {
  return (
    <dl className="mt-8 grid gap-x-8 gap-y-6 border-t border-[var(--mkt-line)] pt-7 sm:grid-cols-3">
      {METRIC_DEFINITIONS.map((metric) => (
        <div key={metric.term}>
          <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mkt-ink)]">
            {metric.term}
          </dt>
          <dd className="mt-2 text-[13px] leading-relaxed text-[var(--mkt-muted)]">
            {metric.definition}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ──────────────────────── shared capabilities ──────────────────────── */

function AllPlansInclude() {
  return (
    <div className="mt-8 rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-6 py-6 sm:px-8">
      <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
        All plans include
      </p>
      <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {UNIVERSAL_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 size-4 shrink-0 text-[var(--mkt-brand)]"
              aria-hidden
            />
            <span className="text-[14px] leading-snug text-[var(--mkt-ink)]">
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────────── closing CTA ─────────────────────────── */

/** The page's only large dark surface. One deep band at the very end reads as
 *  a deliberate close rather than a theme, and keeps the light, credible tone
 *  dominant everywhere else. */
function ClosingCta({ startHref }: { startHref: string }) {
  return (
    <div className="relative mt-20 overflow-hidden rounded-3xl bg-[var(--mkt-dark)] px-6 py-16 text-center sm:px-12 sm:py-20">
      {/* A very restrained signal grid — no starfield, no glow. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,black,transparent)]"
        aria-hidden
      />

      <div className="relative">
        <h3 className="mx-auto max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-[#F7F8F5] sm:text-4xl">
          Find out which of your proposals went quiet.
        </h3>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-[#C9CCC7]">
          The demo runs the whole thing on sample data in about three minutes.
          No sign-up, and nothing is sent to anyone.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={withPlan(startHref, "free")}
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#F7F8F5] px-7 text-[15px] font-medium text-[var(--mkt-dark)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-dark)]"
          >
            Start free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex h-12 items-center rounded-full border border-white/20 px-7 text-[15px] font-medium text-[#F7F8F5] transition-colors hover:border-[#A99BFF] hover:text-[#CFC6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-dark)]"
          >
            Try the demo
          </Link>
          <Link
            href={DEMO_HREF}
            className="inline-flex h-12 items-center px-3 text-[15px] font-medium text-[#C9CCC7] underline decoration-white/25 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF]"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </div>
  );
}
