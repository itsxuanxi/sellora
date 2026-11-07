import Link from "next/link";
import { CheckCircle2, Plug } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFollowUps } from "@/lib/followup/queries";
import { TOP_FOLLOW_UPS } from "@/lib/followup/rules";
import { FollowUpCard } from "@/components/followup/follow-up-card";
import { FollowUpList } from "@/components/followup/follow-up-list";
import { RiskSummary } from "@/components/followup/risk-summary";
import { summarizeRisks } from "@/lib/risk/map";
import { TOUR_ACCOUNT, TOUR_CARD_ANCHOR } from "@/lib/tour/steps";

export const metadata = { title: "Today" };

/**
 * Today — the product's entry point.
 *
 * One question: which deals need me now, why, and what do I do about it? The
 * band at the top is detection (how much is on fire); the list below it is the
 * decision (what to do first). They are on one screen deliberately: a count of
 * problems with no list is an anxiety generator, and a list with no count
 * leaves the reader unsure whether they are looking at all of it.
 *
 * The page leads with three cards because a list of forty is a list nobody
 * works; the rest are one click away rather than hidden. Every card carries
 * the reason, the records behind it, how old those records are, and the work
 * itself — draft, edit, send, or an outline to call from.
 *
 * There is no forecast here. Nothing is ranked by a win probability Selryn
 * estimated, because a seller cannot argue with a number we invented, and
 * nothing is ranked by deal value alone. Ordering comes from the rules in
 * lib/followup/rules.ts: a missed commitment, then an unanswered question,
 * then a silent proposal, then a deal with no agreed next step, then dormancy
 * — with opportunity value breaking ties and data freshness disclosed.
 */
export default async function TodayPage() {
  const session = await requireSession();

  const [items, connection, opportunityCount] = await Promise.all([
    getFollowUps(session.orgId),
    db.integrationConnection.findFirst({
      where: { orgId: session.orgId, status: "ACTIVE" },
      select: { provider: true, lastSyncSucceededAt: true },
    }),
    db.opportunity.count({ where: { orgId: session.orgId } }),
  ]);

  const header = (
    <PageHeader
      title="Today"
      description="Proposals going quiet, why each needs you now, and the next follow-up to send. Ordered by what you can act on today — not by deal size."
    />
  );

  // ── Nothing connected yet ──
  if (!connection && opportunityCount === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Plug}
          selly="mug"
          title="Bring your deals in to see what is slipping"
          description="Selryn reads your open proposals and the email history on them, then shows which have gone quiet — a follow-up date that passed, a proposal nobody answered, a meeting with no next step — with the records behind each one. A spreadsheet is enough to start; connecting a CRM adds the email history."
        >
          <Button asChild>
            <Link href="/opportunities/import">Import a spreadsheet</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/integrations">Connect a CRM</Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  // ── Connected, but nothing to do ──
  if (items.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={CheckCircle2}
          selly="sleep"
          title="Nothing needs you today"
          description={
            opportunityCount === 0
              ? "No open deals have synced yet. Once your CRM has deals with activity, the ones that go quiet will appear here."
              : "Every open proposal has been answered, has a future follow-up date, or has nothing specific in the way."
          }
        >
          <Button asChild variant="ghost">
            <Link href="/opportunities">See all deals</Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  const top = items.slice(0, TOP_FOLLOW_UPS);
  const rest = items.slice(TOP_FOLLOW_UPS);

  // Dates cross the server/client boundary as strings.
  const serialize = (i: (typeof items)[number]) => ({
    ...i,
    lastActivityAt: i.lastActivityAt?.toISOString() ?? null,
    evidence: i.evidence.map((e) => ({ ...e, occurredAt: e.occurredAt.toISOString() })),
  });

  return (
    <>
      {header}

      <RiskSummary risks={summarizeRisks(items)} total={opportunityCount} />

      <section aria-label="Start here" className="space-y-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Start here
        </h2>
        {/* The guided demo anchors on its own deal by name, not on whichever
            card is first. Pinning it to position sent the visitor into one
            deal while the next seven steps described another. */}
        {top.map((item) => (
          <FollowUpCard
            key={item.opportunityId}
            item={serialize(item)}
            featured
            tourAnchor={
              session.org.isSample && item.accountName === TOUR_ACCOUNT
                ? TOUR_CARD_ANCHOR
                : undefined
            }
          />
        ))}
      </section>

      {rest.length > 0 && (
        <FollowUpList items={rest.map(serialize)} total={items.length} />
      )}

      {/* If the tour's deal is not among the three featured cards, the tour
          would anchor on nothing. Say where it is rather than letting the
          coachmark float unanchored over a list. */}
      {session.org.isSample &&
        !top.some((i) => i.accountName === TOUR_ACCOUNT) &&
        items.some((i) => i.accountName === TOUR_ACCOUNT) && (
          <p className="mt-4 text-[12px] text-muted-foreground">
            The guided demo follows {TOUR_ACCOUNT}, which is further down
            today&apos;s list.
          </p>
        )}

      <p className="mt-8 text-[12px] leading-relaxed text-muted-foreground">
Every risk above comes from your own deal records and their email history
        {connection?.lastSyncSucceededAt && (
          <> · last synced {new Date(connection.lastSyncSucceededAt).toLocaleString()}</>
        )}
        . Deal values are shown only where your CRM holds one.
      </p>
    </>
  );
}
