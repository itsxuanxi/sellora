"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  draftFollowUp,
  editFollowUpDraft,
  sendFollowUp,
  type DraftView,
} from "@/app/(app)/dashboard/followup-actions";
import type { FollowUpRule } from "@/lib/followup/rules";

/**
 * Writing and sending one follow-up.
 *
 * Nothing here sends on its own. The draft is generated when the dialog
 * opens, the seller can rewrite any of it, and the mail goes out only when
 * they press Send — which passes the exact text on screen back to the server,
 * so what is sent is provably what was read.
 */
export function DraftDialog({
  open,
  onOpenChange,
  opportunityId,
  rule,
  accountName,
  contactName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  rule: FollowUpRule;
  accountName: string;
  contactName: string | null;
}) {
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [sending, startSend] = useTransition();

  function load(regenerate = false) {
    setError(null);
    startLoad(async () => {
      const result = await draftFollowUp({ opportunityId, rule, regenerate });
      if (!result.ok) {
        setError(result.error);
        setDraft(null);
        return;
      }
      setDraft(result.data);
      setSubject(result.data.subject);
      setBody(result.data.body);
    });
  }

  useEffect(() => {
    if (open && !draft) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = draft !== null && (subject !== draft.subject || body !== draft.body);

  function send() {
    if (!draft) return;
    setError(null);
    startSend(async () => {
      // Save edits first, so the text the server compares against is the text
      // on screen. Sending with a stale draft is refused rather than guessed.
      if (dirty) {
        const saved = await editFollowUpDraft({ draftId: draft.id, subject, body });
        if (!saved.ok) {
          setError(saved.error);
          return;
        }
      }
      const result = await sendFollowUp({
        draftId: draft.id,
        subject,
        body,
        confirmed: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.data);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Follow up with {accountName}</DialogTitle>
          <DialogDescription>
            Nothing is sent until you press Send. Review the text first — it is
            written from this deal&rsquo;s history, and it can be wrong.
          </DialogDescription>
        </DialogHeader>

        {loading && !draft ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Writing a draft from this deal&rsquo;s history…
          </div>
        ) : error && !draft ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        ) : draft ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-2.5 text-[13px]">
              <span className="text-muted-foreground">To: </span>
              <span className="font-medium">
                {contactName ? `${contactName} · ` : ""}
                {draft.toAddress}
              </span>
            </div>

            {draft.warnings.length > 0 && (
              <ul className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
                {draft.warnings.map((w) => (
                  <li
                    key={w}
                    className="flex gap-2 text-[13px] leading-snug text-amber-900 dark:text-amber-300"
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="fu-subject">Subject</Label>
              <Input
                id="fu-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fu-body">Message</Label>
              <Textarea
                id="fu-body"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-normal"
              />
            </div>

            {error && (
              <p className="text-[13px] text-rose-700 dark:text-rose-400">{error}</p>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            disabled={loading || sending}
            onClick={() => load(true)}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Write a different one
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!draft || sending || loading} onClick={send}>
              {sending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Send
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
