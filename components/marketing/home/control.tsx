import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Section, SectionLabel } from "@/components/marketing/section";

/**
 * §9 — trust and control.
 *
 * Every line here was checked against the codebase before being written, and
 * anything not actually implemented is marked "Planned" rather than dropped
 * or quietly implied. Specifically:
 *
 *  - Human approval — real. lib/intent/drafts.ts routes every send through
 *    approveOutreachDraft(), an explicit user action; nothing sends on its own.
 *  - No model training — real, and trivially so: there is no training code in
 *    the product at all. Scoring is a hand-tuned rule set.
 *  - Reasoning shown — real. Every score persists its factor breakdown and
 *    every recommendation stores its rationale.
 *  - Audit trail — real. AgentAction records each operation with actor and
 *    timestamp.
 *  - Role-based access — NOT real. `User.role` exists as a column but is
 *    never enforced anywhere in the codebase, so it is marked Planned.
 *  - SSO and two-way CRM sync — not built. Planned.
 *
 * No security certifications are claimed, because none have been obtained.
 */

const CONTROLS: {
  title: string;
  body: string;
  status: "available" | "planned";
}[] = [
  {
    title: "Works alongside your existing CRM",
    body: "Sellora is an intelligence layer, not a replacement system of record. Your CRM stays where it is.",
    status: "available",
  },
  {
    title: "Human approval for customer-facing actions",
    body: "Nothing reaches a prospect without someone approving it. Drafts are generated; sending is always an explicit action.",
    status: "available",
  },
  {
    title: "Your data is not used to train shared models",
    body: "Sellora trains no models on your pipeline. Scoring is a documented, hand-tuned rule set you can read.",
    status: "available",
  },
  {
    title: "Clear reasoning behind every recommendation",
    body: "Each score keeps its full factor breakdown and each recommendation stores the evidence it was based on.",
    status: "available",
  },
  {
    title: "Auditable action history",
    body: "Every operation is recorded with who requested it, who approved it, and when it ran.",
    status: "available",
  },
  {
    title: "Role-based access and SSO",
    body: "Workspace roles and single sign-on for larger teams.",
    status: "planned",
  },
];

export function Control() {
  return (
    <Section id="security" className="bg-white/[0.012]">
      <Reveal>
        <SectionLabel number="06" label="Trust & control" />
        <h2 className="mt-8 max-w-2xl text-balance text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          Your pipeline. Your decisions.
        </h2>
        <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-neutral-300">
          Sellora makes the case for an action. A person still decides whether
          it happens.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {CONTROLS.map((c, i) => (
          <Reveal key={c.title} delay={i * 60}>
            <div className="flex gap-3.5">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  c.status === "available"
                    ? "border-violet-400/30 bg-violet-400/10 text-violet-300"
                    : "border-white/[0.12] text-neutral-400"
                )}
                aria-hidden
              >
                {c.status === "available" ? (
                  <Check className="size-3" />
                ) : (
                  <Clock className="size-3" />
                )}
              </span>
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-white">
                  {c.title}
                  {c.status === "planned" && (
                    <span className="rounded border border-white/[0.12] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400">
                      Planned
                    </span>
                  )}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-300">
                  {c.body}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <p className="mt-12 max-w-2xl border-t border-white/[0.08] pt-6 text-[13px] leading-relaxed text-neutral-400">
          Sellora holds no third-party security certification at this time, and
          we do not claim one. If your procurement process requires a security
          review, contact us and we will work through it with you directly.
        </p>
      </Reveal>
    </Section>
  );
}
