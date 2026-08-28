import Link from "next/link";
import { format, isToday, isYesterday } from "date-fns";
import { Radio } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import { formatMoney } from "@/lib/revenue/money";
import { getSignalFeed } from "@/lib/revenue/queries";

export const metadata = { title: "Signals" };

/**
 * Buying Signal Detection (§9) — every detected signal across the workspace,
 * newest first, with the money each one is attached to.
 *
 * Behavioural signals (someone chose to engage) are marked distinctly from
 * firmographic ones (something happened to the company), because they carry
 * very different weight in a rep's judgement.
 */
export default async function SignalsPage() {
  const session = await requireSession();
  const signals = await getSignalFeed(session.orgId);

  if (signals.length === 0) {
    return (
      <>
        <PageHeader
          title="Signals"
          description="Every buying signal Selryn has detected, newest first."
        />
        <EmptyState
          icon={Radio}
          title="No signals detected yet"
          description="Signals are the evidence behind every score. Connect a source or import them, and Selryn will start attaching intent to the money in your pipeline."
        >
          <Button asChild>
            <Link href="/intent">Set up signal sources</Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  // Group by day so the feed reads as a chronology, not a wall.
  const groups = new Map<string, typeof signals>();
  for (const s of signals) {
    const key = isToday(s.occurredAt)
      ? "Today"
      : isYesterday(s.occurredAt)
        ? "Yesterday"
        : format(s.occurredAt, "EEEE, MMM d");
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  const behaviouralToday = signals.filter(
    (s) => s.family === "behavioural" && isToday(s.occurredAt)
  ).length;

  return (
    <>
      <PageHeader
        title="Signals"
        description="Every buying signal Selryn has detected, newest first."
      >
        <Button asChild variant="outline">
          <Link href="/intent">Signal sources</Link>
        </Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-border/70 bg-card px-5 py-4">
        <Stat label="Active signals" value={String(signals.length)} />
        <Stat label="Buyer actions today" value={String(behaviouralToday)} />
        <Stat
          label="Accounts showing intent"
          value={String(new Set(signals.map((s) => s.accountId)).size)}
        />
      </div>

      <div className="space-y-7">
        {[...groups.entries()].map(([day, items]) => (
          <section key={day}>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {day}
            </h2>
            <ul className="mt-2.5 divide-y divide-border/60 rounded-2xl border border-border/70 bg-card">
              {items.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      s.family === "behavioural" ? "bg-primary" : "bg-muted-foreground/40"
                    )}
                    aria-hidden
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{s.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.opportunityId ? (
                          <Link
                            href={`/opportunities/${s.opportunityId}`}
                            className="hover:text-primary hover:underline"
                          >
                            {s.accountName}
                          </Link>
                        ) : (
                          s.accountName
                        )}
                      </span>
                      {s.sourceKind === "mock" && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          demo data
                        </span>
                      )}
                    </div>
                    {s.title && s.title !== s.label && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.title}</p>
                    )}
                    {s.evidence && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.evidence}</p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    {s.expectedValue != null && (
                      <div className="text-sm font-semibold tabular-nums">
                        {formatMoney(s.expectedValue)}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {format(s.occurredAt, "h:mm a")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
        Buyer action
        <span className="ml-3 size-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
        Company event
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-medium tabular-nums">{value}</div>
    </div>
  );
}
