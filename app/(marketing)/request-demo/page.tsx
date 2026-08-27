import type { Metadata } from "next";
import { Check } from "lucide-react";
import { RequestDemoForm } from "@/components/marketing/request-demo-form";
import { DEMO_INBOX } from "@/lib/marketing/demo-request";

export const metadata: Metadata = {
  // Absolute, so the root layout's " · Sellora" template does not double the
  // brand up into "Request a Demo | Sellora · Sellora".
  title: { absolute: "Request a Demo | Sellora" },
  description:
    "See where your pipeline is leaking revenue. Tell us how your sales team works today and we will build the walkthrough around it.",
};

/**
 * The demo request page.
 *
 * Replaces a mailto link, which asked a visitor to open a mail client, invent
 * a subject line and guess what we needed to know. The form asks the ten
 * things that actually shape a useful walkthrough, and the answers arrive in
 * one structured place rather than as free prose in an inbox.
 *
 * Two columns on desktop at roughly 48/52: the value proposition earns the
 * scroll, the form takes the slightly larger half because it is the work.
 * Below lg they stack, copy first.
 */

const POINTS = [
  "A walkthrough tailored to your sales motion",
  "Sample recommendations based on your use case",
  "Clear pricing and implementation next steps",
];

/**
 * Categories, not logos.
 *
 * Sellora has no customer logos it can truthfully show, and a "Trusted by"
 * strip of invented marks is the exact kind of claim this product is built to
 * argue against. Saying who it is built for is true and costs nothing.
 */
const AUDIENCE = ["B2B SaaS", "Sales Teams", "Revenue Operations", "Agencies"];

export default function RequestDemoPage() {
  return (
    <div className="relative isolate overflow-hidden">
      {/* Restrained depth only: a very low-opacity wash, no starfield. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(ellipse_60%_100%_at_70%_0%,rgba(103,87,229,0.08),transparent_72%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(240,241,246,0.55),transparent_45%)]"
        aria-hidden
      />

      <div className="mx-auto grid w-full max-w-[1240px] items-start gap-12 px-5 pb-20 pt-24 md:px-8 md:pt-28 lg:grid-cols-[minmax(0,48fr)_minmax(0,52fr)] lg:gap-14 lg:pb-24">
        {/* ── Left: why this is worth two minutes ── */}
        {/* Capped just under the 48% track so the measure stays readable
            without leaving the column visibly narrower than its share. */}
        <div className="min-w-0 lg:sticky lg:top-28 lg:max-w-[568px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-brand-deep)]">
            Request a demo
          </p>

          <h1 className="mt-5 text-balance text-[2.4rem] font-medium leading-[1.08] tracking-tight text-[var(--mkt-ink)] sm:text-[2.9rem] lg:text-[3.1rem]">
            See where your pipeline is leaking revenue.
          </h1>

          <p className="mt-6 text-pretty text-[16.5px] leading-relaxed text-[var(--mkt-muted)]">
            Tell us how your sales team works today. We&apos;ll show you which
            buying signals Sellora can detect, how it prioritizes opportunities,
            and what actions could move your deals forward.
          </p>

          <p className="mt-4 text-pretty text-[15px] leading-relaxed text-[var(--mkt-ink)]">
            You&apos;ll get a focused walkthrough built around your
            pipeline&mdash;not a generic product tour.
          </p>

          <ul className="mt-8 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--mkt-brand-wash)] text-[var(--mkt-brand-deep)]"
                  aria-hidden
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="text-[15px] leading-snug text-[var(--mkt-ink)]">
                  {point}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-[14px] text-[var(--mkt-muted)]">
            Prefer email?{" "}
            <a
              href={`mailto:${DEMO_INBOX}`}
              className="font-medium text-[var(--mkt-ink)] underline decoration-[var(--mkt-line)] underline-offset-4 transition-colors hover:text-[var(--mkt-brand-deep)]"
            >
              {DEMO_INBOX}
            </a>
          </p>

          <div className="mt-10 border-t border-[var(--mkt-line)] pt-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--mkt-muted)]">
              Built for B2B revenue teams
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--mkt-muted)]">
              {AUDIENCE.join(" · ")}
            </p>
          </div>
        </div>

        {/* ── Right: the form ── */}
        <div className="min-w-0">
          <RequestDemoForm />
        </div>
      </div>
    </div>
  );
}
