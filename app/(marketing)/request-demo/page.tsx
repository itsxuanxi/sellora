import type { Metadata } from "next";
import { Check } from "lucide-react";
import { RequestDemoForm } from "@/components/marketing/request-demo-form";
import { DEMO_INBOX } from "@/lib/marketing/demo-request";

export const metadata: Metadata = {
  // Absolute, so the root layout's " · Selryn" template does not double the
  // brand up into "Request a Demo | Selryn · Selryn".
  title: { absolute: "Request a Demo | Selryn" },
  description:
    "Tell us how your agency's proposals run today, and we will walk through what Selryn would have caught on them.",
};

/**
 * The demo request page.
 *
 * Replaces a mailto link, which asked a visitor to open a mail client, invent
 * a subject line and guess what we needed to know. Four fields are required
 * — name, work email, company, and which deals are slipping — and six more
 * are optional because they shape a useful walkthrough without being worth
 * losing a request over. Role and team size used to be required, and they are
 * the two a founder is least sure how to answer.
 *
 * Two columns on desktop at roughly 48/52: the value proposition earns the
 * scroll, the form takes the slightly larger half because it is the work.
 * Below lg they stack, copy first.
 */

const POINTS = [
  "A walkthrough of your own follow-up process, not a slide deck",
  "What Selryn would have flagged on your proposals, and on what evidence",
  "A straight answer on what is built, what needs setting up, and what is not written yet",
];

/**
 * Categories, not logos.
 *
 * Selryn has no customer logos it can truthfully show, and a "Trusted by"
 * strip of invented marks is the exact kind of claim this product is built to
 * argue against. Saying who it is built for is true and costs nothing.
 */
// Kinds of agency, not a list of every market that might buy. "B2B SaaS,
// Sales Teams, Revenue Operations, Agencies" named four audiences, three of
// which the product is not aimed at, and a reader who is none of the first
// three stops reading before the fourth.
const AUDIENCE = [
  "Design & brand",
  "Marketing & growth",
  "Development & product",
  "Consulting",
];

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
            Tell us which proposals go quiet on you.
          </h1>

          <p className="mt-6 text-pretty text-[16.5px] leading-relaxed text-[var(--mkt-muted)]">
            Describe how your pitches and proposals actually run today, and
            we&apos;ll walk through what Selryn would have caught on them
            &mdash; which ones it would have flagged, on what evidence, and
            what it would have suggested you send.
          </p>

          <p className="mt-4 text-pretty text-[15px] leading-relaxed text-[var(--mkt-ink)]">
            If you would rather just look first, the{" "}
            <span className="font-medium">guided demo</span> runs the whole
            thing on sample data with no sign-up.
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
              Built for small B2B agencies
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
