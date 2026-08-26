import { Reveal, Section, SectionLabel } from "@/components/marketing/section";

/**
 * §16's problem and solution sections. Placed immediately after the hero so
 * the repositioning lands before any product detail: the reader should
 * recognise their own pipeline in the problem before Sellora is described.
 */

const losses = [
  "Hot leads are contacted too late",
  "Follow-ups get forgotten",
  "Buying signals go unnoticed",
  "Salespeople prioritize the wrong accounts",
  "Promising deals quietly go cold",
  "CRM data doesn't tell teams what to do next",
];

const questions = [
  {
    q: "Who should we contact?",
    a: "Every open deal, ranked by expected revenue — value × likelihood — so attention flows to where it earns most.",
  },
  {
    q: "Why now?",
    a: "The specific evidence: a proposal opened twice, a second stakeholder joining, four days of silence after a demo.",
  },
  {
    q: "What should we do?",
    a: "One recommended action per opportunity, with the reasoning attached. Not five options — one.",
  },
  {
    q: "How much is at stake?",
    a: "A number on every deal, discounted by how likely it actually is. Never the full deal value dressed up as risk.",
  },
];

export function RevenueLeak() {
  return (
    <>
      <Section id="problem">
        <Reveal>
          <SectionLabel number="01" label="The problem" />
          <h2 className="mt-8 max-w-3xl text-balance text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Your pipeline already contains revenue.
            <br />
            <span className="text-neutral-500">
              You&rsquo;re just losing it between interactions.
            </span>
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <p className="mt-8 max-w-xl text-pretty text-lg leading-relaxed text-neutral-400">
            Most lost deals were never lost on the merits. They were lost in the
            gaps — the follow-up nobody sent, the signal nobody saw, the week
            that quietly passed.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
          {losses.map((item, i) => (
            <Reveal key={item} delay={i * 60} className="h-full">
              <div className="flex h-full items-start gap-3 bg-[#050506] p-6">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-500/70"
                  aria-hidden
                />
                <span className="text-[15px] leading-relaxed text-neutral-300">
                  {item}
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className="mt-10 max-w-xl text-pretty text-lg leading-relaxed text-neutral-400">
            Sellora watches for these gaps continuously, prices what each one is
            costing you, and puts the fix in front of the right person.
          </p>
        </Reveal>
      </Section>

      <Section id="solution" className="bg-white/[0.012]">
        <Reveal>
          <SectionLabel number="02" label="The solution" />
          <h2 className="mt-8 max-w-2xl text-balance text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Your AI revenue intelligence layer.
          </h2>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-neutral-400">
            Sellora monitors your pipeline and answers four questions — the only
            four that decide whether a quarter lands.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {questions.map((item, i) => (
            <Reveal key={item.q} delay={i * 80} className="h-full">
              <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7">
                <h3 className="text-xl font-medium tracking-tight text-white">
                  {item.q}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-neutral-400">
                  {item.a}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={140}>
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-7 py-6">
            <p className="text-[15px] leading-relaxed text-neutral-400">
              <span className="text-violet-300">The scarce resource in sales
              isn&rsquo;t email-writing ability. It&rsquo;s attention.</span>{" "}
              Sellora continuously works out where a rep&rsquo;s next hour creates
              the most expected revenue — and shows its reasoning every time, so
              you can disagree with it.
            </p>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
