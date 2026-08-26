import { Reveal } from "@/components/marketing/section";

/**
 * Trust strip (§3).
 *
 * There are no customer logos here because there are no customers to name yet,
 * and inventing them is the fastest way to lose a buyer who checks. Instead
 * this states who the product is for and what it connects to — with each
 * integration carrying an honest status.
 *
 * The status split is drawn from the codebase, not from a wish list:
 * CSV/manual signal ingestion, Google sign-in and outbound email are
 * implemented; the CRM connectors are not, so they are labelled "On the
 * roadmap" rather than listed as if they shipped.
 *
 * The three outcome metrics are unfilled placeholders. They stay unfilled
 * until there is measured data — a made-up "37% faster follow-up" is worth
 * less than an honest blank.
 */

const INTEGRATIONS: { name: string; status: "available" | "roadmap" }[] = [
  { name: "CSV signal import", status: "available" },
  { name: "Google sign-in", status: "available" },
  { name: "Outbound email", status: "available" },
  { name: "HubSpot", status: "roadmap" },
  { name: "Salesforce", status: "roadmap" },
  { name: "Pipedrive", status: "roadmap" },
  { name: "Gmail sync", status: "roadmap" },
  { name: "Calendar", status: "roadmap" },
];

const METRICS = [
  { label: "faster follow-up", note: "Measured against your baseline" },
  { label: "hours saved per rep each week", note: "Measured against your baseline" },
  { label: "more pipeline coverage", note: "Measured against your baseline" },
];

export function TrustBar() {
  const available = INTEGRATIONS.filter((i) => i.status === "available");
  const roadmap = INTEGRATIONS.filter((i) => i.status === "roadmap");

  return (
    <section className="border-b border-white/[0.06] px-5 py-14 md:px-8 md:py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
            Built for B2B revenue teams
          </p>
        </Reveal>

        {/* ── Integrations, with honest status ── */}
        <Reveal delay={80}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5">
            {available.map((i) => (
              <span
                key={i.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.03] px-3 py-1.5 text-[13px] text-neutral-200"
              >
                <span className="size-1.5 rounded-full bg-violet-400" aria-hidden />
                {i.name}
              </span>
            ))}
            {roadmap.map((i) => (
              <span
                key={i.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/[0.10] px-3 py-1.5 text-[13px] text-neutral-400"
              >
                {i.name}
              </span>
            ))}
          </div>
          <p className="mt-4 text-center text-[12px] text-neutral-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-violet-400" aria-hidden />
              Available today
            </span>
            <span className="mx-3 text-neutral-600" aria-hidden>
              ·
            </span>
            <span className="border-b border-dashed border-white/20 pb-px">
              Dashed
            </span>{" "}
            = on the roadmap, not yet shipped
          </p>
        </Reveal>

        {/* ── Outcome metrics: explicit placeholders ── */}
        <Reveal delay={140}>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-3">
            {METRICS.map((m) => (
              <div key={m.label} className="bg-[#0B0B0F] px-6 py-7 text-center">
                <div
                  className="text-3xl font-medium tracking-tight text-neutral-500"
                  aria-label="Metric pending measurement"
                >
                  &mdash;
                </div>
                <div className="mt-2 text-[13px] leading-snug text-neutral-300">
                  {m.label}
                </div>
                <div className="mt-2 text-[11px] text-neutral-400">{m.note}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[12px] text-neutral-400">
            We publish outcome numbers once they are measured with real
            customers, not before.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
