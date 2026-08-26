import { Reveal, Section, SectionLabel } from "@/components/marketing/section";

/**
 * §8 — who this is for.
 *
 * Each entry states a concrete work outcome rather than a slogan, because
 * "empower your team" tells a buyer nothing about whether the product fits
 * their motion.
 *
 * A different shape from the problem row above (asymmetric two-column rows
 * rather than three equal blocks) so the page does not read as the same card
 * repeated down the scroll.
 */

const AUDIENCES = [
  {
    n: "01",
    title: "B2B SaaS teams",
    outcome:
      "Founders and small teams working a pipeline without a dedicated ops function.",
    result:
      "Every morning starts with a ranked list instead of a CRM search. Deals that went quiet after a demo surface the same week, not at quarter-end review.",
  },
  {
    n: "02",
    title: "Sales and growth teams",
    outcome:
      "Reps carrying more accounts than they can genuinely cover.",
    result:
      "Attention goes to the deals with the highest expected revenue rather than the ones that shouted most recently. Proposal opens get followed up within a day instead of a week.",
  },
  {
    n: "03",
    title: "Revenue agencies",
    outcome:
      "Teams running pipeline for several clients from one place.",
    result:
      "Each client workspace reports its own revenue at risk and recovered, so a monthly update is a screenshot rather than a spreadsheet exercise.",
  },
];

export function Solutions() {
  return (
    <Section id="solutions">
      <Reveal>
        <SectionLabel number="05" label="Who it's for" />
        <h2 className="mt-8 max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          Built for teams that live by pipeline.
        </h2>
      </Reveal>

      <div className="mt-14 divide-y divide-white/[0.08] border-y border-white/[0.08]">
        {AUDIENCES.map((a, i) => (
          <Reveal key={a.n} delay={i * 70}>
            <div className="grid gap-4 py-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-10">
              <div>
                <span className="font-mono text-[12px] text-violet-300/80">{a.n}</span>
                <h3 className="mt-3 text-xl font-medium tracking-tight text-white">
                  {a.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-neutral-400">
                  {a.outcome}
                </p>
              </div>
              <p className="text-[15px] leading-relaxed text-neutral-300 md:pt-9">
                {a.result}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
