import Link from "next/link";
import { Archive, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { getRecoveryCandidates } from "@/lib/recovery/queries";
import { RecoveryCard } from "@/components/recovery/recovery-card";

export const metadata = { title: "Overlooked opportunities" };

/** Why a deal was set aside, said plainly rather than hidden. */
const SET_ASIDE_LABEL: Record<string, string> = {
  never_engaged: "never got a real conversation going",
  too_recent: "too recent to count as dormant",
  no_qualifying_rule: "nothing specific to reconnect about",
  "excluded:do_not_contact": "marked do-not-contact",
  "excluded:explicit_rejection": "told you no",
  "excluded:user_excluded": "excluded by you",
  "excluded:unsubscribed": "unsubscribed",
};

/**
 * Find overlooked opportunities in your existing pipeline.
 *
 * The discipline here is subtractive. Any CRM has hundreds of dormant rows
 * and calling them all opportunities is both easy and useless, so this page
 * shows only deals where something specific makes reconnecting reasonable,
 * and states how many it set aside and why.
 *
 * There is no total. Summing deal values into "recoverable revenue" would be
 * a number nobody could stand behind.
 */
export default async function RecoveryPage() {
  const session = await requireSession();
  const { items, considered, setAside } = await getRecoveryCandidates(session.orgId);

  const header = (
    <PageHeader
      title="Overlooked opportunities"
      description="Dormant deals where something specific makes it worth reconnecting — a proposal never answered, a date they asked you to revisit, or a reason for losing that may no longer hold."
    />
  );

  if (considered === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Search}
          title="No deals to look through yet"
          description="Once your CRM has synced, Selryn looks through deals that have gone quiet and surfaces the ones worth another conversation."
        >
          <Button asChild>
            <Link href="/integrations">Connect your CRM</Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Archive}
          title="Nothing worth reopening right now"
          description={`Selryn looked through ${considered} deals. None of them has a specific reason to reconnect today — an old record on its own is not an opportunity.`}
        >
          <Button asChild variant="ghost">
            <Link href="/dashboard">Back to today</Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  const setAsideLines = Object.entries(setAside)
    .filter(([key]) => SET_ASIDE_LABEL[key])
    .sort((a, b) => b[1] - a[1]);

  return (
    <>
      {header}

      <p className="mb-5 text-sm text-muted-foreground">
        {items.length} of {considered} deals have a specific reason to reconnect.
      </p>

      <div className="space-y-4">
        {items.map((item) => (
          <RecoveryCard
            key={item.opportunityId}
            item={{
              ...item,
              lastActivityAt: item.lastActivityAt?.toISOString() ?? null,
            }}
          />
        ))}
      </div>

      {setAsideLines.length > 0 && (
        <section className="mt-8 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Set aside
          </h2>
          <ul className="mt-2 space-y-1">
            {setAsideLines.map(([key, count]) => (
              <li key={key} className="text-[13px] text-muted-foreground">
                {count} {SET_ASIDE_LABEL[key]}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            Deals marked do-not-contact, unsubscribed, or that told you no are
            never surfaced here, whatever they were worth.
          </p>
        </section>
      )}
    </>
  );
}
