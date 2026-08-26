"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Section, SectionLabel } from "@/components/marketing/section";

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
    <Section id="pricing">
      <Reveal>
        <SectionLabel number="03" label="Pricing" />
        <h2 className="mt-8 max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          Plans that grow with your pipeline.
        </h2>
        <p className="mt-6 max-w-2xl text-pretty text-[17px] leading-relaxed text-neutral-300">
          Start with the workflows you need today. Expand as Sellora covers
          more of your revenue operation.
        </p>
      </Reveal>

      <Reveal delay={60}>
        <div
          role="group"
          aria-label="Billing period"
          className="mt-10 flex w-fit items-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.03] p-1"
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
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]",
                billing === option.value
                  ? "bg-white font-medium text-black"
                  : "text-neutral-300 hover:text-white"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Reveal>

      {/* One divided panel, not three floating cards */}
      <div className="mt-12 grid divide-y divide-white/[0.08] border-y border-white/[0.08] md:grid-cols-3 md:divide-x md:divide-y-0">
        {TIERS.map((tier) => {
          const info = tier[billing];
          return (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col p-7 lg:p-8",
                tier.highlighted && "bg-white/[0.02]"
              )}
            >
              {tier.highlighted && (
                <span
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent"
                  aria-hidden
                />
              )}

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-neutral-300">
                  {tier.name}
                </h3>
                {tier.highlighted && (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-violet-300">
                    Most popular
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-medium tracking-tight text-white">
                  {info.price}
                </span>
                <span className="text-sm text-neutral-400">{info.period}</span>
              </div>
              {info.hint && (
                <p className="mt-1.5 text-xs font-medium text-violet-300">{info.hint}</p>
              )}

              <p className="mt-4 text-[13px] font-medium text-neutral-200">
                {tier.scale}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-neutral-400">
                {tier.description}
              </p>

              <ul className="mt-7 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-violet-400" aria-hidden />
                    <span className="text-[14px] leading-snug text-neutral-300">
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
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]",
                  tier.highlighted
                    ? "bg-white text-black hover:bg-neutral-200 active:bg-neutral-300"
                    : "border border-white/15 text-white hover:border-white/30 hover:bg-white/[0.06] active:bg-white/[0.10]"
                )}
              >
                {tier.cta}
              </Link>
            </div>
          );
        })}
      </div>

      <Reveal delay={80}>
        <p className="mt-6 text-[13px] text-neutral-400">
          A free tier is available for evaluation. Items marked{" "}
          <span className="text-neutral-300">planned</span> are on the roadmap
          and not yet available.
        </p>
      </Reveal>

      {/* ── Closing CTA, folded in rather than given a fourth screen ── */}
      <Reveal delay={100}>
        <div className="mt-20 border-t border-white/[0.08] pt-16 text-center">
          <h3 className="mx-auto max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl">
            Find the revenue already hiding in your pipeline.
          </h3>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-neutral-300">
            See which deals need attention, why they matter, and what your team
            should do next.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={startHref}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-black transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:bg-neutral-300"
            >
              Start free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="mailto:hello@sellora.ai?subject=Sellora%20demo"
              className="inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-[15px] font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:bg-white/[0.10]"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
