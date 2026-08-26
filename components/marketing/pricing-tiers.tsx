"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "yearly";

interface PriceInfo {
  price: string;
  original: string | null;
  period: string;
  hint: string | null;
}

const tiers: {
  name: string;
  monthly: PriceInfo;
  yearly: PriceInfo;
  description: string;
  cta: string;
  highlighted: boolean;
  features: string[];
}[] = [
  {
    name: "Pro",
    monthly: { price: "$19.99", original: "$29.99", period: "/mo", hint: null },
    yearly: {
      price: "$199.99",
      original: "$239.88",
      period: "/yr",
      hint: "2 months free",
    },
    description: "For founders standing up their first agent-driven motion.",
    cta: "Start free",
    highlighted: false,
    features: [
      "500 prospects",
      "1,000 AI actions / mo",
      "Website Chat + Follow-up agents",
      "Pipeline CRM",
    ],
  },
  {
    name: "Max",
    monthly: { price: "$39.99", original: "$59.99", period: "/mo", hint: null },
    yearly: {
      price: "$399.99",
      original: "$479.88",
      period: "/yr",
      hint: "2 months free",
    },
    description: "For teams running outbound and inbound as one system.",
    cta: "Start free",
    highlighted: true,
    features: [
      "5,000 prospects",
      "10,000 AI actions / mo",
      "All six agents",
      "CRM Sync + Analytics",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    monthly: { price: "Custom", original: null, period: "", hint: null },
    yearly: { price: "Custom", original: null, period: "", hint: null },
    description: "For scale, security reviews, and a direct line to us.",
    cta: "Contact sales",
    highlighted: false,
    features: [
      "Unlimited everything",
      "SSO & audit logs",
      "Dedicated success manager",
      "Custom agents & SLAs",
    ],
  },
];

export function PricingTiers({ startHref }: { startHref: string }) {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <>
      <div className="mx-auto mt-10 flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
        {(
          [
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly · –17%" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setBilling(option.value)}
            aria-pressed={billing === option.value}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-all",
              billing === option.value
                ? "bg-white font-medium text-black"
                : "text-neutral-400 hover:text-white"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* one unified panel, divided by hairlines — not three rounded cards */}
      <div className="mt-12 grid divide-y divide-white/[0.08] border-y border-white/[0.08] md:grid-cols-3 md:divide-x md:divide-y-0">
        {tiers.map((tier) => {
          const info = tier[billing];
          return (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col p-8",
                tier.highlighted && "bg-white/[0.015]"
              )}
            >
              {tier.highlighted && (
                <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/70 to-transparent" />
              )}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-400">
                  {tier.name}
                </h3>
                {tier.highlighted && (
                  <span className="text-[11px] uppercase tracking-[0.12em] text-violet-300">
                    Most popular
                  </span>
                )}
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-5xl font-medium tracking-tight text-white">
                  {info.price}
                </span>
                {info.original && (
                  <span className="text-base text-neutral-600 line-through">
                    {info.original}
                  </span>
                )}
                <span className="text-sm text-neutral-500">{info.period}</span>
              </div>
              {info.hint && (
                <p className="mt-1.5 text-xs font-medium text-violet-300">
                  {info.hint}
                </p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {tier.description}
              </p>
              <ul className="mt-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-violet-400" />
                    <span className="text-neutral-300">{feature}</span>
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
                  "mt-8 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-all",
                  tier.highlighted
                    ? "bg-white text-black hover:bg-neutral-200"
                    : "border border-white/15 text-white hover:bg-white/5"
                )}
              >
                {tier.cta}
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
