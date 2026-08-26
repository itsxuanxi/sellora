"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  approveDraft,
  editDraftAction,
  generateDraft,
  rejectDraftAction,
} from "@/app/(app)/intent/actions";

interface DraftLike {
  id: string;
  subject: string;
  body: string;
  status: string;
  insufficientEvidence: boolean;
  aiSource: string | null;
}

export function DraftActions({
  accountId,
  campaignId,
  draft,
}: {
  accountId: string;
  campaignId: string;
  draft: DraftLike | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");

  function handleGenerate() {
    if (!campaignId) {
      toast.error("This company isn't linked to a campaign yet.");
      return;
    }
    startTransition(async () => {
      const result = await generateDraft(campaignId, accountId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Draft outreach generated — review before sending.");
      router.refresh();
    });
  }

  function handleApprove() {
    if (!draft) return;
    startTransition(async () => {
      const result = await approveDraft(draft.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sent (or simulated — connect Resend to send for real).");
      setOpen(false);
      router.refresh();
    });
  }

  function handleReject() {
    if (!draft) return;
    startTransition(async () => {
      const result = await rejectDraftAction(draft.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast("Draft rejected.");
      setOpen(false);
      router.refresh();
    });
  }

  function handleSaveEdits() {
    if (!draft) return;
    startTransition(async () => {
      const result = await editDraftAction(draft.id, subject, body);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Draft updated.");
      router.refresh();
    });
  }

  if (!draft) {
    return (
      <Button size="sm" onClick={handleGenerate} disabled={pending}>
        <Sparkles className="size-4" />
        {pending ? "Drafting…" : "Draft Outreach"}
      </Button>
    );
  }

  if (draft.status !== "DRAFT") {
    return (
      <Badge variant="secondary" className="font-normal">
        Outreach {draft.status.toLowerCase()}
      </Badge>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSubject(draft.subject);
            setBody(draft.body);
            setOpen(true);
          }}
        >
          <Pencil className="size-3.5" />
          Preview
        </Button>
        <Button size="sm" onClick={handleApprove} disabled={pending || draft.insufficientEvidence}>
          <Check className="size-3.5" />
          Approve &amp; Send
        </Button>
        <Button size="sm" variant="ghost" onClick={handleReject} disabled={pending}>
          <X className="size-3.5" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview outreach</DialogTitle>
            <DialogDescription>
              Nothing sends until you approve.{" "}
              {draft.aiSource === "local" && "Generated without an AI key (template fallback)."}
              {draft.insufficientEvidence && (
                <span className="font-medium text-destructive">
                  {" "}Insufficient evidence — this draft cannot be sent.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Body"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleSaveEdits} disabled={pending}>
              Save edits
            </Button>
            <Button variant="ghost" onClick={handleReject} disabled={pending}>
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={pending || draft.insufficientEvidence}>
              Approve &amp; Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
