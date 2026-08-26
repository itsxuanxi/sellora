"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Period = "monthly" | "yearly";

interface TierPrice {
  price: string;
  originalPrice: string | null;
  period: string;
  hint: string | null;
}

interface Tier {
  name: string;
  monthly: TierPrice;
  yearly: TierPrice;
  description: string;
  cta: string;
  highlighted: boolean;
  features: string[];
}

const tiers: Tier[] = [
  {
    name: "Pro",
    monthly: {
      price: "$19.99",
      originalPrice: "$29.99",
      period: "/month",
      hint: null,
    },
    yearly: {
      price: "$199.99",
      originalPrice: null,
      period: "/year",
      hint: "≈ $16.67/month — 2 months free",
    },
    description: "For solo founders getting their first outbound motion going.",
    cta: "Start Free",
    highlighted: false,
    features: [
      "500 prospects",
      "1,000 AI-personalized emails / mo",
      "2 active campaigns",
      "3-step AI follow-up sequences",
      "Pipeline CRM",
      "Email support",
    ],
  },
  {
    name: "Max",
    monthly: {
      price: "$39.99",
      originalPrice: "$59.99",
      period: "/month",
      hint: null,
    },
    yearly: {
      price: "$399.99",
      originalPrice: null,
      period: "/year",
      hint: "≈ $33.33/month — 2 months free",
    },
    description: "For teams running outbound as a repeatable growth channel.",
    cta: "Start Free",
    highlighted: true,
    features: [
      "5,000 prospects",
      "10,000 AI-personalized emails / mo",
      "Unlimited campaigns",
      "AI Insights & recommendations",
      "Custom sending domain",
      "3 team seats",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    monthly: { price: "Custom", originalPrice: null, period: "", hint: null },
    yearly: { price: "Custom", originalPrice: null, period: "", hint: null },
    description: "For companies that need scale, security, and a direct line to us.",
    cta: "Contact Sales",
    highlighted: false,
    features: [
      "Unlimited prospects & emails",
      "Unlimited seats",
      "SSO & audit logs",
      "Dedicated success manager",
      "Custom AI models & tone training",
      "SLA & security review",
    ],
  },
];

export function PricingCards({ startHref }: { startHref: string }) {
  const [period, setPeriod] = useState<Period>("monthly");

  return (
    <>
      <div className="mt-10 flex justify-center">
        <div
          role="group"
          aria-label="Billing period"
          className="flex items-center gap-1 rounded-full bg-muted p-1"
        >
          {(
            [
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                period === option.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
              {option.value === "yearly" && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => {
          const pricing = tier[period];
          return (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-7",
                tier.highlighted
                  ? "border-primary/40 shadow-xl shadow-primary/10 md:-my-3 md:py-10"
                  : "border-border/70"
              )}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-md">
                  Most popular
                </span>
              )}
              <h3 className="text-sm font-semibold">{tier.name}</h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight">
                  {pricing.price}
                </span>
                {pricing.originalPrice && (
                  <span className="text-lg font-medium text-muted-foreground/60 line-through">
                    {pricing.originalPrice}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  {pricing.period}
                </span>
              </div>
              {pricing.hint && (
                <p className="mt-1.5 text-xs font-medium text-emerald-600">
                  {pricing.hint}
                </p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {tier.description}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-foreground/85">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-7 w-full"
                variant={tier.highlighted ? "default" : "outline"}
                asChild
              >
                <Link
                  href={
                    tier.cta === "Contact Sales"
                      ? "mailto:sales@sellora.ai?subject=Sellora%20Enterprise"
                      : startHref
                  }
                >
                  {tier.cta}
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}
