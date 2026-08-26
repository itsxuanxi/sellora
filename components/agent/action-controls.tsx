"use client";

import { useTransition } from "react";
import { Check, RotateCcw, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  approveAgentAction,
  rejectAgentAction,
  retryAgentAction,
  undoAgentAction,
} from "@/app/(app)/agent/actions";

export const STATUS_STYLE: Record<string, { label: string; badge: string }> = {
  SUGGESTED: { label: "Suggested", badge: "bg-sky-50 text-sky-700" },
  PENDING_APPROVAL: { label: "Needs approval", badge: "bg-amber-50 text-amber-700" },
  RUNNING: { label: "Running", badge: "bg-violet-50 text-violet-700" },
  DONE: { label: "Done", badge: "bg-emerald-50 text-emerald-700" },
  FAILED: { label: "Failed", badge: "bg-rose-50 text-rose-700" },
  CANCELED: { label: "Rejected", badge: "bg-slate-100 text-slate-500" },
  UNDONE: { label: "Undone", badge: "bg-slate-100 text-slate-500" },
};

export function AgentStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.DONE;
  return (
    <Badge variant="secondary" className={cn("shrink-0 font-normal", s.badge)}>
      {status === "RUNNING" && (
        <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-violet-500" />
      )}
      {s.label}
    </Badge>
  );
}

const UNDOABLE_TYPES = ["research_account", "score_account"];

export function ActionControls({
  id,
  status,
  type,
}: {
  id: string;
  status: string;
  type: string;
}) {
  const [pending, startTransition] = useTransition();

  function exec(
    fn: (id: string) => Promise<{ ok: boolean; error?: string }>,
    success: string
  ) {
    startTransition(async () => {
      const result = await fn(id);
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Something went wrong.");
    });
  }

  if (status === "PENDING_APPROVAL" || status === "SUGGESTED") {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className="h-7 gap-1 px-2.5 text-xs"
          disabled={pending}
          onClick={() => exec(approveAgentAction, "Approved — executing")}
        >
          <Check className="size-3" />
          {status === "SUGGESTED" ? "Run" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          disabled={pending}
          onClick={() => exec(rejectAgentAction, "Rejected")}
        >
          <X className="size-3" />
          Reject
        </Button>
      </div>
    );
  }
  if (status === "FAILED") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2.5 text-xs"
        disabled={pending}
        onClick={() => exec(retryAgentAction, "Retrying")}
      >
        <RotateCcw className="size-3" />
        Retry
      </Button>
    );
  }
  if (status === "DONE" && UNDOABLE_TYPES.includes(type)) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground"
        disabled={pending}
        onClick={() => exec(undoAgentAction, "Undone — previous state restored")}
      >
        <Undo2 className="size-3" />
        Undo
      </Button>
    );
  }
  return null;
}
