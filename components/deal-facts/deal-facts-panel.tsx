"use client";

import { useState, useTransition } from "react";
import { Check, CircleHelp, Loader2, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  FACT_KINDS,
  FACT_LABEL,
  FACT_UNKNOWN,
  FACT_UNKNOWN_HINT,
  SOURCE_LABEL,
  type FactKind,
  type FactSource,
  type FactStatus,
} from "@/lib/deal-facts/kinds";
import {
  confirmFact,
  correctFact,
  rejectFact,
} from "@/app/(app)/opportunities/fact-actions";

/**
 * What Selryn knows about this proposal, and how surely.
 *
 * The three states are rendered differently on purpose. A confirmed fact
 * reads as settled, a suggestion reads as a question with the controls to
 * answer it, and an unknown says plainly that nothing has been recorded —
 * never an empty cell that might be a zero or might be a bug.
 *
 * An unknown reads "Unknown", with a second line saying nothing has been
 * written down. It used to read "None open" and "Never discussed on record",
 * which are findings about the buyer rather than about the record: reading
 * these out of a conversation is not implemented, so an empty row means
 * nobody has typed it in. The rows are a place for a seller to keep what they
 * know, and the panel now says so instead of implying Selryn read the thread.
 */

export interface FactRow {
  id: string;
  kind: FactKind;
  value: string;
  status: FactStatus;
  sourceKind: FactSource;
  correctedFrom: string | null;
  stale: boolean;
}

export function DealFactsPanel({
  opportunityId,
  facts,
  canEdit,
}: {
  opportunityId: string;
  facts: FactRow[];
  /** False for viewers — the panel still reads, it just cannot be changed. */
  canEdit: boolean;
}) {
  const byKind = new Map(facts.map((f) => [f.kind, f]));

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">What we know about this proposal</h2>
        <span className="text-[11px] text-muted-foreground">
          Confirmed · Suggested · Unknown
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Kept by hand for now. Selryn does not yet read these out of your email,
        so anything it has not been told stays Unknown rather than being
        guessed at.
      </p>

      <dl className="mt-4 divide-y divide-border/60">
        {FACT_KINDS.map((kind) => (
          <FactLine
            key={kind}
            kind={kind}
            fact={byKind.get(kind) ?? null}
            opportunityId={opportunityId}
            canEdit={canEdit}
          />
        ))}
      </dl>
    </section>
  );
}

function FactLine({
  kind,
  fact,
  opportunityId,
  canEdit,
}: {
  kind: FactKind;
  fact: FactRow | null;
  opportunityId: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fact?.value ?? "");
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(success);
        setEditing(false);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
      <dt className="w-full text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:w-44 sm:shrink-0">
        {FACT_LABEL[kind]}
      </dt>

      <dd className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={value}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              placeholder={FACT_UNKNOWN_HINT[kind]}
              className="h-8 max-w-sm"
            />
            <Button
              size="sm"
              disabled={pending || !value.trim()}
              onClick={() =>
                run(
                  () => correctFact({ factId: fact?.id, opportunityId, kind, value }),
                  "Saved."
                )
              }
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : fact ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm">{fact.value}</span>

            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
                fact.status === "CONFIRMED"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border-primary/30 bg-accent text-accent-foreground"
              )}
            >
              {fact.status === "CONFIRMED" ? (
                <Check className="size-2.5" strokeWidth={3} />
              ) : (
                <Sparkles className="size-2.5" />
              )}
              {fact.status === "CONFIRMED" ? "Confirmed" : "Suggested"}
            </span>

            <span className="text-[11px] text-muted-foreground">
              {SOURCE_LABEL[fact.sourceKind]}
              {fact.stale && " · may be out of date"}
            </span>

            {fact.correctedFrom && (
              <span className="text-[11px] text-muted-foreground">
                (you changed this from “{fact.correctedFrom}”)
              </span>
            )}
          </div>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CircleHelp className="size-3.5" />
              {FACT_UNKNOWN}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {FACT_UNKNOWN_HINT[kind]}
            </span>
          </span>
        )}
      </dd>

      {canEdit && !editing && (
        <div className="flex shrink-0 items-center gap-1">
          {fact?.status === "SUGGESTED" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => confirmFact({ factId: fact.id }), "Confirmed.")}
                title="This is right"
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(() => rejectFact({ factId: fact.id }), "Removed from this deal.")
                }
                title="There is nothing to record here"
              >
                <X className="size-3.5" />
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setValue(fact?.value ?? "");
              setEditing(true);
            }}
            title={fact ? "Correct this" : "Add it"}
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
