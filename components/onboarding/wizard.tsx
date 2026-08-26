"use client";

import { useState, useTransition } from "react";
import { Bot, ChevronLeft, Eye, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  completeBusinessOnboarding,
  skipBusinessOnboarding,
} from "@/app/onboarding/actions";

const AUTONOMY_OPTIONS = [
  {
    value: "suggest" as const,
    icon: Eye,
    title: "Suggest only",
    body: "The agent researches and drafts, but never acts. You review everything.",
  },
  {
    value: "approve" as const,
    icon: ShieldCheck,
    title: "Approval required",
    body: "The agent queues actions; nothing executes until you approve. Recommended.",
    recommended: true,
  },
  {
    value: "autopilot" as const,
    icon: Bot,
    title: "Autopilot",
    body: "The agent executes on its own within your limits. Every action is audited and reversible where possible.",
  },
];

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [skipping, startSkip] = useTransition();
  const [form, setForm] = useState({
    offering: "",
    idealCustomer: "",
    dealValueMin: "",
    dealValueMax: "",
    regionsRaw: "",
    autonomy: "approve" as "suggest" | "approve" | "autopilot",
  });

  const steps = ["What you sell", "Deal profile", "Agent permissions"];

  function next() {
    if (step === 0 && (!form.offering.trim() || !form.idealCustomer.trim())) {
      toast.error("Both fields help the AI build an accurate profile.");
      return;
    }
    setStep((s) => s + 1);
  }

  function submit() {
    startTransition(async () => {
      const result = await completeBusinessOnboarding({
        offering: form.offering,
        idealCustomer: form.idealCustomer,
        dealValueMin: form.dealValueMin ? parseInt(form.dealValueMin, 10) : null,
        dealValueMax: form.dealValueMax ? parseInt(form.dealValueMax, 10) : null,
        regionsRaw: form.regionsRaw,
        autonomy: form.autonomy,
      });
      // On success the action redirects; only failures return.
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="w-full max-w-xl">
      {/* progress */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
            <span
              className={cn(
                "text-[11px]",
                i === step ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-8 shadow-sm">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                What does your business sell?
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                The agent uses this to research accounts and write outreach in
                your context.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-offering">Your offering</Label>
              <Textarea
                id="ob-offering"
                value={form.offering}
                onChange={(e) => setForm((f) => ({ ...f, offering: e.target.value }))}
                placeholder="e.g. We're a cybersecurity services firm — managed detection, compliance audits, and incident response for mid-market companies."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-ideal">Who&apos;s your ideal customer?</Label>
              <Textarea
                id="ob-ideal"
                value={form.idealCustomer}
                onChange={(e) =>
                  setForm((f) => ({ ...f, idealCustomer: e.target.value }))
                }
                placeholder="e.g. 20-200 person companies handling sensitive data — fintech, healthcare, legal — whose IT lead reports to the CEO. Our best deals come from firms that just failed an audit."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Describe your best past customers — the AI turns this into a
                structured, editable profile.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                What does a typical deal look like?
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Used for pipeline value estimates and to calibrate how much
                research each account deserves.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ob-min">Deal value from ($)</Label>
                <Input
                  id="ob-min"
                  type="number"
                  min="0"
                  value={form.dealValueMin}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dealValueMin: e.target.value }))
                  }
                  placeholder="5,000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-max">to ($)</Label>
                <Input
                  id="ob-max"
                  type="number"
                  min="0"
                  value={form.dealValueMax}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dealValueMax: e.target.value }))
                  }
                  placeholder="50,000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-regions">Regions you serve</Label>
              <Input
                id="ob-regions"
                value={form.regionsRaw}
                onChange={(e) => setForm((f) => ({ ...f, regionsRaw: e.target.value }))}
                placeholder="e.g. United States, Canada — or specific states/cities"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                How much should the agent do on its own?
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                You can change this anytime in the ICP settings.
              </p>
            </div>
            <div className="space-y-2.5">
              {AUTONOMY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, autonomy: option.value }))}
                  className={cn(
                    "flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-all",
                    form.autonomy === option.value
                      ? "border-primary/50 bg-accent/40 ring-1 ring-primary/30"
                      : "border-border/70 hover:border-border hover:bg-muted/40"
                  )}
                >
                  <option.icon
                    className={cn(
                      "mt-0.5 size-5 shrink-0",
                      form.autonomy === option.value
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {option.title}
                      {option.recommended && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {option.body}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
              <ChevronLeft className="size-4" />
              Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              disabled={pending || skipping}
              onClick={() => startSkip(() => skipBusinessOnboarding())}
            >
              {skipping ? "Skipping…" : "Skip for now"}
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={submit} disabled={pending} className="gap-2">
              <Sparkles className="size-4" />
              {pending ? "Building your ICP…" : "Generate my ICP"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
