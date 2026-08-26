"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SIGNAL_LABELS, SIGNAL_TYPES, DEFAULT_MIN_INTENT_SCORE, DEFAULT_DAILY_RECOMMENDATIONS } from "@/lib/intent/config";
import { TONES } from "@/lib/constants";
import { createIntentCampaign } from "@/app/(app)/intent/actions";

export function CampaignForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [industries, setIndustries] = useState("");
  const [regions, setRegions] = useState("United States, Canada");
  const [companySizes, setCompanySizes] = useState("");
  const [targetTitles, setTargetTitles] = useState("");
  const [mustHave, setMustHave] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [signalTypes, setSignalTypes] = useState<string[]>([...SIGNAL_TYPES]);
  const [minIntentScore, setMinIntentScore] = useState(DEFAULT_MIN_INTENT_SCORE);
  const [tone, setTone] = useState<(typeof TONES)[number]>("professional");
  const [cta, setCta] = useState("");
  const [dailyRecommendations, setDailyRecommendations] = useState(DEFAULT_DAILY_RECOMMENDATIONS);

  function toggleSignal(type: string) {
    setSignalTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the campaign a name.");
      return;
    }
    startTransition(async () => {
      const result = await createIntentCampaign({
        name,
        industries,
        regions,
        companySizes,
        targetTitles,
        mustHave,
        exclusions,
        signalTypes,
        minIntentScore,
        tone,
        cta,
        dailyRecommendations,
        requireApproval: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Intent Campaign created.");
      router.push(`/intent/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-8">
      <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="font-medium">Basics</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Campaign name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="US & Canada recruiting firms"
            required
          />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="font-medium">Targeting</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="industries">Target industries</Label>
            <Input
              id="industries"
              value={industries}
              onChange={(e) => setIndustries(e.target.value)}
              placeholder="Staffing, recruiting, HR services"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="regions">Regions</Label>
            <Input
              id="regions"
              value={regions}
              onChange={(e) => setRegions(e.target.value)}
              placeholder="United States, Canada"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companySizes">Company sizes</Label>
            <Input
              id="companySizes"
              value={companySizes}
              onChange={(e) => setCompanySizes(e.target.value)}
              placeholder="11-50, 51-200, 201-1000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="targetTitles">Target job titles at prospects</Label>
            <Input
              id="targetTitles"
              value={targetTitles}
              onChange={(e) => setTargetTitles(e.target.value)}
              placeholder="CEO, Head of Talent, VP People"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mustHave">Must-have conditions</Label>
            <Textarea
              id="mustHave"
              value={mustHave}
              onChange={(e) => setMustHave(e.target.value)}
              rows={2}
              placeholder="Actively hiring in the last 30 days"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exclusions">Exclusions</Label>
            <Textarea
              id="exclusions"
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
              rows={2}
              placeholder="Existing customers, staffing agencies themselves"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="font-medium">Signals to consider</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {SIGNAL_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2.5 text-sm">
              <Checkbox
                checked={signalTypes.includes(type)}
                onCheckedChange={() => toggleSignal(type)}
              />
              {SIGNAL_LABELS[type]}
            </label>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minScore">Minimum Intent Score to surface ({minIntentScore})</Label>
          <input
            id="minScore"
            type="range"
            min={0}
            max={100}
            value={minIntentScore}
            onChange={(e) => setMinIntentScore(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="font-medium">Outreach defaults</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as (typeof TONES)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta">Call to action</Label>
            <Input
              id="cta"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Worth a 15-minute call this week?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="daily">Daily recommendations</Label>
            <Input
              id="daily"
              type="number"
              min={1}
              max={200}
              value={dailyRecommendations}
              onChange={(e) => setDailyRecommendations(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end gap-2 pb-2 text-sm text-muted-foreground">
            Every send always requires your explicit approval — that
            isn&apos;t optional in this version.
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Creating…" : "Create Intent Campaign"}
      </Button>
    </form>
  );
}
