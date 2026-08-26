"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  dismissRecommendationAction,
  markRecommendationComplete,
  snoozeRecommendationAction,
} from "@/app/(app)/opportunities/actions";

/**
 * Controls on a recommendation. Every branch writes to the ledger — even
 * "Not useful", which is the most informative thing a user can tell Sellora
 * and the one most products throw away.
 */
export function RecommendationActions({
  recommendationId,
  opportunityId,
  compact = false,
}: {
  /** Null when the feed is showing a freshly computed action with no ledger
   * row yet — the server action materializes it from `opportunityId`. */
  recommendationId: string | null;
  opportunityId: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const ref = { recommendationId, opportunityId };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size={compact ? "sm" : "default"}
        variant="outline"
        disabled={pending}
        onClick={() => run(() => markRecommendationComplete(ref), "Marked complete.")}
      >
        <Check className="size-3.5" />
        Mark done
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            aria-label="More options"
          >
            <Clock className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {[1, 3, 7].map((d) => (
            <DropdownMenuItem
              key={d}
              onClick={() =>
                run(
                  () => snoozeRecommendationAction(ref, d),
                  `Snoozed for ${d} day${d === 1 ? "" : "s"}.`
                )
              }
            >
              <Clock className="size-4" />
              Snooze {d} day{d === 1 ? "" : "s"}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() =>
              run(
                () => dismissRecommendationAction(ref, "not_useful"),
                "Dismissed — Sellora will use that."
              )
            }
          >
            <X className="size-4" />
            Not useful
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Workspace-wide refresh: backfill, rescore, regenerate recommendations. */
export function RefreshIntelligenceButton({
  action,
  label = "Refresh intelligence",
}: {
  action: () => Promise<{ ok: boolean; error?: string; data?: { created: number; scored: number } }>;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await action();
          if (res.ok) {
            const d = res.data;
            toast.success(
              d && d.created > 0
                ? `Scored ${d.scored} opportunities · ${d.created} newly created`
                : `Rescored ${d?.scored ?? 0} opportunities`
            );
            router.refresh();
          } else {
            toast.error(res.error ?? "Refresh failed.");
          }
        })
      }
    >
      {pending ? "Analyzing…" : label}
    </Button>
  );
}
