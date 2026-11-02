"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/revenue/money";
import { handleFollowUp } from "@/app/(app)/dashboard/followup-actions";
import { DraftDialog } from "@/components/followup/draft-dialog";
import type { EvidenceKind, FollowUpRule } from "@/lib/followup/rules";
import type { BlockerKind } from "@/lib/deal-facts/blockers";

/**
 * One deal on the follow-up list.
 *
 * The order of the content is the order a seller needs it: who, what the
 * reason is, what to do, and only then the controls. The reason is never
 * summarised away — it is the sentence the whole list exists to deliver, and
 * the evidence behind it is one click below, never hidden behind a page load.
 */

export interface FollowUpCardData {
  opportunityId: string;
  accountName: string;
  amount: number | null;
  currency: string;
  stage: string;
  rule: FollowUpRule;
  action: string;
  because: string;
  lastActivityAt: string | null;
  evidence: {
    eventId: string;
    source: string;
    sourceEventId: string;
    kind: EvidenceKind;
    occurredAt: string;
    summary: string;
  }[];
  contact: { id: string; name: string; email: string } | null;
  draftId: string | null;
  blocker: {
    kind: BlockerKind;
    title: string;
    because: string;
    recommendedAction: string;
  };
}

/** What is in the way, named plainly. */
const BLOCKER_LABEL: Record<BlockerKind, string> = {
  overdue_action: "You owe them a step",
  unanswered_pricing: "Pricing question open",
  unclear_scope: "Scope unclear",
  missing_decision_maker: "No decision-maker known",
  awaiting_reply: "Proposal unanswered",
  gone_quiet: "Conversation stopped",
};

const BLOCKER_TONE: Record<BlockerKind, string> = {
  overdue_action:
    "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300",
  unanswered_pricing:
    "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  unclear_scope:
    "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  missing_decision_maker: "border-border bg-muted/60 text-muted-foreground",
  awaiting_reply: "border-border bg-muted/60 text-muted-foreground",
  gone_quiet: "border-border bg-muted/60 text-muted-foreground",
};



const EVIDENCE_ICON: Record<EvidenceKind, typeof Mail> = {
  email_outbound: Mail,
  email_inbound: MessageSquare,
  meeting: Clock,
  call: Phone,
  note: StickyNote,
  crm_field: FileText,
};

const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  email_outbound: "Email you sent",
  email_inbound: "Reply from them",
  meeting: "Meeting",
  call: "Call",
  note: "Note",
  crm_field: "CRM record",
};

function relative(iso: string | null): string {
  if (!iso) return "No recorded activity";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function FollowUpCard({
  item,
  featured,
  tourAnchor,
}: {
  item: FollowUpCardData;
  /** One of the three the workbench leads with. */
  featured?: boolean;
  /** `data-tour` value; set on the first card only. */
  tourAnchor?: string;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [pending, startTransition] = useTransition();

  function handle(state: "DONE" | "SNOOZED" | "IGNORED", snoozeDays?: number) {
    startTransition(async () => {
      const result = await handleFollowUp({
        opportunityId: item.opportunityId,
        rule: item.rule,
        state,
        snoozeDays,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(
          state === "DONE"
            ? "Marked done — it comes back only if something new happens."
            : state === "SNOOZED"
              ? `Hidden for ${snoozeDays} days.`
              : "Removed from your list."
        );
      }
    });
  }

  return (
    <article
      data-tour={tourAnchor}
      className={cn(
        "rounded-2xl border bg-card transition-colors",
        featured ? "border-border/80 shadow-sm" : "border-border/60"
      )}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/opportunities/${item.opportunityId}`}
                className="text-[17px] font-semibold tracking-tight hover:text-primary hover:underline"
              >
                {item.accountName}
              </Link>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
                  BLOCKER_TONE[item.blocker.kind]
                )}
              >
                {BLOCKER_LABEL[item.blocker.kind]}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.stage}
              {item.contact && <> · {item.contact.name}</>}
              {" · Last contact: "}
              {relative(item.lastActivityAt)}
            </p>
          </div>

          {/* Only shown when the CRM actually holds a figure. */}
          {item.amount !== null && (
            <div className="text-right">
              <div className="text-[17px] font-semibold tabular-nums">
                {formatMoney(item.amount, item.currency)}
              </div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Deal value
              </div>
            </div>
          )}
        </div>

        {/* What is blocking it, then the one thing to do about it. */}
        <p className="mt-4 text-[15px] font-medium leading-snug">{item.blocker.title}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          {item.blocker.because}
        </p>

        <p className="mt-3 text-sm">
          <span className="font-medium">Do next: </span>
          <span className="text-muted-foreground">{item.blocker.recommendedAction}</span>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={pending} onClick={() => setDrafting(true)}>
            <Mail className="size-3.5" />
            {item.draftId ? "Open draft" : "Draft follow-up"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => handle("DONE")}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Mark done
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => handle("SNOOZED", 3)}>
            <Clock className="size-3.5" />
            Remind me in 3 days
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => handle("IGNORED")}>
            <X className="size-3.5" />
            Not now
          </Button>
        </div>
      </div>

      {/* ── Evidence ── */}
      <div className="border-t border-border/60">
        <button
          type="button"
          onClick={() => setShowEvidence((v) => !v)}
          aria-expanded={showEvidence}
          className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", showEvidence && "rotate-180")}
          />
          {showEvidence ? "Hide" : "Show"} what this is based on
          <span className="text-muted-foreground/70">({item.evidence.length})</span>
        </button>

        {showEvidence && (
          <ul className="divide-y divide-border/50 border-t border-border/50">
            {item.evidence.map((e) => {
              const Icon = EVIDENCE_ICON[e.kind] ?? FileText;
              return (
                <li key={e.eventId} className="flex gap-3 px-5 py-3">
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{e.summary}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {EVIDENCE_LABEL[e.kind]} ·{" "}
                      {new Date(e.occurredAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {" · from "}
                      {e.source === "hubspot" ? "HubSpot" : e.source}
                    </div>
                  </div>
                </li>
              );
            })}
            {item.evidence.length === 0 && (
              <li className="px-5 py-3 text-[13px] text-muted-foreground">
                No individual records are linked to this deal yet — the reason is
                based on the deal&rsquo;s own CRM fields.
              </li>
            )}
          </ul>
        )}
      </div>

      {drafting && (
        <DraftDialog
          open={drafting}
          onOpenChange={setDrafting}
          opportunityId={item.opportunityId}
          rule={item.rule}
          accountName={item.accountName}
          contactName={item.contact?.name ?? null}
        />
      )}
    </article>
  );
}
