import { Reveal, Section, SectionLabel } from "@/components/marketing/section";

/**
 * §4 — the problem, stated as attention loss rather than tooling gaps.
 *
 * Three short blocks, one hairline-divided row. No cards: the page already
 * uses bordered panels for product surfaces, and repeating that shape for
 * prose would flatten the hierarchy between "this is the product" and "this
 * is an argument".
 */

const LEAKS = [
  {
    n: "01",
    title: "Signals get missed",
    body: "Proposals reopen, stakeholders join, and intent increases without anyone noticing.",
  },
  {
    n: "02",
    title: "Deals quietly go cold",
    body: "Days pass after demos and follow-ups disappear between CRM tasks.",
  },
  {
    n: "03",
    title: "Reps work the wrong accounts",
    body: "Full deal value is mistaken for real opportunity, so attention goes to the loudest deal instead of the most valuable one.",
  },
];

export function Problem() {
  return (
    <Section id="problem">
      <Reveal>
        <SectionLabel number="01" label="The problem" />
        <h2 className="mt-8 max-w-3xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          Your pipeline isn&rsquo;t empty.
          <br />
          <span className="text-neutral-400">Attention is leaking.</span>
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-px overflow-hidden border-y border-white/[0.08] bg-white/[0.08] md:grid-cols-3">
        {LEAKS.map((leak, i) => (
          <Reveal key={leak.n} delay={i * 80} className="h-full">
            <div className="flex h-full flex-col bg-[#09090B] px-6 py-8">
              <span className="font-mono text-[12px] text-violet-300/80">{leak.n}</span>
              <h3 className="mt-4 text-lg font-medium tracking-tight text-white">
                {leak.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-neutral-300">
                {leak.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
