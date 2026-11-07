"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  ChevronLeft,
  Database,
  Eye,
  FlaskConical,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
import { loadSampleDataAction } from "@/app/(app)/sample-actions";

/**
 * What Selryn may do without being asked.
 *
 * Every mode here governs internal work only — researching an account and
 * scoring it. None of them can send anything: `createAgentAction` executes
 * exactly two action types, `research_account` and `score_account`, and no
 * code path anywhere creates an outbound-email action. A follow-up reaches a
 * buyer only when a person approves that specific draft on the deal.
 *
 * Which is why the third option is no longer called "Autopilot" and no
 * longer says "the agent executes on its own within your limits". Read on
 * this screen, that promised autonomous outbound — the one thing it could
 * never mean, and the thing this product is not. The stored value is still
 * "autopilot" so nobody's workspace needs migrating.
 */
const AUTONOMY_OPTIONS = [
  {
    value: "suggest" as const,
    icon: Eye,
    title: "Suggest only",
    body: "Selryn prepares research and scores, and runs nothing until you ask it to.",
  },
  {
    value: "approve" as const,
    icon: ShieldCheck,
    title: "Approval required",
    body: "Research and scoring queue for you to approve first. Recommended.",
    recommended: true,
  },
  {
    value: "autopilot" as const,
    icon: Bot,
    title: "Research without asking",
    body: "Account research and scoring run as soon as a deal arrives. Follow-ups still wait for your approval — in every mode.",
  },
];

export function OnboardingWizard() {
  // Nothing about the workspace is decided until this is answered, because
  // the two branches want different things: sample data brings its own ICP
  // and needs no questions, real data needs the profile the agent scores on.
  const [source, setSource] = useState<"sample" | "real" | null>(null);
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

  const steps = ["What you sell", "Deal profile", "What runs on its own"];

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

  if (source === null) {
    return <DataSourceStep onChoose={setSource} />;
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
                Selryn uses this to research accounts and draft follow-ups in
                your words.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-offering">Your offering</Label>
              <Textarea
                id="ob-offering"
                value={form.offering}
                onChange={(e) => setForm((f) => ({ ...f, offering: e.target.value }))}
                placeholder="e.g. We're a six-person brand studio — positioning, identity and website builds, usually a 6-10 week engagement."
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
                placeholder="e.g. Series A to B companies, 20-200 people, where a founder or a head of marketing owns the budget. Our best projects come from referrals and from teams about to launch something."
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
                What should Selryn do without asking?
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                This covers research and scoring only. Nothing is ever sent to
                a customer without your approval. Changeable at any time.
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

/**
 * The fork every new workspace starts at.
 *
 * Offering sample data up front is what lets someone evaluate Selryn before
 * they have connected anything — and because the sample rows are tagged, the
 * decision is reversible from the banner on every screen afterwards.
 */
function DataSourceStep({
  onChoose,
}: {
  onChoose: (source: "sample" | "real") => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function loadSample() {
    startTransition(async () => {
      const result = await loadSampleDataAction();
      if (!result.ok) {
        toast.error(result.error ?? "Could not load the sample data.");
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <div className="w-full max-w-xl">
      <div className="rounded-2xl border border-border/70 bg-card p-8 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight">
          How do you want to start?
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Both lead to the same product. Sample data lets you judge it in a
          minute; you can clear it in one click whenever you like.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={loadSample}
            disabled={pending}
            className="flex w-full gap-4 rounded-xl border border-border/70 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
              {pending ? (
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
              ) : (
                <FlaskConical className="size-4 text-primary" aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-medium">
                {pending ? "Loading sample data…" : "Load sample data"}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Nine invented companies with signals, scores, recommendations
                and buyer responses — the whole loop, working. Nothing is ever
                sent to them, and every screen says so.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChoose("real")}
            disabled={pending}
            className="flex w-full gap-4 rounded-xl border border-border/70 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
              <Database className="size-4 text-primary" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">Connect real data</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Tell Selryn what you sell and who you sell to, then import your
                pipeline from a spreadsheet or connect a CRM.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
