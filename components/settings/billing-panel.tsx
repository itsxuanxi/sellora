"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  cancelSubscription,
  startCheckout,
} from "@/app/(app)/settings/billing-actions";

export interface BillingState {
  plan: "free" | "pro" | "max";
  planInterval: string | null;
  planStatus: string | null;
  planRenewsAt: string | null; // ISO
  stripeEnabled: boolean;
  simulated: boolean; // current subscription was activated without payment
  usage: { prospects: number; campaigns: number; emailsThisMonth: number };
}

const PLAN_CARDS = [
  {
    id: "free" as const,
    name: "Free",
    monthly: 0,
    yearly: 0,
    features: ["25 prospects", "50 emails / mo", "1 campaign", "Pipeline CRM"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    monthly: 19.99,
    yearly: 199.99,
    features: [
      "500 prospects",
      "1,000 AI-personalized emails / mo",
      "2 active campaigns",
      "3-step AI follow-up sequences",
    ],
  },
  {
    id: "max" as const,
    name: "Max",
    monthly: 39.99,
    yearly: 399.99,
    features: [
      "5,000 prospects",
      "10,000 AI-personalized emails / mo",
      "Unlimited campaigns",
      "AI Insights & priority support",
    ],
  },
];

const PLAN_LIMITS: Record<
  BillingState["plan"],
  { prospects: number; campaigns: number; emails: number }
> = {
  free: { prospects: 25, campaigns: 1, emails: 50 },
  pro: { prospects: 500, campaigns: 2, emails: 1000 },
  max: { prospects: 5000, campaigns: Infinity, emails: 10000 },
};

function UsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const unlimited = !Number.isFinite(limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", pct >= 100 && "text-rose-600")}>
          {used.toLocaleString()} / {unlimited ? "∞" : limit.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${unlimited ? 4 : pct}%` }}
        />
      </div>
    </div>
  );
}

export function BillingPanel({ state }: { state: BillingState }) {
  const [interval, setInterval] = useState<"month" | "year">(
    state.planInterval === "year" ? "year" : "month"
  );
  const [upgrading, startUpgrade] = useTransition();
  const [canceling, startCancel] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<"pro" | "max" | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const limits = PLAN_LIMITS[state.plan];
  const currentCard = PLAN_CARDS.find((p) => p.id === state.plan)!;

  function upgrade(planId: "pro" | "max") {
    setPendingPlan(planId);
    startUpgrade(async () => {
      const result = await startCheckout(planId, interval);
      // With Stripe configured the action redirects to Checkout and never
      // returns; a return value means dev mode or an error.
      if (result?.ok) {
        toast.success(`${planId === "pro" ? "Pro" : "Max"} plan activated`, {
          description: result.data.simulated
            ? "Dev mode — no payment was taken. Configure Stripe keys for real checkout."
            : undefined,
        });
      } else if (result) {
        toast.error(result.error);
      }
      setPendingPlan(null);
    });
  }

  function cancel() {
    startCancel(async () => {
      const result = await cancelSubscription();
      if (result.ok) {
        toast.success(
          state.stripeEnabled && !state.simulated
            ? "Subscription will end at the current period"
            : "Subscription canceled — back on Free"
        );
        setCancelOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Current plan + usage */}
      <div className="rounded-2xl border border-border/70 bg-card">
        <div className="border-b border-border/60 px-6 py-4">
          <h2 className="text-sm font-semibold">Billing</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage your plan and payment details.
          </p>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-base font-semibold">{currentCard.name}</span>
              <Badge
                variant="secondary"
                className={cn(
                  "font-normal",
                  state.planStatus === "canceled"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                )}
              >
                {state.planStatus === "canceled" ? "Ends at period" : "Current plan"}
              </Badge>
              {state.simulated && (
                <Badge variant="secondary" className="bg-amber-50 font-normal text-amber-700">
                  Dev mode — unpaid
                </Badge>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {state.plan === "free"
                ? "Free forever"
                : `$${(interval === "year" ? currentCard.yearly : currentCard.monthly).toFixed(2)}/${state.planInterval ?? "month"} · ${
                    state.planRenewsAt
                      ? `renews ${format(new Date(state.planRenewsAt), "MMM d, yyyy")}`
                      : "active"
                  }`}
            </div>
            {state.plan !== "free" && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 text-muted-foreground hover:text-destructive"
                onClick={() => setCancelOpen(true)}
              >
                Cancel subscription
              </Button>
            )}
          </div>
          <div className="space-y-3">
            <UsageRow label="Prospects" used={state.usage.prospects} limit={limits.prospects} />
            <UsageRow label="Campaigns" used={state.usage.campaigns} limit={limits.campaigns} />
            <UsageRow
              label="Emails this month"
              used={state.usage.emailsThisMonth}
              limit={limits.emails}
            />
          </div>
        </div>
      </div>

      {/* Plan picker */}
      <div className="rounded-2xl border border-border/70 bg-card p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Change plan</h3>
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            {(
              [
                { value: "month", label: "Monthly" },
                { value: "year", label: "Yearly · save 17%" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setInterval(option.value)}
                aria-pressed={interval === option.value}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all",
                  interval === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_CARDS.map((card) => {
            const isCurrent = card.id === state.plan;
            const price = interval === "year" ? card.yearly : card.monthly;
            return (
              <div
                key={card.id}
                className={cn(
                  "flex flex-col rounded-xl border p-5",
                  isCurrent ? "border-primary/40 bg-accent/30" : "border-border/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{card.name}</span>
                  {card.id === "max" && (
                    <Badge variant="secondary" className="gap-1 bg-accent font-normal text-accent-foreground">
                      <Sparkles className="size-3" />
                      Best value
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tracking-tight">
                    ${price.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{interval === "year" ? "year" : "month"}
                  </span>
                </div>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {card.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span className="text-foreground/85">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full"
                  size="sm"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || card.id === "free" || upgrading}
                  onClick={() => card.id !== "free" && upgrade(card.id)}
                >
                  {isCurrent
                    ? "Current plan"
                    : card.id === "free"
                      ? "Downgrade via cancel"
                      : upgrading && pendingPlan === card.id
                        ? "Starting checkout…"
                        : `Upgrade to ${card.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {state.stripeEnabled
            ? "Payments are processed securely by Stripe. Upgrades open Stripe Checkout; cancellations take effect at the end of the billing period."
            : "Stripe keys aren't configured, so upgrades activate instantly in dev mode without payment. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to charge real cards."}
        </p>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              {state.stripeEnabled && !state.simulated
                ? "Your plan stays active until the end of the current billing period, then drops to Free. No further charges."
                : "You'll be moved back to the Free plan immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>Keep plan</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancel();
              }}
              disabled={canceling}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {canceling ? "Canceling…" : "Cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
