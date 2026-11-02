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

export const metadata = { title: "Today" };

/**
 * Today's follow-ups — the workbench.
 *
 * One question: which deals need me today, and why? The page leads with three
 * because a list of forty is a list nobody works; the rest are one click away
 * rather than hidden. Every row carries the reason and the records behind it,
 * and the work — draft, edit, send — happens here rather than three screens in.
 *
 * There is no forecast on this page. Nothing is ranked by a win probability
 * Selryn estimated, because a seller cannot argue with a number we invented.
 * See lib/followup/rules.ts.
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
      title="What's blocking your proposals"
      description="Open proposals with something specific in the way, the records behind it, and one thing to do next. Ordered by what you can act on today."
    />
  );

  // ── Nothing connected yet ──
  if (!connection && opportunityCount === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Plug}
          title="Connect your CRM to see what's blocking your proposals"
          description="Selryn reads your deals and their email history from HubSpot, then shows what is actually in the way of each one — an unanswered pricing question, an open scope point, a missed follow-up — with the emails behind it."
        >
          <Button asChild>
            <Link href="/intent">Connect HubSpot</Link>
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
          title="Nothing is blocked today"
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

      <section aria-label="Start here" className="space-y-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Start here
        </h2>
        {top.map((item, i) => (
          <FollowUpCard
            key={item.opportunityId}
            item={serialize(item)}
            featured
            tourAnchor={i === 0 ? "follow-up-1" : undefined}
          />
        ))}
      </section>

      {rest.length > 0 && (
        <FollowUpList items={rest.map(serialize)} total={items.length} />
      )}

      <p className="mt-8 text-[12px] leading-relaxed text-muted-foreground">
Blockers come from your own CRM records and their email history
        {connection?.lastSyncSucceededAt && (
          <> · last synced {new Date(connection.lastSyncSucceededAt).toLocaleString()}</>
        )}
        . Deal values are shown only where your CRM holds one.
      </p>
    </>
  );
}
