import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Building2, Mail } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { BEHAVIOURAL_SIGNALS, SIGNAL_LABELS, type SignalType } from "@/lib/intent/config";
import {
  ACTION_LABELS,
  STAGE_HELP,
  type ActionType,
  type Urgency,
} from "@/lib/revenue/config";
import { formatMoney } from "@/lib/revenue/money";
import { loadEnrichedOpportunities } from "@/lib/revenue/queries";
import { OpportunityScore, ConfidenceNote, ScoreBreakdown, WhyNow } from "@/components/revenue/score";
import { UrgencyPill } from "@/components/revenue/leak-card";
import { SignalTimeline, interpretSignals } from "@/components/revenue/signal-timeline";
import { RecommendationActions } from "@/components/revenue/recommendation-actions";
import type { OpportunityStage } from "@/lib/revenue/config";
import { StagePill } from "@/app/(app)/opportunities/page";
import { OpportunityControls } from "@/components/revenue/opportunity-controls";

export const metadata = { title: "Opportunity" };

/**
 * Opportunity Intelligence (§11) — one unified profile answering: who are
 * they, what do they want, what has happened, what signals indicate intent,
 * and what should we do next.
 *
 * The AI summary at the top is assembled from the scoring factors and the
 * detected leak rather than generated freehand, so it can only ever state
 * things the evidence below actually supports.
 */
