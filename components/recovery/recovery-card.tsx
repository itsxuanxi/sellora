"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Ban, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/revenue/money";
import { DraftDialog } from "@/components/followup/draft-dialog";
import { excludeFromRecovery } from "@/app/(app)/opportunities/fact-actions";
import type { RecoveryRule } from "@/lib/recovery/eligibility";

/**
 * One dormant deal worth another conversation.
 *
 * Leads with why it was picked, because that is the claim a user will either
 * accept or reject in about two seconds. The re-engagement draft is written
 * from the same thread the reason cites and goes through the same approval
 * path as every other send — nothing here mass-mails anybody.
 */

export interface RecoveryCardData {
  opportunityId: string;
  accountName: string;
  amount: number | null;
  currency: string;
  stage: string;
  lastActivityAt: string | null;
  contact: { id: string; name: string; email: string } | null;
  reason: {
    rule: RecoveryRule;
    because: string;
    angle: string;
    dormantDays: number;
  };
}

const RULE_LABEL: Record<RecoveryRule, string> = {
  postponement_due: "They asked you to come back",
  proposal_unanswered: "Proposal never answered",
  loss_reason_expired: "Lost for a reason that may have changed",
};

export function RecoveryCard({ item }: { item: RecoveryCardData }) {
  const [drafting, setDrafting] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/opportunities/${item.opportunityId}`}
              className="text-[17px] font-semibold tracking-tight hover:text-primary hover:underline"
            >
              {item.accountName}
            </Link>
            <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {RULE_LABEL[item.reason.rule]}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.stage}
            {item.contact && <> · {item.contact.name}</>}
            {" · dormant "}
            {item.reason.dormantDays} days
          </p>
        </div>

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

      <p className="mt-4 text-[15px] leading-relaxed">{item.reason.because}</p>
      <p className="mt-2 text-sm">
        <span className="font-medium">Reason to reconnect: </span>
        <span className="text-muted-foreground">{item.reason.angle}</span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setDrafting(true)} disabled={pending}>
          <Mail className="size-3.5" />
          Draft a note
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await excludeFromRecovery({
                opportunityId: item.opportunityId,
                reason: "user_excluded",
              });
              if (!result.ok) toast.error(result.error);
              else toast.success("Removed — it will not come back here.");
            })
          }
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
          Don&rsquo;t suggest this again
        </Button>
      </div>

      {drafting && (
        <DraftDialog
          open={drafting}
          onOpenChange={setDrafting}
          opportunityId={item.opportunityId}
          rule="gone_quiet"
          accountName={item.accountName}
          contactName={item.contact?.name ?? null}
        />
      )}
    </article>
  );
}
