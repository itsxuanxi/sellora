import Link from "next/link";
import { format } from "date-fns";
import { Mail, MailOpen, MessageSquareReply, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { CampaignFormDialog } from "@/components/campaigns/campaign-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Campaigns" };

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-violet-50 text-violet-700",
};

export default async function CampaignsPage() {
  const session = await requireSession();
  const campaigns = await db.campaign.findMany({
    where: { orgId: session.orgId },
    include: { emails: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Each campaign is a targeted batch of AI-personalized outreach."
      >
        <CampaignFormDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              New campaign
            </Button>
          }
        />
      </PageHeader>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No campaigns yet"
          description="Create a campaign, add prospects, and let the AI write a personalized email for each one."
        >
          <CampaignFormDialog
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Create your first campaign
              </Button>
            }
          />
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => {
            const recipients = campaign.emails.length;
            const sent = campaign.emails.filter((e) => e.status !== "DRAFT").length;
            const opened = campaign.emails.filter((e) =>
              ["OPENED", "REPLIED"].includes(e.status)
            ).length;
            const replied = campaign.emails.filter(
              (e) => e.status === "REPLIED"
            ).length;
            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="group rounded-2xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold group-hover:text-primary">
                      {campaign.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {campaign.description ?? "No description"}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 font-normal capitalize",
                      STATUS_STYLE[campaign.status]
                    )}
                  >
                    {campaign.status.toLowerCase()}
                  </Badge>
                </div>

                <div className="mt-5 grid grid-cols-4 gap-2 border-t border-border/60 pt-4">
                  {[
                    { icon: Users, label: "Recipients", value: recipients },
                    { icon: Mail, label: "Sent", value: sent },
                    { icon: MailOpen, label: "Opened", value: opened },
                    { icon: MessageSquareReply, label: "Replied", value: replied },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <stat.icon className="size-3" />
                        {stat.label}
                      </div>
                      <div className="mt-0.5 text-lg font-semibold">
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{campaign.tone} tone</span>
                  <span>Created {format(campaign.createdAt, "MMM d, yyyy")}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
