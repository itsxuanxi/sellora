import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Globe,
  Lightbulb,
  MapPin,
  Radar,
  Target,
  Users,
} from "lucide-react";
import { ResearchButtons } from "@/components/accounts/research-buttons";
import { ScoreBadge } from "@/components/accounts/score-badge";
import { StageBadge } from "@/components/prospects/prospect-table";
import { AgentStatusBadge } from "@/components/agent/action-controls";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Account" };

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([requireSession(), params]);
  const account = await db.account.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      prospects: { orderBy: { createdAt: "asc" } },
      actions: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });
  if (!account) notFound();

  const signals: { label: string; detail: string }[] = account.signals
    ? JSON.parse(account.signals)
    : [];

  const facts = [
    { icon: Building2, value: account.industry },
    { icon: Users, value: account.companySize ? `${account.companySize} employees` : null },
    { icon: MapPin, value: account.region },
    { icon: Globe, value: account.domain },
  ].filter((f) => f.value);

  return (
    <>
      <Link
        href="/accounts"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Accounts
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
            {account.source === "ai_suggested" && !account.verified && (
              <Badge variant="secondary" className="bg-amber-50 font-normal text-amber-700">
                AI-suggested · verify before outreach
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {facts.map((f, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <f.icon className="size-3.5" />
                {f.value}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <ScoreBadge label="Fit" score={account.fitScore} />
            <ScoreBadge label="Intent" score={account.intentScore} />
            {account.confidence && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  CONFIDENCE_STYLE[account.confidence] ?? CONFIDENCE_STYLE.low
                )}
              >
                Research confidence: {account.confidence}
              </span>
            )}
          </div>
        </div>
        <ResearchButtons
          accountId={account.id}
          hasResearch={Boolean(account.researchedAt)}
          hasScore={Boolean(account.scoredAt)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Brief */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Account brief</h2>
              {account.researchedAt && (
                <span className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(account.researchedAt, { addSuffix: true })}
                </span>
              )}
            </div>
            {account.summary ? (
              <>
                <p className="text-sm leading-relaxed">{account.summary}</p>
                {account.sources && (
                  <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    Sources: {account.sources}
                  </p>
                )}
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Not researched yet — click <span className="font-medium">Research</span> to
                generate the brief.
              </p>
            )}
          </div>

          {account.painHypotheses && (
            <div className="rounded-2xl border border-border/70 bg-card p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="size-4 text-primary" />
                Pain hypotheses
              </h2>
              <ul className="space-y-2">
                {account.painHypotheses.split("\n").filter(Boolean).map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {account.recommendedAngle && (
            <div className="rounded-2xl border border-primary/20 bg-accent/30 p-6">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Target className="size-4 text-primary" />
                Recommended angle
              </h2>
              <p className="text-sm leading-relaxed">{account.recommendedAngle}</p>
            </div>
          )}

          {signals.length > 0 && (
            <div className="rounded-2xl border border-border/70 bg-card p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Radar className="size-4 text-primary" />
                Signals
              </h2>
              <div className="space-y-2.5">
                {signals.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border/60 px-3.5 py-2.5">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {account.scoreRationale && (
            <div className="rounded-2xl border border-border/70 bg-card p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Why these scores</h2>
                {account.scoredAt && (
                  <span className="text-xs text-muted-foreground">
                    Scored {format(account.scoredAt, "MMM d, HH:mm")}
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/85">
                {account.scoreRationale}
              </pre>
            </div>
          )}
        </div>

        {/* Contacts + history */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">
              Key contacts ({account.prospects.length})
            </h2>
            {account.prospects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contacts linked yet — add people in{" "}
                <Link href="/prospects" className="underline underline-offset-2">
                  Contacts
                </Link>{" "}
                with this company name.
              </p>
            ) : (
              <ul className="space-y-1">
                {account.prospects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/prospects/${p.id}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-accent text-[11px] font-medium text-accent-foreground">
                          {initials(p.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.position ?? p.email}
                        </div>
                      </div>
                      <StageBadge stage={p.stage} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Agent history</h2>
            {account.actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agent activity yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {account.actions.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{a.title}</span>
                    <AgentStatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
