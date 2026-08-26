"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markFeedback } from "@/app/(app)/intent/actions";
import type { FeedbackLabel } from "@/lib/intent/feedback";

const OPTIONS: { label: FeedbackLabel; text: string }[] = [
  { label: "relevant", text: "Relevant" },
  { label: "not_relevant", text: "Not relevant" },
  { label: "meeting_booked", text: "Meeting booked" },
  { label: "qualified", text: "Qualified" },
  { label: "won", text: "Won" },
];

export function FeedbackButtons({
  accountId,
  draftId,
}: {
  accountId: string;
  draftId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle(label: FeedbackLabel) {
    startTransition(async () => {
      const result = await markFeedback(accountId, label, draftId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Marked ${label.replace("_", " ")}.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {OPTIONS.map((o) => (
        <button
          key={o.label}
          type="button"
          disabled={pending}
          onClick={() => handle(o.label)}
          className={cn(
            "rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground transition-colors",
            "hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          )}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}
