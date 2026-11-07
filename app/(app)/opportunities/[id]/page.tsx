import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Building2, ChevronDown, Mail } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DealFactsPanel } from "@/components/deal-facts/deal-facts-panel";
import { factsForOpportunity } from "@/lib/deal-facts/queries";
import { isStale } from "@/lib/deal-facts/kinds";
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
import { findContradiction, insufficientEvidence } from "@/lib/revenue/contradiction";
import { riskFromLeak } from "@/lib/risk/map";
import {
  BASIS_HELP,
  BASIS_LABEL,
  RISK_BASIS,
  RISK_LABEL,
  type RiskBasis,
} from "@/lib/risk/kinds";
import {
  ATTRIBUTION_CAVEAT,
  REVENUE_VOCABULARY,
  WIN_PROBABILITY_CAVEAT,
  likelihoodBand,
} from "@/lib/revenue/vocabulary";
import { UrgencyPill } from "@/components/revenue/leak-card";
import { interpretSignals } from "@/components/revenue/signal-timeline";
import { LoopStrip, LoopTimeline } from "@/components/revenue/loop-timeline";
import { LoopControls } from "@/components/revenue/loop-controls";
import { loadOpportunityTimeline, summarizeLoop } from "@/lib/revenue/timeline";
import { parseSupportingSignals } from "@/lib/revenue/loop";
import { RecommendationActions } from "@/components/revenue/recommendation-actions";
import { ActionConsole } from "@/components/revenue/action-console";
import { ALWAYS_AVAILABLE, draftFor, executionSummary } from "@/lib/revenue/execution";
import { isSimulated } from "@/lib/sandbox";
import { can } from "@/lib/security/rbac";
import type { OpportunityStage } from "@/lib/revenue/config";
import { StagePill } from "@/app/(app)/opportunities/page";
import { OpportunityControls } from "@/components/revenue/opportunity-controls";

/**
 * The leak's name and basis in the product's public vocabulary.
 *
 * `leak.category` is the internal section heading from lib/revenue/config.ts
 * and it does not match what Today calls the same situation. Mapping here
 * means a deal described as "Awaiting response" on Today is described the same
 * way on its own page.
 */
function riskLabelFor(leakType: string): string | null {
  const kind = riskFromLeak(leakType);
  return kind ? RISK_LABEL[kind] : null;
}

function riskBasisFor(leakType: string): RiskBasis | null {
  const kind = riskFromLeak(leakType);
  return kind ? RISK_BASIS[kind] : null;
}

