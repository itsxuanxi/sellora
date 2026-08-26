import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { ImportPanel } from "@/components/intent/import-panel";
import { IntentScoreBadge, ConfidenceBadge } from "@/components/intent/intent-score-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Intent Campaign" };

export default async function IntentCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await requireSession();
  const { campaignId } = await params;

  const campaign = await db.intentCampaign.findFirst({
    where: { id: campaignId, orgId: session.orgId },
    include: {
      members: {
        include: {
          account: true,
        },
        orderBy: { account: { buyingIntentScore: { sort: "desc", nulls: "last" } } },
      },
      _count: { select: { drafts: true } },
    },
  });
  if (!campaign) notFound();

  const criteriaLines = [
    campaign.industries && `Industries: ${campaign.industries}`,
    campaign.regions && `Regions: ${campaign.regions}`,
    campaign.companySizes && `Company sizes: ${campaign.companySizes}`,
    campaign.targetTitles && `Target titles: ${campaign.targetTitles}`,
    `Minimum Intent Score: ${campaign.minIntentScore}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        title={campaign.name}
        description={`${campaign.members.length} compan${campaign.members.length === 1 ? "y" : "ies"} in scope · ${campaign.tone} tone · always requires approval before sending`}
      >
        <Badge variant="secondary">{campaign.status}</Badge>
      </PageHeader>

      <div className="mb-6 rounded-2xl border border-border/70 bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Campaign setup
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {criteriaLines.length > 0 ? (
            criteriaLines.map((line) => <li key={line}>{line}</li>)
          ) : (
            <li>No targeting criteria set — every imported company is in scope.</li>
          )}
        </ul>
      </div>

      <div className="mb-8">
        <ImportPanel campaignId={campaign.id} />
      </div>

      {campaign.members.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies in this campaign yet"
          description="Import a CSV of real signals, or run the demo detector above, to see your first Intent Scores."
        />
      ) : (
        <div className="grid gap-3">
          {campaign.members.map(({ account }) => (
            <Link
              key={account.id}
              href={`/intent/company/${account.id}`}
              className="group flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border/70 bg-card px-5 py-4 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium group-hover:text-primary">{account.name}</span>
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
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
