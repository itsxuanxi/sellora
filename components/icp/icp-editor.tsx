"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Eye, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { IcpProfile } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { refineIcp, setAutonomy, updateIcp } from "@/app/(app)/icp/actions";

const AUTONOMY = [
  { value: "suggest", icon: Eye, label: "Suggest only" },
  { value: "approve", icon: ShieldCheck, label: "Approval required" },
  { value: "autopilot", icon: Bot, label: "Autopilot" },
] as const;

export function IcpEditor({ icp }: { icp: IcpProfile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    offering: icp.offering ?? "",
    idealCustomer: icp.idealCustomer ?? "",
    industries: icp.industries ?? "",
    regions: icp.regions ?? "",
    companySizes: icp.companySizes ?? "",
    buyerTitles: icp.buyerTitles ?? "",
    signals: icp.signals ?? "",
    exclusions: icp.exclusions ?? "",
    dealValueMin: icp.dealValueMin?.toString() ?? "",
    dealValueMax: icp.dealValueMax?.toString() ?? "",
  });
  const [instruction, setInstruction] = useState("");
  const [saving, startSave] = useTransition();
  const [refining, startRefine] = useTransition();
  const [switching, startSwitch] = useTransition();

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function save() {
    startSave(async () => {
      const result = await updateIcp({
        offering: form.offering,
        idealCustomer: form.idealCustomer,
        industries: form.industries,
        regions: form.regions,
        companySizes: form.companySizes,
        buyerTitles: form.buyerTitles,
        signals: form.signals,
        exclusions: form.exclusions,
        dealValueMin: form.dealValueMin ? parseInt(form.dealValueMin, 10) : null,
        dealValueMax: form.dealValueMax ? parseInt(form.dealValueMax, 10) : null,
      });
      if (result.ok) toast.success("ICP saved — future scoring uses the new criteria");
      else toast.error(result.error);
    });
  }

  function refine() {
    startRefine(async () => {
      const result = await refineIcp(instruction);
      if (result.ok) {
        toast.success(
          result.data.source === "openai"
            ? "ICP updated by GPT"
            : "Saved — natural-language refinement needs an OpenAI key"
        );
        setInstruction("");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* NL refine */}
      <div className="rounded-2xl border border-primary/20 bg-accent/30 p-5">
        <Label htmlFor="icp-nl" className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          Refine in plain language
        </Label>
        <div className="mt-3 flex gap-2">
          <Input
            id="icp-nl"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "Also target legal firms in Canada, exclude companies under 10 people"'
            onKeyDown={(e) => e.key === "Enter" && !refining && refine()}
          />
          <Button onClick={refine} disabled={refining || !instruction.trim()} className="shrink-0">
            {refining ? "Applying…" : "Apply"}
          </Button>
        </div>
      </div>

      {/* Structured fields */}
      <div className="rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold">Profile</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="icp-offering">What you sell</Label>
            <Textarea
              id="icp-offering"
              value={form.offering}
              onChange={(e) => set("offering")(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="icp-ideal">Ideal customer (your words)</Label>
            <Textarea
              id="icp-ideal"
              value={form.idealCustomer}
              onChange={(e) => set("idealCustomer")(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["industries", "Industries", "IT services, Consulting, …"],
                ["regions", "Regions", "United States, Canada"],
                ["companySizes", "Company sizes", "5-50, 51-200"],
                ["buyerTitles", "Buyer titles", "Founder, CEO, Head of Ops"],
                ["signals", "Buying signals", "Hiring sales roles, Recently funded"],
                ["exclusions", "Exclusions", "Enterprises, B2C-only"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`icp-${key}`}>{label}</Label>
                <Input
                  id={`icp-${key}`}
                  value={form[key]}
                  onChange={(e) => set(key)(e.target.value)}
                  placeholder={placeholder}
                />
                <p className="text-[11px] text-muted-foreground">Comma-separated</p>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="icp-min">Deal value from ($)</Label>
              <Input
                id="icp-min"
                type="number"
                min="0"
                value={form.dealValueMin}
                onChange={(e) => set("dealValueMin")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="icp-max">Deal value to ($)</Label>
              <Input
                id="icp-max"
                type="number"
                min="0"
                value={form.dealValueMax}
                onChange={(e) => set("dealValueMax")(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save ICP"}
            </Button>
          </div>
        </div>
      </div>

      {/* Autonomy */}
      <div className="rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="text-sm font-semibold">Agent permissions</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Controls what the agent may do without you. Applies to all queued work.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {AUTONOMY.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={switching}
              onClick={() =>
                startSwitch(async () => {
                  const result = await setAutonomy(option.value);
                  if (result.ok) {
                    toast.success(`Agent mode: ${option.label}`);
                    router.refresh();
                  } else toast.error(result.error);
                })
              }
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-3.5 text-left text-sm transition-all",
                icp.autonomy === option.value
                  ? "border-primary/50 bg-accent/40 font-medium ring-1 ring-primary/30"
                  : "border-border/70 hover:bg-muted/40"
              )}
            >
              <option.icon
                className={cn(
                  "size-4",
                  icp.autonomy === option.value ? "text-primary" : "text-muted-foreground"
                )}
              />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {icp.aiNotes && (
        <div className="rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            Targeting notes
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
            {icp.aiNotes}
          </p>
        </div>
      )}
    </div>
  );
}
