import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IntentScoreBadge, ConfidenceBadge } from "@/components/intent/intent-score-badge";
import { DraftActions } from "@/components/intent/draft-actions";
import { FeedbackButtons } from "@/components/intent/feedback-buttons";
import { RescoreButton } from "@/components/intent/rescore-button";
import { SIGNAL_LABELS, type SignalType } from "@/lib/intent/config";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Company Intent Detail" };

export default async function CompanyIntentDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const session = await requireSession();
  const { accountId } = await params;

  const account = await db.account.findFirst({
    where: { id: accountId, orgId: session.orgId },
  });
  if (!account) notFound();

  const [signals, latestSnapshot, drafts, feedback, outcomes, contacts, membership] = await Promise.all([
    db.buyingSignal.findMany({
      where: { orgId: session.orgId, accountId },
      orderBy: { occurredAt: "desc" },
      include: { source: true },
    }),
    db.intentScoreSnapshot.findFirst({
      where: { orgId: session.orgId, accountId },
      orderBy: { createdAt: "desc" },
      include: { components: true },
    }),
    db.outreachDraft.findMany({
      where: { orgId: session.orgId, accountId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.userFeedback.findMany({
      where: { orgId: session.orgId, accountId },
      orderBy: { createdAt: "desc" },
    }),
    db.outcome.findMany({
      where: { orgId: session.orgId, accountId },
      orderBy: { occurredAt: "desc" },
    }),
    db.prospect.findMany({ where: { accountId } }),
    db.intentCampaignAccount.findFirst({
      where: { accountId },
      include: { campaign: true },
    }),
  ]);

  const latestDraft = drafts.find((d) => d.status === "DRAFT") ?? drafts[0] ?? null;

  return (
    <>
      <PageHeader
        title={account.name}
        description={[account.industry, account.companySize && `${account.companySize} employees`, account.region]
          .filter(Boolean)
          .join(" · ")}
      >
        <IntentScoreBadge score={account.buyingIntentScore} />
        <ConfidenceBadge confidence={account.buyingIntentConfidence} />
        <RescoreButton accountId={account.id} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Score breakdown */}
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-medium">Score Breakdown</h2>
            {latestSnapshot ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Scored {formatDistanceToNow(latestSnapshot.createdAt, { addSuffix: true })} · scoring
                  config v{latestSnapshot.version}
                </p>
                <ul className="mt-3 divide-y divide-border/60">
                  {latestSnapshot.components.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-muted-foreground">{c.reason}</span>
                      <span
                        className={
                          c.points > 0
                            ? "font-medium text-emerald-600"
                            : c.points < 0
                              ? "font-medium text-rose-500"
                              : "text-muted-foreground"
                        }
                      >
                        {c.points > 0 ? "+" : ""}
                        {c.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Not scored yet.</p>
            )}
          </section>

          {/* Signal timeline */}
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-medium">Buying Signal Timeline</h2>
            {signals.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No signals recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-4">
                {signals.map((s) => (
                  <li key={s.id} className="border-l-2 border-border/70 pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {SIGNAL_LABELS[s.signalType as SignalType] ?? s.signalType}
                      </span>
                      {s.expired && (
                        <Badge variant="secondary" className="font-normal text-muted-foreground">
                          expired
                        </Badge>
                      )}
                      {s.source?.kind === "mock" && (
                        <Badge className="bg-amber-50 font-normal text-amber-700">Demo data</Badge>
                      )}
                      <Badge variant="outline" className="font-normal">
                        {s.confidence} confidence
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm">{s.title}</p>
                    {s.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                    )}
                    {s.evidence && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Evidence: {s.evidence}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Occurred {format(s.occurredAt, "MMM d, yyyy")}</span>
                      <span>Detected {formatDistanceToNow(s.detectedAt, { addSuffix: true })}</span>
                      {s.sourceUrl && (
                        <a
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Source <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Outreach */}
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Outreach</h2>
              <DraftActions
                accountId={account.id}
                campaignId={membership?.campaignId ?? ""}
                draft={latestDraft && latestDraft.status === "DRAFT" ? latestDraft : null}
              />
            </div>
            {latestDraft?.accountSummary && (
              <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  AI account research summary
                </p>
                <p className="mt-1">{latestDraft.accountSummary}</p>
                {latestDraft.recommendedAngle && (
                  <>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Recommended angle
                    </p>
                    <p className="mt-1">{latestDraft.recommendedAngle}</p>
                  </>
                )}
              </div>
            )}
            {drafts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No outreach drafted yet — use &quot;Draft Outreach&quot; above.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {drafts.map((d) => (
                  <li key={d.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-normal">
                        {d.status}
                      </Badge>
                      {d.insufficientEvidence && (
                        <Badge className="bg-rose-50 font-normal text-rose-600">
                          Insufficient evidence
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(d.createdAt, { addSuffix: true })} · {d.aiSource ?? "—"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium">{d.subject || "(no subject)"}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                      {d.body || "(withheld — insufficient evidence)"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Recommended contact */}
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-medium">Contacts</h2>
            {contacts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No contacts linked to this account yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {contacts.map((c) => (
                  <li key={c.id} className="text-sm">
                    <Link href={`/prospects/${c.id}`} className="font-medium hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                    {c.position && <span className="text-muted-foreground"> — {c.position}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Feedback */}
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-medium">Mark this recommendation</h2>
            <div className="mt-3">
              <FeedbackButtons accountId={account.id} draftId={latestDraft?.id} />
            </div>
            <Separator className="my-4" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Feedback history
            </p>
            {feedback.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {feedback.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <span>{f.label.replace("_", " ")}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(f.createdAt, { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Outcome / CRM activity */}
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-medium">Pipeline outcomes</h2>
            {outcomes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No outcomes recorded yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {outcomes.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <span>{o.stage.replace("_", " ")}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(o.occurredAt, "MMM d, yyyy")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {membership && (
              <p className="mt-3 text-xs text-muted-foreground">
                Campaign:{" "}
                <Link href={`/intent/${membership.campaignId}`} className="text-primary hover:underline">
                  {membership.campaign.name}
                </Link>
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
