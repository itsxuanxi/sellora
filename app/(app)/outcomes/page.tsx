import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import { ActionQueue } from "@/components/outcomes/action-queue";
import { OutcomeSummary } from "@/components/outcomes/outcome-summary";

export const metadata = { title: "Outcomes" };

/**
 * Outcome learning: what we did, what came back, and what moved.
 *
 * Two views of one loop, which used to be two nav entries. Actions showed the
 * queue — recommended, approved, sent — and Impact showed the aggregate, and
 * because they were separate pages neither showed the thing that matters:
 * that a recommendation leads to an action, an action to a buyer response, and
 * a response to a deal moving or not. Here they are tabs, and the ledger is
 * the default because a specific row with a date on it is more useful than a
 * total.
 *
 * What this page deliberately does not claim: that Selryn learns from any of
 * it. The feedback records are real and complete — accepted, edited,
 * dismissed, completed, and what the buyer did next are all stored and shown.
 * Nothing yet reads them back to change a recommendation. Saying otherwise
 * would be the easiest and worst lie available on this screen.
 */

type View = "actions" | "progress";

const VIEWS: { key: View; label: string; note: string }[] = [
  {
    key: "actions",
    label: "Actions & responses",
    note: "Every recommendation, what a human decided, and what the buyer did next.",
  },
  {
    key: "progress",
    label: "What moved",
    note: "Responses in aggregate, and the deals that actually progressed.",
  },
];

export default async function OutcomesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const view = (VIEWS.find((v) => v.key === params.view)?.key ?? "actions") as View;
  const active = VIEWS.find((v) => v.key === view)!;

  return (
    <>
      <PageHeader
        title="Outcomes"
        description="What Selryn recommended, what you did, what the buyer did, and whether the deal moved."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/outcomes?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              view === v.key
                ? "border-primary/30 bg-accent font-medium text-accent-foreground"
                : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <p className="mb-5 text-sm text-muted-foreground">{active.note}</p>

      {view === "actions" ? (
        <ActionQueue filter={params.filter} />
      ) : (
        <OutcomeSummary />
      )}

      {/* Stated on the page, not only in a comment. A product that records
          feedback and does not use it yet should say so, or the user will
          assume the list is getting smarter on its own. */}
      <p className="mt-8 border-t border-border/70 pt-4 text-[12px] leading-relaxed text-muted-foreground">
        Selryn records every decision and response here, and shows them back to
        you. It does not yet adjust its own recommendations from this history —
        when that lands it will be described on this page.
      </p>
    </>
  );
}
