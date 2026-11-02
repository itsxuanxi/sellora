import { STATS_CAVEAT, type StatLine } from "@/lib/followup/tracking";

/**
 * How Selryn's follow-up suggestions actually did.
 *
 * Sits beside revenue attribution deliberately. Those figures trace money to
 * recommendations; these do not, and say so — a follow-up is followed by a
 * meeting or it is not, and the gap between "afterwards" and "because of" is
 * where most sales analytics quietly loses its credibility.
 */
export function FollowUpStats({ lines }: { lines: StatLine[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">Follow-ups</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What came of the follow-ups Selryn drafted for you.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {lines.map((line) => (
          <div key={line.label} className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {line.label}
            </div>
            <div className="mt-1.5 text-3xl font-semibold tabular-nums">{line.value}</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {line.definition}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {STATS_CAVEAT}
      </p>
    </section>
  );
}
