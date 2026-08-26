"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { Lightbulb, RefreshCcw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Email, FollowUp, Prospect } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  generateFollowUpSequence,
  sendFollowUp,
  updateFollowUpContent,
} from "@/app/(app)/campaigns/actions";

const TONE_STYLE: Record<string, string> = {
  friendly: "bg-sky-50 text-sky-700",
  direct: "bg-amber-50 text-amber-700",
  witty: "bg-violet-50 text-violet-700",
  professional: "bg-slate-100 text-slate-700",
};

function FollowUpCard({
  followUp,
  disabled,
}: {
  followUp: FollowUp;
  disabled: boolean;
}) {
  const [subject, setSubject] = useState(followUp.subject);
  const [body, setBody] = useState(followUp.body);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();

  useEffect(() => {
    setSubject(followUp.subject);
    setBody(followUp.body);
  }, [followUp]);

  const isSent = followUp.status === "SENT";
  const dirty = subject !== followUp.subject || body !== followUp.body;

  function save() {
    startSave(async () => {
      const result = await updateFollowUpContent(followUp.id, { subject, body });
      if (result.ok) toast.success(`Follow-up #${followUp.sequence} saved`);
      else toast.error(result.error);
    });
  }

  function send() {
    startSend(async () => {
      if (dirty) {
        const saved = await updateFollowUpContent(followUp.id, { subject, body });
        if (!saved.ok) {
          toast.error(saved.error);
          return;
        }
      }
      const result = await sendFollowUp(followUp.id);
      if (result.ok) {
        toast.success(
          result.data.simulated
            ? `Follow-up #${followUp.sequence} send simulated (no Resend key)`
            : `Follow-up #${followUp.sequence} sent`
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            Follow-up {followUp.sequence}
          </span>
          <Badge
            variant="secondary"
            className={`font-normal capitalize ${TONE_STYLE[followUp.tone] ?? ""}`}
          >
            {followUp.tone}
          </Badge>
        </div>
        {isSent ? (
          <span className="text-xs text-muted-foreground">
            Sent {followUp.sentAt ? format(followUp.sentAt, "MMM d") : ""}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={save}
              disabled={!dirty || saving || sending || disabled}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              onClick={send}
              disabled={saving || sending || disabled}
              className="gap-1.5"
            >
              <Send className="size-3" />
              {sending ? "Sending…" : "Send now"}
            </Button>
          </div>
        )}
      </div>

      {followUp.cta && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-accent/50 px-3 py-2 text-xs text-accent-foreground">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
          CTA strategy: {followUp.cta}
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={isSent || disabled}
          aria-label={`Follow-up ${followUp.sequence} subject`}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isSent || disabled}
          rows={7}
          className="font-mono text-[13px] leading-relaxed"
          aria-label={`Follow-up ${followUp.sequence} body`}
        />
      </div>
    </div>
  );
}

export function FollowUpsSheet({
  email,
  onClose,
}: {
  email: (Email & { prospect: Prospect; followUps: FollowUp[] }) | null;
  onClose: () => void;
}) {
  const [generating, startGenerate] = useTransition();

  if (!email) return null;

  const replied = email.status === "REPLIED";
  const followUps = [...email.followUps].sort((a, b) => a.sequence - b.sequence);

  function generate() {
    startGenerate(async () => {
      const result = await generateFollowUpSequence(email!.id);
      if (result.ok) {
        toast.success("3-step follow-up sequence generated", {
          description:
            result.data.source === "openai"
              ? "Written by GPT with escalating tones."
              : "Generated locally — add an OpenAI key in Settings for GPT copy.",
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border/60">
          <SheetTitle>Follow-ups · {email.prospect.name}</SheetTitle>
          <SheetDescription>
            Three automatic touches with escalating tones. The sequence stops
            the moment {email.prospect.name.split(" ")[0]} replies.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4">
          {replied && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              🎉 {email.prospect.name.split(" ")[0]} replied — the follow-up
              sequence has been stopped.
            </div>
          )}

          {followUps.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent">
                <Sparkles className="size-6 text-accent-foreground" />
              </div>
              <h3 className="text-sm font-semibold">No follow-ups yet</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                Generate a 3-step sequence: a friendly bump, a direct yes/no
                question, and a graceful breakup — each with its own CTA
                strategy.
              </p>
              <Button
                className="mt-5 gap-2"
                onClick={generate}
                disabled={generating || replied}
              >
                <Sparkles className="size-4" />
                {generating ? "Generating…" : "Generate sequence"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generate}
                  disabled={generating || replied}
                  className="gap-1.5"
                >
                  <RefreshCcw
                    className={`size-3.5 ${generating ? "animate-spin" : ""}`}
                  />
                  {generating ? "Regenerating…" : "Regenerate drafts"}
                </Button>
              </div>
              {followUps.map((followUp) => (
                <FollowUpCard
                  key={followUp.id}
                  followUp={followUp}
                  disabled={replied}
                />
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
