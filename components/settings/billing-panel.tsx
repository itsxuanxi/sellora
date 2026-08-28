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
import {
  PLAN_TIERS,
  TRIAL_DAYS,
  formatDollars,
  tierById,
  type PaidPlanId,
  type PlanId,
} from "@/lib/pricing";

export interface BillingState {
  plan: PlanId;
  planInterval: string | null;
  planStatus: string | null;
  planRenewsAt: string | null; // ISO
  stripeEnabled: boolean;
  simulated: boolean; // current subscription was activated without payment
  /** The metered ceilings for the plan in force, resolved server-side by
   *  planOf() so a trial shows trial limits rather than the paid ones.
   *  `null` means unlimited — Infinity does not survive the RSC boundary. */
  limits: { prospects: number | null; campaigns: number | null; emails: number | null };
  usage: { prospects: number; campaigns: number; emailsThisMonth: number };
}

/**
 * Plans, names and prices come from lib/pricing.ts — the same module the
 * marketing pricing screen renders and lib/billing.ts charges from. There is
 * no second copy of the price here to drift out of sync with the landing page.
 */
const SALES_HREF = "mailto:itsxuanxi8@icloud.com?subject=Selryn%20Enterprise";

const PLAN_LABEL: Record<PlanId, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

function UsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const unlimited = limit === null || !Number.isFinite(limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit!) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", pct >= 100 && "text-rose-600")}>
          {used.toLocaleString()} / {unlimited ? "∞" : limit!.toLocaleString()}
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
  const [pendingPlan, setPendingPlan] = useState<PaidPlanId | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const limits = state.limits;
  const currentTier = tierById(state.plan);
  const trialing = state.planStatus === "trialing";

  function upgrade(planId: PaidPlanId) {
    setPendingPlan(planId);
    startUpgrade(async () => {
      const result = await startCheckout(planId, interval);
      // With Stripe configured the action redirects to Checkout and never
      // returns; a return value means dev mode or an error.
      if (result?.ok) {
        toast.success(`${PLAN_LABEL[planId]} trial started`, {
          description: result.data.simulated
            ? "Dev mode — no payment was taken. Configure Stripe keys for real checkout."
            : `${TRIAL_DAYS} days of full access. No card charged until the trial ends.`,
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
              <span className="text-base font-semibold">
                {PLAN_LABEL[state.plan]}
              </span>
              <Badge
                variant="secondary"
                className={cn(
                  "font-normal",
                  state.planStatus === "canceled"
                    ? "bg-amber-50 text-amber-700"
                    : trialing
                      ? "bg-violet-50 text-violet-700"
                      : "bg-emerald-50 text-emerald-700"
                )}
              >
                {state.planStatus === "canceled"
                  ? "Ends at period"
                  : trialing
                    ? `${TRIAL_DAYS}-day trial`
                    : "Current plan"}
              </Badge>
              {state.simulated && (
                <Badge variant="secondary" className="bg-amber-50 font-normal text-amber-700">
                  Dev mode — unpaid
                </Badge>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {!currentTier
                ? "No active subscription"
                : `${formatDollars(
                    state.planInterval === "year"
                      ? currentTier.yearlyCents
                      : currentTier.monthlyCents
                  )}/${state.planInterval ?? "month"} · ${
                    state.planRenewsAt
                      ? `${trialing ? "trial ends" : "renews"} ${format(
                          new Date(state.planRenewsAt),
                          "MMM d, yyyy"
                        )}`
                      : "active"
                  }`}
            </div>
            {trialing && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Full product access during the trial, metered at trial limits.
                No card is charged until it ends.
              </p>
            )}
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
            <UsageRow
              label="Active opportunities"
              used={state.usage.prospects}
              limit={limits.prospects}
            />
            <UsageRow label="Campaigns" used={state.usage.campaigns} limit={limits.campaigns} />
            <UsageRow
              label="AI actions this month"
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
          {PLAN_TIERS.map((tier) => {
            const isCurrent = tier.id === state.plan;
            const cents =
              interval === "year" ? tier.yearlyCents : tier.monthlyCents;
            return (
              <div
                key={tier.id}
                className={cn(
                  "flex flex-col rounded-xl border p-5",
                  isCurrent ? "border-primary/40 bg-accent/30" : "border-border/60"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{tier.name}</span>
                  {tier.mostPopular && (
                    <Badge
                      variant="secondary"
                      className="gap-1 bg-accent font-normal text-accent-foreground"
                    >
                      <Sparkles className="size-3" />
                      Most popular
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  {tier.startingAt && (
                    <span className="text-xs text-muted-foreground">from</span>
                  )}
                  <span className="text-2xl font-semibold tracking-tight">
                    {formatDollars(cents)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{interval === "year" ? "year" : "month"}
                  </span>
                </div>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {tier.capacity.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span className="text-foreground/85">{line}</span>
                    </li>
                  ))}
                </ul>

                {/* Enterprise is quoted, not bought — no self-serve button
                    that could charge the "from" figure as if it were final. */}
                {tier.selfServe ? (
                  <Button
                    className="mt-5 w-full"
                    size="sm"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || upgrading}
                    onClick={() => upgrade(tier.id as PaidPlanId)}
                  >
                    {isCurrent
                      ? "Current plan"
                      : upgrading && pendingPlan === tier.id
                        ? "Starting checkout…"
                        : state.plan === "free"
                          ? `Start ${TRIAL_DAYS}-day trial`
                          : `Switch to ${tier.name}`}
                  </Button>
                ) : (
                  <Button className="mt-5 w-full" size="sm" variant="outline" asChild>
                    <a href={SALES_HREF}>Contact sales</a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {state.stripeEnabled
            ? `Starter and Growth open with a ${TRIAL_DAYS}-day free trial — no card is collected until it ends. Payments are processed securely by Stripe; cancellations take effect at the end of the billing period.`
            : `Stripe keys aren't configured, so plans start a simulated ${TRIAL_DAYS}-day trial in dev mode without payment. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to charge real cards.`}
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
