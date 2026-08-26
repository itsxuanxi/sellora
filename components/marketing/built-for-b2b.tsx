import { Building2, Rocket, Users } from "lucide-react";
import { Reveal, Section, SectionLabel } from "@/components/marketing/section";

const audiences = [
  {
    icon: Rocket,
    title: "B2B SaaS startups",
    body: "Run a full outbound and inbound motion before you can afford a sales team.",
  },
  {
    icon: Users,
    title: "Sales & growth teams",
    body: "Give every rep an army of agents handling the busywork so they can close.",
  },
  {
    icon: Building2,
    title: "Agencies selling software",
    body: "Operate pipelines for every client from one place, without adding headcount.",
  },
];

const assurances = [
  "Works alongside your CRM — no rip-and-replace",
  "Your data is yours; never used to train models",
  "Human-in-the-loop on anything that ships",
];

export function BuiltForB2B() {
  return (
    <Section id="b2b" className="bg-white/[0.012]">
      <Reveal>
        <SectionLabel number="07" label="Built for B2B teams" />
        <h2 className="mt-8 max-w-2xl text-balance text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          Made for teams that live and die by pipeline.
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {audiences.map((a, i) => (
          <Reveal key={a.title} delay={i * 80} className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7">
              <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-violet-300">
                <a.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-medium tracking-tight text-white">
                {a.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-neutral-400">
                {a.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-7 py-6">
          {assurances.map((item) => (
            <span key={item} className="text-sm text-neutral-400">
              <span className="mr-2 text-violet-400">✓</span>
              {item}
            </span>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}
