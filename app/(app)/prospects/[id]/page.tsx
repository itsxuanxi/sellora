import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Users,
} from "lucide-react";
import { AiPanel } from "@/components/prospects/ai-panel";
import { ProspectFormDialog } from "@/components/prospects/prospect-form-dialog";
import { StageSelect } from "@/components/prospects/stage-select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { EMAIL_STATUS_CONFIG, type EmailStatus } from "@/lib/constants";
import { db } from "@/lib/db";

export const metadata = { title: "Prospect" };

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([requireSession(), params]);
  const prospect = await db.prospect.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      emails: {
        include: { campaign: { select: { name: true, id: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!prospect) notFound();

  const hasAiContent = Boolean(
    prospect.companySummary ||
      prospect.icebreaker ||
      prospect.outreachAngle ||
      prospect.coldEmailSubject ||
      prospect.coldEmailBody ||
      prospect.linkedinMessage
  );

  const details = [
    { icon: Building2, label: "Industry", value: prospect.industry },
    { icon: MapPin, label: "Country", value: prospect.country },
    {
      icon: Users,
      label: "Company size",
      value: prospect.companySize ? `${prospect.companySize} employees` : null,
    },
  ].filter((d) => d.value);

  return (
    <>
      <Link
        href="/prospects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Prospects
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-accent text-lg font-medium text-accent-foreground">
              {initials(prospect.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {prospect.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {prospect.position ? `${prospect.position} · ` : ""}
              {prospect.company}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <a
                href={`mailto:${prospect.email}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Mail className="size-3.5" />
                {prospect.email}
              </a>
              {prospect.website && (
                <a
                  href={prospect.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Globe className="size-3.5" />
                  Website
                </a>
              )}
              {prospect.linkedin && (
                <a
                  href={prospect.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StageSelect prospectId={prospect.id} stage={prospect.stage} />
          <ProspectFormDialog
            prospect={prospect}
            trigger={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          {(details.length > 0 || prospect.notes) && (
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Details</h2>
              <dl className="space-y-3">
                {details.map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <d.icon className="size-4 text-muted-foreground" />
                    <div>
                      <dt className="text-xs text-muted-foreground">{d.label}</dt>
                      <dd className="text-sm">{d.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              {prospect.notes && (
                <>
                  <h3 className="mb-1.5 mt-5 text-xs font-medium text-muted-foreground">
                    Notes
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {prospect.notes}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Email history</h2>
            {prospect.emails.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No emails yet. Add {prospect.name.split(" ")[0]} to a campaign
                to start outreach.
              </p>
            ) : (
              <ul className="space-y-3">
                {prospect.emails.map((email) => {
                  const status =
                    EMAIL_STATUS_CONFIG[email.status as EmailStatus] ??
                    EMAIL_STATUS_CONFIG.DRAFT;
                  return (
                    <li key={email.id}>
                      <Link
                        href={`/campaigns/${email.campaign.id}`}
                        className="block rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {email.subject}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`shrink-0 font-normal ${status.badge}`}
                          >
                            {status.label}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="truncate">{email.campaign.name}</span>
                          <ExternalLink className="size-3 shrink-0" />
                          {email.sentAt && (
                            <span className="ml-auto shrink-0">
                              {format(email.sentAt, "MMM d")}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <AiPanel
            prospectId={prospect.id}
            prospectName={prospect.name.split(" ")[0]}
            generatedAt={prospect.aiGeneratedAt}
            initial={
              hasAiContent
                ? {
                    companySummary: prospect.companySummary ?? "",
                    icebreaker: prospect.icebreaker ?? "",
                    outreachAngle: prospect.outreachAngle ?? "",
                    coldEmailSubject: prospect.coldEmailSubject ?? "",
                    coldEmailBody: prospect.coldEmailBody ?? "",
                    linkedinMessage: prospect.linkedinMessage ?? "",
                  }
                : null
            }
          />
        </div>
      </div>
    </>
  );
}
