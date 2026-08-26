import { AgentGrid } from "@/components/marketing/agent-grid";
import { Reveal, Section, SectionLabel } from "@/components/marketing/section";

export function Agents() {
  return (
    <Section id="agents">
      <Reveal>
        <SectionLabel number="06" label="Agents for every sales workflow" />
        <h2 className="mt-8 max-w-2xl text-balance text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          A specialist for every step from click to closed.
        </h2>
      </Reveal>
      <AgentGrid />
    </Section>
  );
}