export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [enriched] = await loadEnrichedOpportunities(session.orgId).then((all) =>
    all.filter((o) => o.id === id)
  );
  if (!enriched) notFound();

  const [snapshot, signals, recommendations, emails, outcomes] = await Promise.all([
    db.opportunityScoreSnapshot.findFirst({
      where: { orgId: session.orgId, opportunityId: id },
      orderBy: { createdAt: "desc" },
      include: { factors: true },
    }),
    db.buyingSignal.findMany({
      where: { orgId: session.orgId, accountId: enriched.account.id, expired: false },
      orderBy: { occurredAt: "desc" },
      take: 30,
      include: { source: { select: { kind: true } } },
    }),
    db.recommendation.findMany({
      where: { orgId: session.orgId, opportunityId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.email.findMany({
      where: { orgId: session.orgId, prospect: { accountId: enriched.account.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        subject: true,
        status: true,
        sentAt: true,
        openedAt: true,
        repliedAt: true,
        prospect: { select: { name: true } },
      },
    }),
    db.outcome.findMany({
      where: { orgId: session.orgId, opportunityId: id },
      orderBy: { occurredAt: "desc" },
      take: 5,
    }),
  ]);

  const openRec = recommendations.find((r) => r.status === "OPEN") ?? null;
  const action = enriched.nextAction;

  const timelineSignals = signals.map((s) => ({
    id: s.id,
    label: SIGNAL_LABELS[s.signalType as SignalType] ?? s.signalType,
    title: s.title,
    description: s.description,
    evidence: s.evidence,
    occurredAt: s.occurredAt,
    family: (BEHAVIOURAL_SIGNALS as string[]).includes(s.signalType)
      ? ("behavioural" as const)
      : ("firmographic" as const),
    confidence: s.confidence,
    sourceKind: s.source?.kind ?? null,
  }));

  const summary = buildSummary(enriched, timelineSignals.length);

  return (
    <>
      <Link
        href="/opportunities"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Opportunities
      </Link>

      <PageHeader
        title={enriched.account.name}
        description={
          enriched.contact
            ? `${enriched.contact.name}${enriched.contact.position ? ` · ${enriched.contact.position}` : ""}`
            : "No primary contact linked yet"
        }
      >
        <Button asChild variant="outline">
          <Link href={`/accounts/${enriched.account.id}`}>
            <Building2 className="size-4" />
            Account
          </Link>
        </Button>
      </PageHeader>

      {/* ── Money bar ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel label="Deal value">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatMoney(enriched.dealValue, enriched.currency)}
          </div>
          {enriched.dealValueBasis !== "user_entered" && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Estimated — set it below for accurate forecasting
            </p>
          )}
        </Panel>
        <Panel label="Likelihood">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            {enriched.winProbability}%
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            From stage {enriched.stage.toLowerCase()} + score
          </p>
        </Panel>
        <Panel label="Expected revenue">
          <div className="text-2xl font-semibold tracking-tight tabular-nums text-primary">
            {formatMoney(enriched.expectedValue, enriched.currency)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">value × likelihood</p>
        </Panel>
        <Panel label={enriched.primaryLeak ? "Revenue at risk" : "Days since contact"}>
          {enriched.primaryLeak ? (
            <>
              <div className="text-2xl font-semibold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
                {formatMoney(enriched.atRisk, enriched.currency)}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {enriched.primaryLeak.category}
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-semibold tracking-tight tabular-nums">
                {enriched.daysSinceContact ?? "—"}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {enriched.lastInteractionAt
                  ? format(enriched.lastInteractionAt, "MMM d")
                  : "Never contacted"}
              </p>
            </>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ── Recommended Next Action (§7) ── */}
          <section className="rounded-2xl border border-primary/25 bg-accent/30 p-5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Recommended next action
              </span>
              <UrgencyPill urgency={action.urgency as Urgency} />
            </div>

            <h2 className="mt-2 text-lg font-semibold tracking-tight">{action.headline}</h2>

            <div className="mt-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Why
              </div>
              <p className="mt-1 text-sm leading-relaxed">{action.rationale}</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <RecommendationActions
                recommendationId={openRec?.id ?? null}
                opportunityId={enriched.id}
              />
              {enriched.contact && (
                <Button asChild variant="outline" size="sm">
                  <a href={`mailto:${enriched.contact.email}`}>
                    <Mail className="size-3.5" />
                    Email {enriched.contact.name.split(" ")[0]}
                  </a>
                </Button>
              )}
            </div>

            {action.alternatives.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Alternatives: {action.alternatives.map((a) => a.label).join(" · ")}
              </p>
            )}
          </section>

          {/* ── AI summary (§11) ── */}
          <Section title="Summary">
            <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
          </Section>

          {/* ── All detected leaks ── */}
          {enriched.leaks.length > 0 && (
            <Section title="Detected leaks">
              <ul className="space-y-3">
                {enriched.leaks.map((leak, i) => (
                  <li key={i} className="rounded-xl border border-border/60 p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          leak.severity === "critical"
                            ? "bg-rose-500"
                            : leak.severity === "warning"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        )}
                        aria-hidden
                      />
                      <span className="text-sm font-medium">{leak.category}</span>
                      <span className="text-xs text-muted-foreground">
                        open {leak.ageDays} day{leak.ageDays === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{leak.summary}</p>
                    {leak.evidence.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {leak.evidence.map((e, j) => (
                          <span
                            key={j}
                            className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* ── Buying signals (§9) ── */}
          <Section title="Buying signals">
            <SignalTimeline
              signals={timelineSignals}
              interpretation={interpretSignals(timelineSignals, enriched.score)}
            />
          </Section>

          {/* ── Conversation history ── */}
          <Section title="Conversation history">
            {emails.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No emails recorded against this account yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {emails.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{e.subject}</div>
                      <div className="text-xs text-muted-foreground">{e.prospect.name}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-medium">
                        {e.repliedAt ? "Replied" : e.openedAt ? "Opened" : e.sentAt ? "Sent" : "Draft"}
                      </div>
                      {(e.repliedAt ?? e.openedAt ?? e.sentAt) && (
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(e.repliedAt ?? e.openedAt ?? e.sentAt!, {
                            addSuffix: true,
                          })}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ── Recommendation history: the learning loop, visible ── */}
          {recommendations.length > 0 && (
            <Section title="What Sellora recommended">
              <ul className="divide-y divide-border/60">
                {recommendations.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm">{r.headline}</div>
                      <div className="text-xs text-muted-foreground">
                        {ACTION_LABELS[r.actionType as ActionType] ?? r.actionType} ·{" "}
                        {formatMoney(r.expectedValue, enriched.currency)} at stake
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        r.status === "COMPLETED"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : r.status === "DISMISSED"
                            ? "text-muted-foreground"
                            : "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {r.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* ── Right rail ── */}
        <div className="space-y-6">
          <Section title="Opportunity score">
            <div className="flex items-start justify-between gap-3">
              <OpportunityScore
                score={enriched.score}
                band={enriched.scoreBand}
                size="lg"
              />
              <ConfidenceNote confidence={enriched.confidence} />
            </div>

            {enriched.whyNow.length > 0 && (
              <div className="mt-4 border-t border-border/60 pt-4">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Why this score
                </div>
                <WhyNow reasons={enriched.whyNow} />
              </div>
            )}

            {snapshot && (
              <div className="mt-5 border-t border-border/60 pt-4">
                <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Full breakdown
                </div>
                <ScoreBreakdown factors={snapshot.factors} />
                <p className="mt-4 text-[11px] text-muted-foreground">
                  Scored {formatDistanceToNow(snapshot.createdAt, { addSuffix: true })} ·
                  model v{snapshot.version}
                </p>
              </div>
            )}
          </Section>

          <Section title="Deal">
            <dl className="space-y-2.5 text-sm">
              <Row label="Stage">
                <StagePill stage={enriched.stage} />
              </Row>
              <Row label="Last interaction">
                {enriched.lastInteractionAt
                  ? formatDistanceToNow(enriched.lastInteractionAt, { addSuffix: true })
                  : "Never"}
              </Row>
              <Row label="Next step">
                {enriched.nextStepDueAt
                  ? format(enriched.nextStepDueAt, "MMM d, yyyy")
                  : "Not scheduled"}
              </Row>
              {enriched.account.industry && (
                <Row label="Industry">{enriched.account.industry}</Row>
              )}
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {STAGE_HELP[enriched.stage as OpportunityStage] ?? ""}
            </p>

            <div className="mt-4 border-t border-border/60 pt-4">
              <OpportunityControls
                opportunityId={enriched.id}
                stage={enriched.stage}
                dealValue={enriched.dealValue}
                nextStepDueAt={
                  enriched.nextStepDueAt
                    ? format(enriched.nextStepDueAt, "yyyy-MM-dd")
                    : ""
                }
              />
            </div>
          </Section>

          {outcomes.length > 0 && (
            <Section title="Outcomes">
              <ul className="space-y-2 text-sm">
                {outcomes.map((o) => (
                  <li key={o.id} className="flex justify-between gap-2">
                    <span className="capitalize">{o.stage.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(o.occurredAt, "MMM d")}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/**
 * Assembles the profile summary from facts already on the page. Rule-based
 * on purpose: a generated paragraph could assert an objection or a timeline
 * that no signal supports, and §11's summary sits above the evidence where
 * it would be trusted most.
 */
function buildSummary(
  opp: Awaited<ReturnType<typeof loadEnrichedOpportunities>>[number],
  signalCount: number
): string {
  const parts: string[] = [];

  parts.push(
    `${opp.account.name}${opp.account.industry ? ` (${opp.account.industry})` : ""} is at ${opp.stage.toLowerCase()} stage with an estimated ${formatMoney(opp.dealValue, opp.currency)} on the table.`
  );

  if (opp.contact)
    parts.push(
      `${opp.contact.name}${opp.contact.position ? `, ${opp.contact.position},` : ""} is the primary contact.`
    );

  if (opp.lastInteractionAt && opp.daysSinceContact != null) {
    parts.push(
      opp.daysSinceContact === 0
        ? "You were in touch today."
        : `Last interaction was ${opp.daysSinceContact} day${opp.daysSinceContact === 1 ? "" : "s"} ago.`
    );
  } else {
    parts.push("No interaction has been recorded yet.");
  }

  parts.push(
    signalCount > 0
      ? `${signalCount} active buying signal${signalCount === 1 ? "" : "s"} feed the score of ${opp.score ?? 0}.`
      : `No active buying signals, so the score of ${opp.score ?? 0} rests on fit and engagement alone.`
  );

  if (opp.primaryLeak) parts.push(opp.primaryLeak.summary);

  parts.push(`Sellora's recommendation: ${opp.nextAction.headline.toLowerCase()}.`);

  return parts.join(" ");
}
