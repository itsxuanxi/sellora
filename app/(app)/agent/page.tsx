import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Bot, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  ActionControls,
  AgentStatusBadge,
} from "@/components/agent/action-controls";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Agent" };

const AUTONOMY_LABEL: Record<string, string> = {
  suggest: "Suggest only",
  approve: "Approval required",
  autopilot: "Autopilot",
};

function ActionRow({
  action,
}: {
  action: {
    id: string;
    type: string;
    status: string;
    title: string;
    detail: string | null;
    error: string | null;
    createdAt: Date;
    executedAt: Date | null;
    decidedBy: string | null;
    requestedBy: string | null;
    account: { id: string; name: string } | null;
  };
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border/60 bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{action.title}</span>
          {action.account && (
            <Link
              href={`/accounts/${action.account.id}`}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {action.account.name}
            </Link>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>
            {action.requestedBy === "agent" ? "Initiated by agent" : "Requested by you"} ·{" "}
            {formatDistanceToNow(action.createdAt, { addSuffix: true })}
          </span>
          {action.executedAt && (
            <span>Executed {format(action.executedAt, "MMM d, HH:mm")}</span>
          )}
          {action.detail && <span className="w-full sm:w-auto">{action.detail}</span>}
        </div>
        {action.error && (
          <p className="mt-1 text-xs text-rose-600">Error: {action.error}</p>
        )}
      </div>
      <AgentStatusBadge status={action.status} />
      <ActionControls id={action.id} status={action.status} type={action.type} />
    </div>
  );
}

export default async function AgentPage() {
  const session = await requireSession();
  const [icp, queue, history] = await Promise.all([
    db.icpProfile.findUnique({ where: { orgId: session.orgId } }),
    db.agentAction.findMany({
      where: {
        orgId: session.orgId,
        status: { in: ["PENDING_APPROVAL", "SUGGESTED", "RUNNING", "FAILED"] },
      },
      orderBy: { createdAt: "asc" },
      include: { account: { select: { id: true, name: true } } },
    }),
    db.agentAction.findMany({
      where: { orgId: session.orgId, status: { in: ["DONE", "CANCELED", "UNDONE"] } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { account: { select: { id: true, name: true } } },
    }),
  ]);

  const autonomy = icp?.autonomy ?? "approve";

  return (
    <>
      <PageHeader
        title="Agent"
        description="Everything the agent wants to do, is doing, and has done — with a full audit trail."
      >
        <Link
          href="/icp"
          className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          <ShieldCheck className="size-3.5 text-primary" />
          Mode: {AUTONOMY_LABEL[autonomy]}
        </Link>
      </PageHeader>

      {queue.length === 0 && history.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="The agent hasn't done anything yet"
          description="Import or add accounts and the agent will queue research and scoring work here — nothing executes without the permissions you set."
        >
          <Link
            href="/accounts"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to Accounts
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {queue.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold">Needs attention</h2>
                <Badge variant="secondary" className="bg-amber-50 font-normal text-amber-700">
                  {queue.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {queue.map((a) => (
                  <ActionRow key={a.id} action={a} />
                ))}
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Audit log</h2>
              <div className="space-y-2">
                {history.map((a) => (
                  <ActionRow key={a.id} action={a} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
