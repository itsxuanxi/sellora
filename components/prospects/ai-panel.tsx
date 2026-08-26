"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, RefreshCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Personalization } from "@/lib/ai";
import {
  generateProspectAI,
  savePersonalization,
} from "@/app/(app)/prospects/actions";

const EMPTY: Personalization = {
  companySummary: "",
  icebreaker: "",
  outreachAngle: "",
  coldEmailSubject: "",
  coldEmailBody: "",
  linkedinMessage: "",
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(`${label} copied`);
        setTimeout(() => setCopied(false), 1500);
      }}
      disabled={!text}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

export function AiPanel({
  prospectId,
  prospectName,
  initial,
  generatedAt,
}: {
  prospectId: string;
  prospectName: string;
  initial: Personalization | null;
  generatedAt: Date | null;
}) {
  const [fields, setFields] = useState<Personalization>(initial ?? EMPTY);
  const [saved, setSaved] = useState<Personalization>(initial ?? EMPTY);
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();

  const hasContent = Object.values(fields).some(Boolean);
  const dirty = useMemo(
    () => JSON.stringify(fields) !== JSON.stringify(saved),
    [fields, saved]
  );

  const set = (key: keyof Personalization) => (value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  function generate() {
    startGenerate(async () => {
      const result = await generateProspectAI(prospectId);
      if (result.ok) {
        setFields(result.data.personalization);
        setSaved(result.data.personalization);
        toast.success(`Personalization generated for ${prospectName}`, {
          description:
            result.data.source === "openai"
              ? "Written by GPT from the prospect's profile."
              : "Generated locally — add an OpenAI API key in Settings for GPT-written copy.",
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  function save() {
    startSave(async () => {
      const result = await savePersonalization(prospectId, fields);
      if (result.ok) {
        setSaved(fields);
        toast.success("Edits saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            AI Personalization
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {generatedAt
              ? `Generated ${formatDistanceToNow(generatedAt, { addSuffix: true })} — everything is editable.`
              : "One click writes the whole outreach kit. Everything stays editable."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <Button size="sm" onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving…" : dirty ? "Save edits" : "Saved"}
            </Button>
          )}
          <Button
            size="sm"
            variant={hasContent ? "outline" : "default"}
            onClick={generate}
            disabled={generating}
            className="gap-1.5"
          >
            <RefreshCcw className={`size-3.5 ${generating ? "animate-spin" : ""}`} />
            {generating
              ? "Generating…"
              : hasContent
                ? "Regenerate"
                : "Generate with AI"}
          </Button>
        </div>
      </div>

      {!hasContent && !generating ? (
        <div className="px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent">
            <Sparkles className="size-6 text-accent-foreground" />
          </div>
          <h3 className="text-sm font-semibold">Nothing generated yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Sellora will write a company summary, icebreaker, outreach angle,
            cold email, and LinkedIn message tailored to {prospectName}.
          </p>
        </div>
      ) : (
        <div className="space-y-5 p-5">
          {generating && (
            <p className="rounded-lg bg-accent/60 px-3 py-2 text-xs text-accent-foreground">
              Writing personalized outreach for {prospectName}…
            </p>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ai-summary">Company summary</Label>
                <CopyButton text={fields.companySummary} label="Company summary" />
              </div>
              <Textarea
                id="ai-summary"
                value={fields.companySummary}
                onChange={(e) => set("companySummary")(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ai-angle">Outreach angle</Label>
                <CopyButton text={fields.outreachAngle} label="Outreach angle" />
              </div>
              <Textarea
                id="ai-angle"
                value={fields.outreachAngle}
                onChange={(e) => set("outreachAngle")(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-icebreaker">Icebreaker</Label>
              <CopyButton text={fields.icebreaker} label="Icebreaker" />
            </div>
            <Textarea
              id="ai-icebreaker"
              value={fields.icebreaker}
              onChange={(e) => set("icebreaker")(e.target.value)}
              rows={2}
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">Cold email</h3>
              <CopyButton
                text={`Subject: ${fields.coldEmailSubject}\n\n${fields.coldEmailBody}`}
                label="Cold email"
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ai-subject" className="text-xs text-muted-foreground">
                  Subject
                </Label>
                <Input
                  id="ai-subject"
                  value={fields.coldEmailSubject}
                  onChange={(e) => set("coldEmailSubject")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-body" className="text-xs text-muted-foreground">
                  Body
                </Label>
                <Textarea
                  id="ai-body"
                  value={fields.coldEmailBody}
                  onChange={(e) => set("coldEmailBody")(e.target.value)}
                  rows={9}
                  className="font-mono text-[13px] leading-relaxed"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-linkedin">
                LinkedIn message{" "}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {fields.linkedinMessage.length}/300
                </span>
              </Label>
              <CopyButton text={fields.linkedinMessage} label="LinkedIn message" />
            </div>
            <Textarea
              id="ai-linkedin"
              value={fields.linkedinMessage}
              onChange={(e) => set("linkedinMessage")(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}
