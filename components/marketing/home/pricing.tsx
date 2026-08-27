"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Section } from "@/components/marketing/section";
import {
  PLAN_TIERS,
  TRIAL_DAYS,
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

// Enterprise buyers land on the same form: it asks the questions a
// sales conversation would open with anyway, and the page still offers
// email as the fallback.
const SALES_HREF = "/request-demo";
const DEMO_HREF = "/request-demo";

export function Pricing({ startHref }: { startHref: string }) {
  // Yearly by default: it is the cheaper option, so leading with it is the
  // honest default rather than an upsell.
  const [cycle, setCycle] = useState<BillingCycle>("yearly");

  return (
    <Section id="pricing" className="border-t-0 bg-[var(--mkt-page)]">
      <Reveal>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-brand-deep)]">
          Pricing
        </p>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-[var(--mkt-ink)] sm:text-4xl md:text-[2.7rem]">
          Plans that grow with your pipeline.
        </h2>
        <p className="mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-[var(--mkt-muted)]">
          Start with the workflows you need today. Expand as Sellora covers
          more of your revenue operation.
        </p>
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

      <Reveal delay={80}>
        <p className="mt-7 max-w-3xl text-[13px] leading-relaxed text-[var(--mkt-muted)]">
          All Starter and Growth trials include {TRIAL_DAYS} days of full
          product access. No credit card required. Rows marked{" "}
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
  const isEnterprise = tier.cta.kind === "sales";

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

      <ul className="mt-6 space-y-1.5 border-t border-[var(--mkt-line)] pt-5">
        {tier.capacity.map((line) => (
          <li key={line} className="text-[13px] font-medium text-[var(--mkt-ink)]">
            {line}
          </li>
        ))}
      </ul>

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
        href={isEnterprise ? SALES_HREF : startHref}
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
        {isEnterprise ? (
          <Link
            href={DEMO_HREF}
            className="underline decoration-[var(--mkt-line)] underline-offset-4 transition-colors hover:text-[var(--mkt-brand-deep)]"
          >
            Book a tailored demo
          </Link>
        ) : (
          <>
            {TRIAL_DAYS}-day free trial · No credit card required
          </>
        )}
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
      <div className="mt-6 h-[18px] text-[13px] font-medium text-[var(--mkt-muted)]">
        {price.prefix}
      </div>
      <div className="flex items-baseline gap-1.5">
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
          Find the revenue already hiding in your pipeline.
        </h3>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-[#C9CCC7]">
          See which deals need attention, why they matter, and what your team
          should do next.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={startHref}
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#F7F8F5] px-7 text-[15px] font-medium text-[var(--mkt-dark)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-dark)]"
          >
            Start free trial
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex h-12 items-center rounded-full border border-white/20 px-7 text-[15px] font-medium text-[#F7F8F5] transition-colors hover:border-[#A99BFF] hover:text-[#CFC6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-dark)]"
          >
            Try Sellora
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
