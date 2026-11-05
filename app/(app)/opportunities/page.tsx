import Link from "next/link";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import { isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
import { isEncryptionConfigured } from "@/lib/security/crypto";
import { Button } from "@/components/ui/button";
import { OPEN_STAGES, STAGE_LABELS, type OpportunityStage } from "@/lib/revenue/config";
import { formatMoney, formatMoneyCompact } from "@/lib/revenue/money";
import { loadEnrichedOpportunities } from "@/lib/revenue/queries";
import { REVENUE_VOCABULARY, WIN_PROBABILITY_CAVEAT, likelihoodBand } from "@/lib/revenue/vocabulary";
import { db } from "@/lib/db";
import { IMPORT_SOURCE } from "@/lib/import/apply";
import { describeImportFreshness } from "@/lib/import/freshness";
import { RefreshIntelligenceButton } from "@/components/revenue/recommendation-actions";
import { refreshRevenueIntelligence } from "@/app/(app)/opportunities/actions";

export const metadata = { title: "Deals" };

type Filter =
  | "all"
  | "needs-attention"
  | "high-intent"
  | "stalled"
  | "recently-advanced"
  | "won"
  | "lost";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs-attention", label: "Needs attention" },
  { key: "high-intent", label: "High intent" },
  { key: "stalled", label: "Stalled" },
  { key: "recently-advanced", label: "Recently advanced" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

/** A deal with no contact for this long is stalled rather than merely quiet. */
const STALLED_DAYS = 14;
/** How recently a deal must have moved to count as recently advanced. */
const ADVANCED_WITHIN_DAYS = 14;

/**
 * Every opportunity, ranked by expected revenue rather than by date or
 * alphabet. The sort order is the point: the top of this list is where the
 * next hour of selling time is worth the most.
 */
export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireSession();
  const { filter: rawFilter } = await searchParams;
  const filter = (FILTERS.find((f) => f.key === rawFilter)?.key ?? "all") as Filter;

  const [all, lastImport] = await Promise.all([
    loadEnrichedOpportunities(session.orgId),
    db.revenueEvent.findFirst({
      where: { orgId: session.orgId, source: IMPORT_SOURCE },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    }),
  ]);
  const freshness = describeImportFreshness(lastImport?.receivedAt ?? null);
  const hubspotReady = isHubspotConfigured() && isEncryptionConfigured();

  const advancedSince = Date.now() - ADVANCED_WITHIN_DAYS * 86_400_000;

  const filtered = all
    .filter((o) => {
      const open = (OPEN_STAGES as string[]).includes(o.stage);
      switch (filter) {
        case "needs-attention":
          return open && o.primaryLeak !== null;
        case "high-intent":
          return open && (o.score ?? 0) >= 70;
        case "stalled":
          // Quiet for a fortnight, or never contacted at all.
          return (
            open && (o.daysSinceContact === null || o.daysSinceContact >= STALLED_DAYS)
          );
        case "recently-advanced":
          return (
            open &&
            o.lastInteractionAt !== null &&
            o.lastInteractionAt.getTime() >= advancedSince &&
            o.primaryLeak === null
          );
        case "won":
          return o.stage === "WON";
        case "lost":
          return o.stage === "LOST";
        default:
          return true;
      }
    })
    .sort((a, b) => b.expectedValue - a.expectedValue);

  const totalExpected = filtered.reduce((s, o) => s + o.expectedValue, 0);
  const totalValue = filtered.reduce((s, o) => s + o.dealValue, 0);
  const currency = all[0]?.currency ?? "USD";

  return (
    <>
      <PageHeader
        title="Deals"
        description="Every open deal by estimated expected revenue — deal value × an estimated close likelihood. This orders deals by size, not by who to contact today; for that, see Today."
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/opportunities/import">
            <Upload className="size-3.5" />
            Import
          </Link>
        </Button>
        <RefreshIntelligenceButton action={refreshRevenueIntelligence} />
      </PageHeader>

      {all.length === 0 ? (
        <PipelineOnboarding hubspotReady={hubspotReady} sandbox={session.org.isSample} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`/opportunities?filter=${f.key}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  filter === f.key
                    ? "border-primary/30 bg-accent font-medium text-accent-foreground"
                    : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>

          {/* Imported data ages, and nothing else on this page would say so. */}
          {freshness.level !== "none" && freshness.level !== "fresh" && (
            <p
              className={cn(
                "mb-5 rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
                freshness.level === "very_stale"
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                  : "border-border/70 bg-muted/30 text-muted-foreground"
              )}
            >
              {freshness.label}{" "}
              <Link href="/opportunities/import" className="font-medium text-primary hover:underline">
                Import again
              </Link>
            </p>
          )}

          <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-border/70 bg-card px-5 py-4">
            <Metric label="Opportunities" value={String(filtered.length)} />
            <Metric label="Total deal value" value={formatMoney(totalValue, currency)} />
            <Metric
              label={REVENUE_VOCABULARY.estimated_expected_revenue.label}
              value={formatMoney(totalExpected, currency)}
              emphasis
            />
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              No opportunities match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
              <table className="w-full min-w-[1040px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left">
                    <Th>Opportunity</Th>
                    <Th>Stage</Th>
                    <Th align="right">Deal value</Th>
                    <Th align="right">Est. likelihood</Th>
                    <Th align="right">Est. expected</Th>
                    <Th align="right">Est. at risk</Th>
                    <Th>Why it matters</Th>
                    <Th>Next best action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((opp) => (
                    <tr key={opp.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/opportunities/${opp.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {opp.account.name}
                        </Link>
                        {opp.contact && (
                          <div className="text-xs text-muted-foreground">
                            {opp.contact.name}
                            {opp.contact.position && ` · ${opp.contact.position}`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StagePill stage={opp.stage} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoneyCompact(opp.dealValue, opp.currency)}
                        {opp.dealValueBasis !== "user_entered" && (
                          <span className="ml-1 text-xs text-muted-foreground">est.</span>
                        )}
                      </td>
                      {/* A band, not a percentage — see the note on the deal
                          detail page. The figure is a generic stage baseline
                          times a score factor, with no calibration behind it. */}
                      <td
                        className="px-4 py-3 text-right text-muted-foreground"
                        title={`Model figure: ${opp.winProbability}% — ${WIN_PROBABILITY_CAVEAT}`}
                      >
                        {likelihoodBand(opp.winProbability).label}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatMoneyCompact(opp.expectedValue, opp.currency)}
                      </td>
                      {/* Estimated value at risk. An estimate of a share of
                          an estimate, so the column header says so; the score
                          is explained in full on the deal itself. */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {opp.atRisk > 0 ? (
                          <span className="font-medium text-rose-600 dark:text-rose-400">
                            {formatMoneyCompact(opp.atRisk, opp.currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                          {opp.primaryLeak?.summary ??
                            opp.whyNow[0]?.replace(/^[+−-]\s*/, "") ??
                            "Steady engagement."}
                        </span>
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <span className="line-clamp-2 text-[13px] leading-snug">
                          {opp.nextAction.headline}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground",
        align === "right" && "text-right"
      )}
    >
      {children}
    </th>
  );
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 tabular-nums",
          emphasis ? "text-xl font-semibold tracking-tight" : "text-lg font-medium"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function StagePill({ stage }: { stage: string }) {
  const style: Record<string, string> = {
    NEW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    QUALIFYING: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    MEETING: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    PROPOSAL: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    NEGOTIATION: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    WON: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    LOST: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        style[stage] ?? style.NEW
      )}
    >
      {STAGE_LABELS[stage as OpportunityStage] ?? stage}
    </span>
  );
}

/**
 * The first screen of an empty workspace.
 *
 * It used to be a single "Build opportunities from my accounts" button, which
 * was both the wrong default and the wrong promise: an account is a company
 * that exists, not a deal someone is working, and turning every one of them
 * into an opportunity produces a pipeline of noise that the ranking then has
 * to sort. Three deliberate paths instead, each stating what it actually does.
 */
function PipelineOnboarding({
  hubspotReady,
  sandbox,
}: {
  hubspotReady: boolean;
  sandbox: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-8 md:p-10">
      <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
        Bring in your pipeline
      </h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        Connect your sales data or explore Selryn with a ready-made pipeline.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <OnboardingOption
          title="Connect HubSpot"
          body="Sync companies, contacts, deals and activity. Selryn reads them; HubSpot stays the system of record."
          // Never offered as live when the deployment cannot complete the
          // OAuth exchange — a connect button that 503s is worse than a label.
          status={
            sandbox ? "unavailable" : hubspotReady ? "ready" : "setup-required"
          }
          statusLabel={
            sandbox
              ? "Real workspace only"
              : hubspotReady
                ? undefined
                : "Setup required"
          }
          href="/api/integrations/hubspot/connect"
          cta="Connect HubSpot"
          note={
            sandbox
              ? "Sandbox workspaces cannot hold a real CRM credential."
              : hubspotReady
                ? undefined
                : "This deployment has no HubSpot credentials configured yet."
          }
        />

        <OnboardingOption
          title="Import a spreadsheet"
          body="Upload your open deals — company, stage, value, last contact and next step. Re-importing the same file updates them rather than creating duplicates."
          status={sandbox ? "unavailable" : "ready"}
          statusLabel={sandbox ? "Real workspace only" : undefined}
          href="/opportunities/import"
          cta="Import deals"
          note={
            sandbox
              ? "Sample workspaces cannot import a real pipeline."
              : "A template is provided, and every rejected row is reported with its line number."
          }
        />

        <OnboardingOption
          title="Explore with sample data"
          body="Load a fictional workspace and walk the whole loop — signals, risk, a recommended action, approval and the revenue outcome."
          status="ready"
          href="/settings"
          cta="Load sample data"
          note="Nothing is ever sent to the invented companies, and you can clear it in one click."
        />
      </div>
    </section>
  );
}

function OnboardingOption({
  title,
  body,
  status,
  statusLabel,
  href,
  cta,
  note,
}: {
  title: string;
  body: string;
  status: "ready" | "setup-required" | "unavailable";
  statusLabel?: string;
  href: string;
  cta: string;
  note?: string;
}) {
  const ready = status === "ready";
  return (
    <div className="flex flex-col rounded-xl border border-border/70 bg-background p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {statusLabel && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {statusLabel}
          </span>
        )}
      </div>
      <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-muted-foreground">
        {body}
      </p>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4">
        {ready ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href}>{cta}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {cta}
          </Button>
        )}
      </div>
    </div>
  );
}
