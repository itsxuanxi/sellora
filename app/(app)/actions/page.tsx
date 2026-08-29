import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckSquare } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACTION_LABELS, type ActionType } from "@/lib/revenue/config";

export const metadata = { title: "Actions" };

/**
 * Actions answers one question: what is waiting for execution?
 *
 * It replaces Conversations, the planned Meetings page, and the approvals and
 * follow-ups that were scattered across the opportunity detail. Those were
 * never separate features — they are stages of one thing, and splitting them
 * across pages meant nothing showed the queue as a queue.
 *
 * Everything here reads the Action ledger the approval console already
 * writes, so this page adds a view rather than a second source of truth.
 */

type Filter =
  | "needs-approval"
  | "scheduled"
  | "sent"
  | "replied"
  | "completed"
  | "dismissed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "needs-approval", label: "Needs approval" },
  { key: "scheduled", label: "Scheduled" },
  { key: "sent", label: "Sent" },
  { key: "replied", label: "Buyer replied" },
  { key: "completed", label: "Completed" },
  { key: "dismissed", label: "Dismissed" },
];

/** Each filter as a Prisma predicate, so the counts and the list agree. */
function whereFor(filter: Filter, orgId: string) {
  const base = { orgId };
  switch (filter) {
    case "needs-approval":
      return { ...base, executionStatus: "PROPOSED" };
    case "scheduled":
      return { ...base, executionStatus: "APPROVED", executedAt: null };
    case "sent":
      return { ...base, executionStatus: "EXECUTED", responses: { none: {} } };
    case "replied":
      return { ...base, responses: { some: {} } };
    case "completed":
      return { ...base, executionStatus: "EXECUTED" };
    case "dismissed":
      return { ...base, executionStatus: { in: ["REJECTED", "UNDONE"] } };
  }
}

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const filter = (FILTERS.find((f) => f.key === params.filter)?.key ??
    "needs-approval") as Filter;

  const [actions, counts] = await Promise.all([
    db.action.findMany({
      where: whereFor(filter, session.orgId),
      orderBy: [{ proposedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        actionType: true,
        channel: true,
        summary: true,
        executionStatus: true,
        simulated: true,
        humanEdited: true,
        proposedAt: true,
        executedAt: true,
        decisionReason: true,
        opportunityId: true,
        opportunity: {
          select: {
            dealValue: true,
            currency: true,
            account: { select: { name: true } },
          },
        },
        responses: {
          select: { responseType: true, observedAt: true },
          orderBy: { observedAt: "desc" },
          take: 1,
        },
      },
    }),
    Promise.all(
      FILTERS.map(async (f) => ({
        key: f.key,
        count: await db.action.count({ where: whereFor(f.key, session.orgId) }),
      }))
    ),
  ]);

  const countFor = (key: Filter) => counts.find((c) => c.key === key)?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Actions"
        description="Everything Selryn has recommended, and what happened to it."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/actions?filter=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              filter === f.key
                ? "border-primary/30 bg-accent font-medium text-accent-foreground"
                : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {f.label}
            <span className="ml-1.5 tabular-nums opacity-60">{countFor(f.key)}</span>
          </Link>
        ))}
      </div>

      {actions.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={
            filter === "needs-approval"
              ? "Nothing waiting for you"
              : "Nothing here yet"
          }
          description={
            filter === "needs-approval"
              ? "No recommendation is waiting for approval. Selryn surfaces one the moment a deal starts leaking revenue."
              : "Actions appear here once Selryn has recommended something and you have decided what to do about it."
          }
        >
          <Button asChild variant="outline">
            <Link href="/dashboard">Open today&rsquo;s priorities</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card">
          {actions.map((action) => {
            const money = new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: action.opportunity.currency,
              maximumFractionDigits: 0,
            });
            const reply = action.responses[0];
            return (
              <li key={action.id}>
                <Link
                  href={`/opportunities/${action.opportunityId}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {ACTION_LABELS[action.actionType as ActionType] ?? action.actionType}
                  </span>
                  <span className="font-medium">{action.opportunity.account.name}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {action.summary}
                  </span>

                  <span className="text-sm tabular-nums text-muted-foreground">
                    {money.format(action.opportunity.dealValue)}
                  </span>

                  <StatusPill
                    status={action.executionStatus}
                    simulated={action.simulated}
                    edited={action.humanEdited}
                    reply={reply?.responseType ?? null}
                  />

                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatDistanceToNow(action.executedAt ?? action.proposedAt, {
                      addSuffix: true,
                    })}
                  </span>

                  {action.decisionReason && (
                    <span className="w-full text-xs text-muted-foreground">
                      Reason: {action.decisionReason}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function StatusPill({
  status,
  simulated,
  edited,
  reply,
}: {
  status: string;
  simulated: boolean;
  edited: boolean;
  reply: string | null;
}) {
  const label = reply
    ? reply.replace(/_/g, " ")
    : status === "PROPOSED"
      ? "Awaiting approval"
      : status === "EXECUTED"
        ? simulated
          ? "Simulated"
          : "Executed"
        : status.toLowerCase();

  const tone = reply
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : status === "PROPOSED"
      ? "bg-primary/10 text-primary"
      : status === "REJECTED"
        ? "bg-muted text-muted-foreground"
        : "bg-muted text-muted-foreground";

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          tone
        )}
      >
        {label}
      </span>
      {edited && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Edited
        </span>
      )}
    </span>
  );
}
