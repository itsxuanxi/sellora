import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { AccountsToolbar } from "@/components/accounts/accounts-toolbar";
import { ScoreBadge } from "@/components/accounts/score-badge";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const session = await requireSession();
  const [accounts, unlinkedContacts] = await Promise.all([
    db.account.findMany({
      where: { orgId: session.orgId },
      orderBy: [
        { intentScore: { sort: "desc", nulls: "last" } },
        { fitScore: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      include: { _count: { select: { prospects: true } } },
    }),
    db.prospect.count({ where: { orgId: session.orgId, accountId: null } }),
  ]);

  return (
    <>
      <PageHeader
        title="Accounts"
        description={`${accounts.length} target compan${accounts.length === 1 ? "y" : "ies"}, ranked by intent and ICP fit.`}
      >
        <AccountsToolbar unlinkedContacts={unlinkedContacts} />
      </PageHeader>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No target accounts yet"
          description={
            unlinkedContacts > 0
              ? `You have ${unlinkedContacts} contact(s) — import them to build your account list in one click, or add a target company manually.`
              : "Add the companies you want to win. The agent researches each one and scores it against your ICP."
          }
        >
          <AccountsToolbar unlinkedContacts={unlinkedContacts} />
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href={`/accounts/${account.id}`}
              className="group flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border/70 bg-card px-5 py-4 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium group-hover:text-primary">
                    {account.name}
                  </span>
                  {account.source === "ai_suggested" && !account.verified && (
                    <Badge variant="secondary" className="bg-amber-50 font-normal text-amber-700">
                      AI-suggested · unverified
                    </Badge>
                  )}
                  {!account.researchedAt && (
                    <Badge variant="secondary" className="bg-slate-100 font-normal text-slate-500">
                      Not researched
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {account.industry && <span>{account.industry}</span>}
                  {account.companySize && <span>{account.companySize} employees</span>}
                  {account.region && <span>{account.region}</span>}
                  <span>
                    {account._count.prospects} contact
                    {account._count.prospects === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ScoreBadge label="Fit" score={account.fitScore} />
                <ScoreBadge label="Intent" score={account.intentScore} />
              </div>
              <span className="text-xs text-muted-foreground">
                {account.researchedAt
                  ? `Researched ${formatDistanceToNow(account.researchedAt, { addSuffix: true })}`
                  : "—"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
