"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Section } from "@/components/marketing/section";

/**
 * Screen 3 — "What does it cost, and how do I start?"
 *
 * Deliberately not a carousel: pricing is the one place a visitor wants to
 * compare things side by side without anything moving. The closing CTA lives
 * here too rather than in its own block, which keeps the page at three
 * screens.
 *
 * Two changes from the previous treatment. The framing is capacity ("plans
 * that grow with your pipeline") rather than cheapness — the old
 * "costs less than a coffee budget" line undercut the enterprise positioning
 * the rest of the page is building. And the section sits late in the scroll,
 * after the product has been shown and the trust questions answered.
 *
 * Every limit below is the real value from lib/billing.ts PLANS, not a
 * marketing approximation:
 *   Pro  — 500 prospects,   1,000 emails/mo, 2 campaigns
 *   Max  — 5,000 prospects, 10,000 emails/mo, unlimited campaigns
 */

type Billing = "monthly" | "yearly";

const TIERS = [
  {
    name: "Pro",
    monthly: { price: "$19.99", period: "/mo", hint: null as string | null },
    yearly: { price: "$199.99", period: "/yr", hint: "2 months free" },
    scale: "500 prospects · 1,000 AI actions / mo",
    description: "For founders and small sales teams.",
    cta: "Start free",
    highlighted: false,
    features: [
      "Core pipeline intelligence",
      "Opportunity scoring with full reasoning",
      "Recovery queue and next best action",
      "2 active workflows",
      "Standard support",
    ],
  },
  {
    name: "Max",
    monthly: { price: "$39.99", period: "/mo", hint: null as string | null },
    yearly: { price: "$399.99", period: "/yr", hint: "2 months free" },
    scale: "5,000 prospects · 10,000 AI actions / mo",
    description: "For teams running inbound and outbound as one pipeline.",
    cta: "Start free",
    highlighted: true,
    features: [
      "Everything in Pro",
      "All Sellora workflows, unlimited",
      "Revenue analytics and attribution",
      "CRM sync (planned)",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    monthly: { price: "Custom", period: "", hint: null as string | null },
    yearly: { price: "Custom", period: "", hint: null as string | null },
    scale: "Usage sized to your pipeline",
    description: "For teams with procurement, security review and scale needs.",
    cta: "Contact sales",
    highlighted: false,
    features: [
      "Custom usage limits",
      "SSO and audit logs (planned)",
      "Custom integrations",
      "Security review support",
      "Dedicated support",
      "Custom workflows and SLA",
    ],
  },
];

export function Pricing({ startHref }: { startHref: string }) {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <Section id="pricing" className="border-t-0 bg-[var(--mkt-page)]">
      <Reveal>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-brand-deep)]">Pricing</p>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-[var(--mkt-ink)] sm:text-4xl md:text-[2.7rem]">
          Plans that grow with your pipeline.
        </h2>
        <p className="mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-[var(--mkt-muted)]">
          Start with the workflows you need today. Expand as Sellora covers
          more of your revenue operation.
        </p>
      </Reveal>

      <Reveal delay={60}>
        <div
          role="group"
          aria-label="Billing period"
          className="mt-10 flex w-fit items-center gap-1 rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] p-1"
        >
          {(
            [
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly · save 17%" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setBilling(option.value)}
              aria-pressed={billing === option.value}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]",
                billing === option.value
                  ? "bg-[var(--mkt-surface)] font-medium text-[var(--mkt-ink)] shadow-[var(--mkt-shadow-card)]"
                  : "text-[var(--mkt-muted)] hover:text-[var(--mkt-ink)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Reveal>

      {/* One divided panel, not three floating cards */}
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {TIERS.map((tier) => {
          const info = tier[billing];
          return (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-7 lg:p-8",
                tier.highlighted
                  ? "border-[var(--mkt-brand)] bg-[var(--mkt-brand-wash)]"
                  : "border-[var(--mkt-line)] bg-[var(--mkt-surface)]"
              )}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-7 rounded-full bg-[var(--mkt-brand)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-white">
                  Most popular
                </span>
              )}

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
                  {tier.name}
                </h3>

              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-medium tracking-tight text-[var(--mkt-ink)]">
                  {info.price}
                </span>
                <span className="text-sm text-[var(--mkt-muted)]">{info.period}</span>
              </div>
              {info.hint && (
                <p className="mt-1.5 text-xs font-medium text-[var(--mkt-brand-deep)]">{info.hint}</p>
              )}

              <p className="mt-4 text-[13px] font-medium text-[var(--mkt-ink)]">
                {tier.scale}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--mkt-muted)]">
                {tier.description}
              </p>

              <ul className="mt-7 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-[var(--mkt-brand)]" aria-hidden />
                    <span className="text-[14px] leading-snug text-[var(--mkt-muted)]">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={
                  tier.cta === "Contact sales"
                    ? "mailto:sales@sellora.ai?subject=Sellora%20Enterprise"
                    : startHref
                }
                className={cn(
                  "mt-8 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-page)]",
                  tier.highlighted
                    ? "bg-[var(--mkt-brand)] text-white hover:bg-[var(--mkt-brand-deep)]"
                    : tier.name === "Enterprise"
                      ? "bg-[var(--mkt-ink)] text-[var(--mkt-page)] hover:bg-[var(--mkt-brand-deep)]"
                      : "border border-[var(--mkt-line)] bg-[var(--mkt-surface)] text-[var(--mkt-ink)] hover:border-[var(--mkt-brand)] hover:text-[var(--mkt-brand-deep)]"
                )}
              >
                {tier.cta}
              </Link>
            </div>
          );
        })}
      </div>

      <Reveal delay={80}>
        <p className="mt-6 text-[13px] text-[var(--mkt-muted)]">
          A free tier is available for evaluation. Items marked{" "}
          <span className="text-[var(--mkt-ink)]">planned</span> are on the roadmap
          and not yet available.
        </p>
      </Reveal>

      {/* ── Closing CTA: the page's only large dark surface. One deep band
             at the very end reads as a deliberate close rather than a theme,
             and keeps the light, credible tone dominant everywhere else. ── */}
      <Reveal delay={100}>
        <div className="relative mt-20 overflow-hidden rounded-3xl bg-[var(--mkt-dark)] px-6 py-16 text-center sm:px-12 sm:py-20">
          {/* A very restrained signal grid — no starfield, no glow. */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,black,transparent)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_60%_at_50%_0%,rgba(103,87,229,0.22),transparent_70%)]"
            aria-hidden
          />

          <div className="relative">
            <h3 className="mx-auto max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-[#F7F8F5] sm:text-4xl">
              Find the revenue already hiding in your pipeline.
            </h3>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-[#C9CCC7]">
              See which deals need attention, why they matter, and what your
              team should do next.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={startHref}
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#F7F8F5] px-7 text-[15px] font-medium text-[var(--mkt-dark)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-dark)]"
              >
                Start free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="mailto:hello@sellora.ai?subject=Sellora%20demo"
                className="inline-flex h-12 items-center rounded-full border border-white/20 px-7 text-[15px] font-medium text-[#F7F8F5] transition-colors hover:border-[#A99BFF] hover:text-[#CFC6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-dark)]"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
