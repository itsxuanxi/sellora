import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { Reveal, Section, SectionLabel } from "@/components/marketing/section";
import { isClerkEnabled } from "@/lib/flags";

export function Pricing() {
  const startHref = isClerkEnabled ? "/sign-up" : "/sign-in";
  return (
    <Section id="pricing">
      <Reveal className="text-center">
        <div className="flex justify-center">
          <SectionLabel number="08" label="Pricing" />
        </div>
        <h2 className="mt-8 text-balance text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          Costs less than a coffee budget. Sells like a team.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-neutral-400">
          Start free, upgrade when the meetings start landing. Cancel anytime.
        </p>
      </Reveal>
      <Reveal delay={100}>
        <PricingTiers startHref={startHref} />
      </Reveal>
    </Section>
  );
}
