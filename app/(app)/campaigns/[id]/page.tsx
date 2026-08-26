import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  MailOpen,
  MessageSquareReply,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import { AddProspectsDialog } from "@/components/campaigns/add-prospects-dialog";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { RecipientTable } from "@/components/campaigns/recipient-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Campaign" };

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-violet-50 text-violet-700",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([requireSession(), params]);
  const campaign = await db.campaign.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      emails: {
        include: { prospect: true, followUps: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!campaign) notFound();

  const inCampaign = new Set(campaign.emails.map((e) => e.prospectId));
  const available = await db.prospect.findMany({
    where: { orgId: session.orgId, id: { notIn: [...inCampaign] } },
    orderBy: { createdAt: "desc" },
  });

  const sent = campaign.emails.filter((e) => e.status !== "DRAFT").length;
  const opened = campaign.emails.filter((e) =>
    ["OPENED", "REPLIED"].includes(e.status)
  ).length;
  const replied = campaign.emails.filter((e) => e.status === "REPLIED").length;

  const stats = [
    { icon: Users, label: "Recipients", value: campaign.emails.length },
    { icon: Mail, label: "Sent", value: sent },
    {
      icon: MailOpen,
      label: "Opened",
      value: opened,
      hint: sent ? `${Math.round((opened / sent) * 100)}%` : undefined,
    },
    {
      icon: MessageSquareReply,
      label: "Replied",
      value: replied,
      hint: sent ? `${Math.round((replied / sent) * 100)}%` : undefined,
    },
  ];

  return (
    <>
      <Link
        href="/campaigns"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Campaigns
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {campaign.name}
            </h1>
            <Badge
              variant="secondary"
              className={cn(
                "font-normal capitalize",
                STATUS_STYLE[campaign.status]
              )}
            >
              {campaign.status.toLowerCase()}
            </Badge>
          </div>
          {campaign.description && (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {campaign.description}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2.5 py-1 capitalize">
              {campaign.tone} tone
            </span>
            {campaign.goal && (
              <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <Target className="size-3" />
                {campaign.goal}
              </span>
            )}
          </div>
        </div>
        <CampaignActions campaign={campaign} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border/70 bg-card p-4"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <stat.icon className="size-3.5" />
              {stat.label}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">
                {stat.value}
              </span>
              {stat.hint && (
                <span className="text-xs text-muted-foreground">{stat.hint}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recipients</h2>
        <AddProspectsDialog campaignId={campaign.id} available={available} />
      </div>

      {campaign.emails.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No recipients yet"
          description="Add prospects to this campaign, then let the AI write a personalized email for each of them."
        >
          <AddProspectsDialog campaignId={campaign.id} available={available} />
        </EmptyState>
      ) : (
        <RecipientTable campaignId={campaign.id} emails={campaign.emails} />
      )}
    </>
  );
}
