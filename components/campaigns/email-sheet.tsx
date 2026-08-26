"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { RefreshCcw, Send } from "lucide-react";
import { toast } from "sonner";
import type { Email, Prospect } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_STATUS_CONFIG, type EmailStatus } from "@/lib/constants";
import {
  generateEmailForRecipient,
  sendCampaignEmail,
  updateEmailContent,
} from "@/app/(app)/campaigns/actions";

export function EmailSheet({
  email,
  onClose,
}: {
  email: (Email & { prospect: Prospect }) | null;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, startSave] = useTransition();
  const [generating, startGenerate] = useTransition();
  const [sending, startSend] = useTransition();

  useEffect(() => {
    setSubject(email?.subject ?? "");
    setBody(email?.body ?? "");
  }, [email]);

  if (!email) return null;

  const isDraft = email.status === "DRAFT";
  const status =
    EMAIL_STATUS_CONFIG[email.status as EmailStatus] ?? EMAIL_STATUS_CONFIG.DRAFT;
  const dirty = subject !== email.subject || body !== email.body;

  function save() {
    startSave(async () => {
      const result = await updateEmailContent(email!.id, { subject, body });
      if (result.ok) toast.success("Email saved");
      else toast.error(result.error);
    });
  }

  function regenerate() {
    startGenerate(async () => {
      const result = await generateEmailForRecipient(email!.id);
      if (result.ok) {
        setSubject(result.data.draft.subject);
        setBody(result.data.draft.body);
        toast.success("Email regenerated", {
          description:
            result.data.source === "openai"
              ? "Written by GPT."
              : "Generated locally — add an OpenAI key in Settings for GPT copy.",
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  function send() {
    startSend(async () => {
      if (dirty) {
        const saved = await updateEmailContent(email!.id, { subject, body });
        if (!saved.ok) {
          toast.error(saved.error);
          return;
        }
      }
      const result = await sendCampaignEmail(email!.id);
      if (result.ok) {
        toast.success(
          result.data.simulated
            ? "Send simulated (no Resend key configured)"
            : `Email sent to ${email!.prospect.email}`
        );
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  const busy = saving || generating || sending;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border/60">
          <SheetTitle className="flex items-center gap-2.5">
            Email to {email.prospect.name}
            <Badge variant="secondary" className={`font-normal ${status.badge}`}>
              {status.label}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            {isDraft
              ? `To: ${email.prospect.email} — review and edit before sending.`
              : `Sent to ${email.prospect.email}${email.sentAt ? ` on ${format(email.sentAt, "MMM d, yyyy 'at' HH:mm")}` : ""}.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4">
          {isDraft && !subject && !body && (
            <div className="rounded-xl bg-accent/60 px-4 py-3 text-sm text-accent-foreground">
              Nothing written yet — generate a personalized draft or write your
              own.
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={!isDraft}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Body</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={!isDraft}
              rows={16}
              className="font-mono text-[13px] leading-relaxed"
            />
          </div>
        </div>

        {isDraft && (
          <SheetFooter className="border-t border-border/60">
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={regenerate}
                disabled={busy}
                className="gap-1.5"
              >
                <RefreshCcw
                  className={`size-3.5 ${generating ? "animate-spin" : ""}`}
                />
                {generating ? "Generating…" : subject ? "Regenerate" : "Generate"}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={save}
                  disabled={!dirty || busy}
                >
                  {saving ? "Saving…" : "Save draft"}
                </Button>
                <Button
                  size="sm"
                  onClick={send}
                  disabled={busy || (!subject.trim() && !dirty)}
                  className="gap-1.5"
                >
                  <Send className="size-3.5" />
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
