import Link from "next/link";
import { BASIS_HELP, BASIS_LABEL, RISK_DESCRIPTION, type RiskBasis, type RiskKind } from "@/lib/risk/kinds";
import { cn } from "@/lib/utils";

/**
 * The risk band at the top of Today.
 *
 * Its job is to answer "how much is on fire?" in one glance, before the list
 * answers "what do I do first?". Two things it has to get right, both of
 * which are easy to get wrong in a dashboard:
 *
 * **It counts deals, not findings.** A deal with an overdue follow-up and an
 * unanswered question is one deal needing attention. Counting it in both
 * columns would make the band total more than the list beneath it, and a
 * summary that disagrees with the thing it summarises is worth less than no
 * summary. Each deal appears under its leading risk only — the one its card
 * shows.
 *
 * **It says which claims are read and which are reasoned.** An overdue
 * follow-up is two stored dates compared; an unanswered question depends on
 * having understood a sentence and on having seen every reply. Rendering them
 * identically teaches the reader to discount both.
 */
export function RiskSummary({
  risks,
  total,
}: {
  risks: { kind: RiskKind; label: string; basis: RiskBasis; count: number }[];
  total: number;
}) {
  if (risks.length === 0) return null;

  const counted = risks.reduce((s, r) => s + r.count, 0);

  return (
    <section aria-label="Detected risks" className="mb-6">
      <div className="flex flex-wrap items-stretch gap-2">
        {risks.map((r) => (
          <div
            key={r.kind}
            title={`${RISK_DESCRIPTION[r.kind]} ${BASIS_HELP[r.basis]}`}
            className="min-w-[9.5rem] flex-1 rounded-xl border border-border/70 bg-card px-4 py-3"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{r.count}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]",
                  r.basis === "observed"
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                )}
              >
                {BASIS_LABEL[r.basis]}
              </span>
            </div>
            <div className="mt-0.5 text-[13px] font-medium leading-snug">{r.label}</div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[12px] text-muted-foreground">
        {counted} {counted === 1 ? "deal" : "deals"} need attention
        {counted !== total && ` of ${total} open`}. Each is counted once, under the
        reason its card shows.{" "}
        <Link href="/opportunities" className="underline hover:text-foreground">
          See all deals
        </Link>
      </p>
    </section>
  );
}
