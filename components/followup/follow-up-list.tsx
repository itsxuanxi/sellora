"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FollowUpCard, type FollowUpCardData } from "@/components/followup/follow-up-card";

/**
 * Everything below the three the page leads with.
 *
 * Collapsed by default and counted in the label, so the rest of the list is
 * visibly there rather than silently truncated — a seller who cannot tell
 * whether they are seeing everything stops trusting the three at the top.
 */
export function FollowUpList({
  items,
  total,
}: {
  items: FollowUpCardData[];
  total: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-8" aria-label="All follow-ups">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40"
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        {open ? "Hide" : "Show"} the other {items.length}
        <span className="font-normal text-muted-foreground">of {total} waiting on you</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <FollowUpCard key={item.opportunityId} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
