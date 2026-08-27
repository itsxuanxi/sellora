import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Radar, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IntentScoreBadge, ConfidenceBadge } from "@/components/intent/intent-score-badge";
import { DraftActions } from "@/components/intent/draft-actions";
import { FeedbackButtons } from "@/components/intent/feedback-buttons";
import { SIGNAL_LABELS, type SignalType } from "@/lib/intent/config";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntegrationHealthPanel } from "@/components/settings/integration-health";
import { integrationHealth } from "@/lib/integrations/sync-runner";
import { isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
import { isEncryptionConfigured } from "@/lib/security/crypto";

export const metadata = { title: "Intent Dashboard" };

export default async function IntentDashboardPage() {
  const session = await requireSession();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [health, campaigns, topAccounts] = await Promise.all([
    integrationHealth(session.orgId),
    db.intentCampaign.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true, drafts: true } } },
    }),
    db.account.findMany({
      where: { orgId: session.orgId, buyingIntentScore: { not: null } },
      orderBy: { buyingIntentScore: "desc" },
      take: 20,
      include: {
        prospects: true,
        buyingSignals: {
          where: { expired: false },
          orderBy: { occurredAt: "desc" },
          take: 4,
          include: { source: true },
        },
        outreachDrafts: {
          where: { status: "DRAFT" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        campaignMemberships: { include: { campaign: true }, take: 1 },
      },
    }),
  ]);

  const newToday = topAccounts.filter(
    (a) => a.buyingIntentScoredAt && a.buyingIntentScoredAt >= todayStart
  );

  return (
    <>
      <PageHeader
        title="Intent Dashboard"
        description="Companies worth contacting today, ranked by verifiable buying signals — not a guess."
      >
        <Button asChild>
          <Link href="/intent/new">
            <Plus className="size-4" />
            New Intent Campaign
          </Link>
        </Button>
      </PageHeader>

      {/* Data sources come first: everything below this panel is only as
          trustworthy as what is feeding it. */}
      <div className="mb-6">
        <IntegrationHealthPanel
          health={health}
          hubspotConfigured={isHubspotConfigured() && isEncryptionConfigured()}
        />
      </div>

      {campaigns.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/intent/${c.id}`}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-sm transition-colors hover:border-primary/30"
            >
              {c.name}
              <Badge variant="secondary" className="font-normal">
                {c._count.members} compan{c._count.members === 1 ? "y" : "ies"}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {topAccounts.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No scored companies yet"
          description="Create an Intent Campaign, then import a CSV of real signals (or run the demo detector) to see your first Intent Scores."
        >
          <Button asChild>
            <Link href="/intent/new">Create your first Intent Campaign</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {newToday.length > 0 && (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {newToday.length} newly scored today
            </p>
          )}
          {topAccounts.map((account) => {
            const draft = account.outreachDrafts[0];
            const contact = account.prospects[0];
            const campaign = account.campaignMemberships[0]?.campaign;
            const isNewToday = account.buyingIntentScoredAt && account.buyingIntentScoredAt >= todayStart;
            return (
              <div
                key={account.id}
                className="rounded-2xl border border-border/70 bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/intent/company/${account.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {account.name}
                      </Link>
                      {isNewToday && (
                        <Badge className="bg-primary/10 font-normal text-primary">New today</Badge>
                      )}
                      {campaign && (
                        <Badge variant="secondary" className="font-normal">
                          {campaign.name}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {account.industry && <span>{account.industry}</span>}
                      {account.companySize && <span>{account.companySize} employees</span>}
                      {account.region && <span>{account.region}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <IntentScoreBadge score={account.buyingIntentScore} />
                    <ConfidenceBadge confidence={account.buyingIntentConfidence} />
                  </div>
                </div>

                {account.buyingIntentWhyNow && (
                  <div className="mt-3 rounded-lg bg-muted/40 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Why now
                    </p>
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {account.buyingIntentWhyNow.split("\n").map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {account.buyingSignals.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {account.buyingSignals.map((s) => (
                      <Badge key={s.id} variant="outline" className="gap-1 font-normal">
                        {SIGNAL_LABELS[s.signalType as SignalType] ?? s.signalType}
                        {s.source?.kind === "mock" && (
                          <span className="text-amber-600">· demo data</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Recommended contact:{" "}
                    {contact ? `${contact.name}${contact.position ? ` (${contact.position})` : ""}` : "none linked yet"}
                  </span>
                  {account.buyingIntentScoredAt && (
                    <span>
                      Scored {formatDistanceToNow(account.buyingIntentScoredAt, { addSuffix: true })}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <FeedbackButtons accountId={account.id} draftId={draft?.id} />
                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/intent/company/${account.id}`}>View detail</Link>
                    </Button>
                    <DraftActions
                      accountId={account.id}
                      campaignId={campaign?.id ?? account.campaignMemberships[0]?.campaignId ?? ""}
                      draft={draft ?? null}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