export const metadata = { title: "Deal" };

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

  const [snapshot, signals, recommendations, emails, outcomes, dealFacts] = await Promise.all([
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
    factsForOpportunity(session.orgId, id),
  ]);


  const openRec = recommendations.find((r) => r.status === "OPEN") ?? null;

  // Advice is checked against the live facts before it is rendered.
  //
  // A recommendation is a claim about the present, and the row outlives the
  // situation: between one refresh and the next, a buyer can reply to the
  // very thread the card is telling the seller to chase. Showing it anyway
  // is worse than showing nothing — it proves Selryn is reading different
  // records from the person using it.
  const contradiction = openRec
    ? findContradiction(
        {
          createdAt: openRec.createdAt,
          leakType: openRec.leakType,
          actionType: openRec.actionType,
          expiresAt: openRec.expiresAt,
        },
        enriched.facts,
        new Date()
      )
    : null;
  const notEnough = insufficientEvidence(enriched.facts);

  // The action the console is about: one awaiting approval, or the decision
  // already taken on the *currently open* recommendation.
  //
  // Scoping the second case to `openRec` matters. A worked opportunity has a
  // history of executed actions, and showing the newest of those would report
  // last month's case study as the state of today's recommendation — the
  // console would look finished before anyone had done anything. Past actions
  // belong in the timeline below, which is where they are.
  const pendingAction =
    (await db.action.findFirst({
      where: { orgId: session.orgId, opportunityId: id, executionStatus: "PROPOSED" },
      orderBy: { proposedAt: "desc" },
    })) ??
    (openRec
      ? await db.action.findFirst({
          where: {
            orgId: session.orgId,
            opportunityId: id,
            recommendationId: openRec.id,
            executionStatus: { in: ["EXECUTED", "REJECTED"] },
          },
          orderBy: { updatedAt: "desc" },
        })
      : null);
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

  // Either a sandbox workspace or a sample contact suppresses the real send.
  // The second half is what stops a real customer who loaded sample data from
  // emailing a person who does not exist.
  const contactIsSample = enriched.contact
    ? (
        await db.prospect.findUnique({
          where: { id: enriched.contact.id },
          select: { isSample: true },
        })
      )?.isSample ?? false
    : false;
  const sandboxSend = isSimulated({
    orgIsSample: session.org.isSample,
    recordIsSample: contactIsSample,
  });

  // The unified chain. Loaded after `enriched` so a missing opportunity has
  // already short-circuited above.
  const timeline = await loadOpportunityTimeline(session.orgId, enriched.id);
  const loopStages = summarizeLoop(timeline);

  // Resolve the recommendation's stored signal ids to the real rows, so the
  // "Evidence" list links to verifiable events rather than restating prose.
  const evidenceIds = openRec ? parseSupportingSignals(openRec) : [];
  const evidenceSignals = evidenceIds.length
    ? signals.filter((sig) => evidenceIds.includes(sig.id))
    : [];

  return (
    <>
      <Link
        href="/opportunities"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Deals
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

      {/* ── What is true about this deal ──
             Three records, above the fold: what it is worth, what is wrong,
             and when anyone last spoke to them.

             This was four panels of estimates — likelihood, estimated
             expected revenue and estimated value at risk alongside the deal
             value. Three of the first four numbers a seller saw were modelled,
             two of them from the third, and the one thing they had come to the
             page to find out (what is wrong and what to do) was below them.
             The estimates still exist, under Estimates in the right rail,
             where someone who wants them can open them. ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel label="Deal value">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatMoney(enriched.dealValue, enriched.currency)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {enriched.dealValueBasis === "user_entered"
              ? "From your CRM"
              : "Estimated — your CRM holds no amount for this deal"}
          </p>
        </Panel>

        <Panel label={enriched.primaryLeak ? "What is wrong" : "Status"}>
          {enriched.primaryLeak ? (
            <>
              <div className="text-lg font-semibold leading-tight tracking-tight">
                {riskLabelFor(enriched.primaryLeak.type) ??
                  enriched.primaryLeak.category}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {riskBasisFor(enriched.primaryLeak.type)
                  ? BASIS_LABEL[riskBasisFor(enriched.primaryLeak.type)!]
                  : "From your records"}{" "}
                · open {enriched.primaryLeak.ageDays} day
                {enriched.primaryLeak.ageDays === 1 ? "" : "s"}
              </p>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold leading-tight tracking-tight">
                Nothing specific in the way
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                No rule fired on this deal&apos;s records
              </p>
            </>
          )}
        </Panel>

        {/* One clock, named for what it counts: the newest record of a contact
            either way. The timeline below counts buyer signals, which move on
            a different day — so both say which, rather than both saying
            "days" and disagreeing. */}
        <Panel label="Last activity">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            {enriched.daysSinceContact != null
              ? `${enriched.daysSinceContact}d`
              : "—"}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {enriched.lastInteractionAt
              ? `Newest record of any kind · ${format(enriched.lastInteractionAt, "MMM d")}`
              : "Never contacted"}
          </p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* ── Recommended Next Action (§7) ──
                 First on the page. The facts table used to sit above it: six
                 rows of mostly Unknown, between the reader and the one thing
                 they opened the deal to find out. ── */}
          <section
            data-tour="next-action"
            className="rounded-2xl border border-primary/25 bg-accent/30 p-5"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Recommended next action
              </span>
              <UrgencyPill urgency={action.urgency as Urgency} />
            </div>

            <h2 className="mt-2 text-lg font-semibold tracking-tight">{action.headline}</h2>

            {contradiction && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-50/70 p-3 dark:bg-amber-950/30">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Withdrawn — the situation changed
                </div>
                <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
                  {contradiction.because} This advice was raised on{" "}
                  {format(openRec!.createdAt, "MMM d")} and no longer applies.
                </p>
              </div>
            )}

            {!contradiction && notEnough && (
              <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                Not enough evidence to be confident here. {notEnough}
              </p>
            )}

            <div className="mt-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Why
              </div>
              <p className="mt-1 text-sm leading-relaxed">{action.rationale}</p>
              {/* The one sentence allowed to describe the buyer's silence,
                  from the same shared facts the timeline below renders. */}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {enriched.replySummary}
              </p>
            </div>

            {/* The evidence this advice rests on, resolved from the stored
                signal ids rather than restated as prose. If the list is empty
                the recommendation says so instead of implying evidence. */}
            {openRec && (
              <div className="mt-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Evidence
                </div>
                {evidenceSignals.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No specific signals recorded — this comes from the deal&apos;s
                    stage and how long it has been quiet.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {/* The signal's own title first, its category second.
                        Rendering the category meant the same record read
                        "Security page viewed" in the rationale above (which
                        uses the title) and "Pricing page viewed" here, on one
                        screen — the category is the bucket a signal was
                        filed under, and the title is what actually
                        happened. */}
                    {evidenceSignals.map((sig) => (
                      <li key={sig.id} className="text-sm">
                        <span className="text-foreground/90">
                          {sig.title ||
                            SIGNAL_LABELS[sig.signalType as SignalType] ||
                            sig.signalType}
                        </span>
                        {sig.evidence && (
                          <span className="text-muted-foreground"> — {sig.evidence}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-1">
                    <dt>Priority</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {openRec.priorityScore}/100
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Confidence in this advice</dt>
                    <dd className="font-medium text-foreground">{openRec.confidence}</dd>
                  </div>
                  {openRec.expiresAt && (
                    <div className="flex gap-1">
                      <dt>Relevant until</dt>
                      <dd className="font-medium text-foreground">
                        {format(openRec.expiresAt, "MMM d, HH:mm")}
                      </dd>
                    </div>
                  )}
                </dl>
                {openRec.expectedImpact && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {openRec.expectedImpact}
                  </p>
                )}
              </div>
            )}

            <div
              data-tour="action-controls"
              className="mt-4 flex flex-wrap items-center gap-2"
            >
              <span data-tour="approve-action" className="inline-flex items-center gap-1.5">
                <RecommendationActions
                  recommendationId={openRec?.id ?? null}
                  opportunityId={enriched.id}
                />
              </span>
              <span data-tour="loop-controls" className="inline-flex items-center gap-1.5">
                <LoopControls
                  opportunityId={enriched.id}
                  recommendationId={openRec?.id ?? null}
                  contactId={enriched.contact?.id ?? null}
                />
              </span>
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

          {/* ── Human-controlled execution ── */}
          <ActionConsole
            // useState seeds once. Without a key tied to the action, preparing
            // a draft re-renders the server component but leaves the editor
            // holding the empty strings it mounted with.
            key={pendingAction?.id ?? "none"}
            opportunityId={enriched.id}
            sandbox={sandboxSend}
            canExecute={can(session.role, "action:execute")}
            executionNote={executionSummary(
              draftFor(
                enriched,
                (pendingAction?.actionType as ActionType | undefined) ?? undefined
              ),
              sandboxSend
            )}
            choices={[
              {
                actionType: enriched.nextAction.actionType,
                label: ACTION_LABELS[enriched.nextAction.actionType as ActionType],
                recommended: true,
              },
              ...ALWAYS_AVAILABLE.filter(
                (t) => t !== enriched.nextAction.actionType
              ).map((t) => ({
                actionType: t,
                label: ACTION_LABELS[t],
                recommended: false,
              })),
            ]}
            action={
              pendingAction
                ? {
                    id: pendingAction.id,
                    actionType: pendingAction.actionType,
                    subject:
                      pendingAction.sentSubject ?? pendingAction.draftSubject ?? "",
                    body: pendingAction.content ?? pendingAction.draftBody ?? "",
                    destination: pendingAction.destination,
                    channel: pendingAction.channel,
                    summary: pendingAction.summary,
                    status: pendingAction.executionStatus,
                    simulated: pendingAction.simulated,
                    humanEdited: pendingAction.humanEdited,
                    sentAt: pendingAction.executedAt?.toISOString() ?? null,
                    decisionReason: pendingAction.decisionReason,
                  }
                : null
            }
          />

          <DealFactsPanel
            opportunityId={enriched.id}
            canEdit={can(session.role, "action:approve")}
            facts={dealFacts
              .filter((f) => !f.rejectedAt)
              .map((f) => ({
                id: f.id,
                kind: f.kind,
                value: f.value,
                status: f.status,
                sourceKind: f.sourceKind,
                correctedFrom: f.correctedFrom,
                stale: isStale(f, new Date()),
              }))}
          />

          {/* ── AI summary (§11) ── */}
          <Section title="Summary">
            <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
          </Section>

          {/* ── All detected leaks ── */}
          {enriched.leaks.length > 0 && (
            <Section title="Detected risks">
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
                      <span className="text-sm font-medium">
                        {riskLabelFor(leak.type) ?? leak.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        open {leak.ageDays} day{leak.ageDays === 1 ? "" : "s"}
                      </span>
                      {/* Read off the records, or reasoned from them. The
                          difference is the difference between "this date
                          passed" and "nobody answered their question", and a
                          reader who cannot tell them apart ends up trusting
                          neither. */}
                      {riskBasisFor(leak.type) && (
                        <span
                          title={BASIS_HELP[riskBasisFor(leak.type)!]}
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]",
                            riskBasisFor(leak.type) === "observed"
                              ? "bg-muted text-muted-foreground"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {BASIS_LABEL[riskBasisFor(leak.type)!]}
                        </span>
                      )}
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

          {/* ── The closed loop, in one stream ──
                 Signals used to sit in their own panel and recommendations in
                 another, which left the reader to join them by eye. Merged,
                 the sequence that actually matters — advice, what the rep did,
                 how the customer reacted — reads as adjacent rows. ── */}
          <Section title="Deal timeline">
            {/* The tour anchors here rather than on the whole section: the
                timeline runs to a couple of thousand pixels, and a highlight
                taller than the screen leaves the coach card nowhere to go
                that is not on top of it. */}
            <div data-tour="signal-timeline">
              <div className="mb-4 rounded-xl border border-border/60 bg-muted/30 p-3">
                <LoopStrip stages={loopStages} />
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Selryn&apos;s read on the signals:{" "}
                {interpretSignals(timelineSignals, enriched.score)}
              </p>
            </div>
            <LoopTimeline events={timeline} />
          </Section>

          {/* ── Conversation history ── */}
          <Collapsed
            title="Conversation history"
            hint={
              emails.length === 0
                ? "No emails recorded against this account yet"
                : `${emails.length} message${emails.length === 1 ? "" : "s"}, with what happened to each`
            }
          >
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
          </Collapsed>

          {/* ── Recommendation history: the learning loop, visible ── */}
          {recommendations.length > 0 && (
            <Collapsed
              title="What Selryn recommended"
              hint={`${recommendations.length} piece${recommendations.length === 1 ? "" : "s"} of advice on this deal, and what became of each`}
            >
              <ul className="divide-y divide-border/60">
                {recommendations.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm">{r.headline}</div>
                      <div className="text-xs text-muted-foreground">
                        {ACTION_LABELS[r.actionType as ActionType] ?? r.actionType} ·{" "}
                        {formatMoney(r.dealValue, enriched.currency)} deal value
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        r.status === "COMPLETED"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : r.status === "DISMISSED" ||
                              r.status === "WITHDRAWN" ||
                              r.status === "EXPIRED"
                            ? "text-muted-foreground"
                            : "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {r.status === "WITHDRAWN" ? "withdrawn" : r.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </Collapsed>
          )}
        </div>

        {/* ── Right rail ── */}
        <div className="min-w-0 space-y-6">
          <Section title="Opportunity score">
            {/* The tour anchors on the score and its reasons rather than the
                whole panel: with the full breakdown the section is as tall as
                the viewport, which leaves the coach card no gap to sit in. */}
            <div data-tour="score-summary">
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
            </div>

            {snapshot && (
              <details className="group mt-5 border-t border-border/60 pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground [&::-webkit-details-marker]:hidden">
                  Full breakdown
                  <ChevronDown
                    className="size-3.5 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="mt-3">
                  <ScoreBreakdown factors={snapshot.factors} total={snapshot.score} />
                  <p className="mt-4 text-[11px] text-muted-foreground">
                    Scored {formatDistanceToNow(snapshot.createdAt, { addSuffix: true })} ·
                    model v{snapshot.version}
                  </p>
                </div>
              </details>
            )}
          </Section>

          {/* ── The modelled numbers, together and labelled ──
                 These were the first three things on the page. Gathered here
                 instead, behind one disclosure, because they are all derived
                 from the same uncalibrated stage baseline and reading them
                 beside the deal value invited them to be read as equally
                 solid. Nothing is hidden: the section names what is inside
                 before it is opened. ── */}
          <Collapsed
            title="Estimates"
            hint="Modelled, not measured — likelihood, expected revenue, value at risk"
          >
            <dl className="space-y-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Estimated likelihood
                </dt>
                <dd
                  className="mt-1 text-xl font-semibold tracking-tight"
                  title={`Model figure: ${enriched.winProbability}% — ${WIN_PROBABILITY_CAVEAT}`}
                >
                  {likelihoodBand(enriched.winProbability).label}
                </dd>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  From stage {enriched.stage.toLowerCase()} and score. Not
                  calibrated against your own win history, so treat it as an
                  ordering, not a probability.
                </p>
              </div>

              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {REVENUE_VOCABULARY.estimated_expected_revenue.label}
                </dt>
                <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(enriched.expectedValue, enriched.currency)}
                </dd>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Deal value × the estimate above. An estimate of an estimate.
                </p>
              </div>

              {enriched.primaryLeak && (
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {REVENUE_VOCABULARY.value_at_risk.label}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
                    {formatMoney(enriched.atRisk, enriched.currency)}
                  </dd>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    An estimated share of the estimate above. Not money lost,
                    and not money Selryn can recover.
                  </p>
                </div>
              )}
            </dl>
          </Collapsed>

          <Section title="Deal">
            <dl className="space-y-2.5 text-sm">
              <Row label="Stage">
                <StagePill stage={enriched.stage} />
              </Row>
              <Row label="Last activity">
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

/**
 * A section that starts shut.
 *
 * `<details>` rather than a client component on purpose: the reference
 * material on this page — the full score arithmetic, the mail history, the
 * recommendation log — is worth keeping and is not worth the first screen.
 * Native disclosure works with no JavaScript, survives a failed bundle, and
 * is keyboard- and screen-reader-navigable without any work from us.
 */
function Collapsed({
  title,
  hint,
  children,
}: {
  title: string;
  /** What is inside, so the closed state is not a mystery box. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-border/70 bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          {hint && (
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              {hint}
            </span>
          )}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border/60 p-5">{children}</div>
    </details>
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

function Section({
  title,
  children,
  tour,
}: {
  title: string;
  children: React.ReactNode;
  /** Anchor for the guided tour; absent on sections it does not point at. */
  tour?: string;
}) {
  return (
    <section data-tour={tour} className="rounded-2xl border border-border/70 bg-card p-5">
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

  // "Last activity", not "last interaction".
  //
  // `daysSinceContact` counts anything that happened, the buyer's actions
  // included — a proposal open or a pricing-page visit. The risk card a few
  // inches away says "last contacted N days ago" and counts only what *we*
  // sent, so the two numbers legitimately differ. They were both labelled as
  // the last time something happened with this account, which reads as one
  // of them being wrong. Naming each for what it counts is the fix; making
  // them agree would mean throwing one of the two facts away.
  if (opp.lastInteractionAt && opp.daysSinceContact != null) {
    parts.push(
      opp.daysSinceContact === 0
        ? "Something happened on this deal today."
        : `Last activity of any kind, either direction, was ${opp.daysSinceContact} day${opp.daysSinceContact === 1 ? "" : "s"} ago.`
    );
  } else {
    parts.push("No activity has been recorded yet.");
  }

  parts.push(
    signalCount > 0
      ? `${signalCount} active buying signal${signalCount === 1 ? "" : "s"} feed the score of ${opp.score ?? 0}.`
      : `No active buying signals, so the score of ${opp.score ?? 0} rests on fit and engagement alone.`
  );

  if (opp.primaryLeak) parts.push(opp.primaryLeak.summary);

  parts.push(`Selryn's recommendation: ${opp.nextAction.headline.toLowerCase()}.`);

  return parts.join(" ");
}
