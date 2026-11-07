"use client";

import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegrationClaim } from "@/lib/marketing/capabilities";
import { ProductDemos } from "@/components/marketing/home/product-demos";
import {
  RECORDED_STEPS,
  CAPABILITY_STATUS_HELP,
  TRUST_POINTS,
} from "@/components/marketing/home/demo-data";

/**
 * Screen 2 — "How does Selryn work, and why should I trust it?"
 *
 * Sits on the slightly deeper band so the three screens read as light →
 * slightly deeper → light, giving the page tonal structure without any dark
 * background.
 *
 * The layout deliberately differs from screen 1: tabs and the process
 * timeline occupy the left rail while the right side carries the changing
 * product surface, so the two carousels do not look like the same component
 * twice. Timeline and panel swap together, which is what makes it read as one
 * application doing different work.
 *
 * Step states follow the spec: completed steps get a green check, the step in
 * focus a solid purple dot with darker text, later steps stay muted, and a
 * risk step is marked with a small amber dot rather than tinting the row.
 */

export function Scenarios({
  integrations,
}: {
  /** Resolved server-side against this deployment's credentials — see
   *  lib/marketing/capabilities.ts for why this is not a constant. */
  integrations: IntegrationClaim[];
}) {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 border-y border-[var(--mkt-line)] bg-[var(--mkt-band)] px-5 py-20 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-brand-deep)]">
            How it works
          </p>
          <h2 className="mt-4 text-balance text-3xl font-medium leading-[1.12] tracking-tight text-[var(--mkt-ink)] sm:text-4xl md:text-[2.7rem]">
            One place for the proposals nobody has answered.
          </h2>
          <p className="mt-5 text-pretty text-[16px] leading-relaxed text-[var(--mkt-muted)]">
            Selryn reads your deal records and the email history on them —
            who wrote, when, and whether anyone replied — names what is
            overdue and why, and drafts the follow-up for you to approve. It
            sits beside whatever you use to track work; there is nothing to
            migrate.
          </p>
        </div>

        {/* ── Who → Why → What, interactive ──
               This replaced a scripted three-scenario panel that played a
               fixed sequence on a timer. Nothing in it was computed, so a
               visitor could not disagree with it and it went on
               demonstrating an ordering the product had already stopped
               using. The reorder below calls `rankFollowUps`, which is what
               Today calls. ── */}
        <ProductDemos />

        {/* ── Trust, folded in rather than given its own screen ── */}
        <div className="mt-16 grid gap-10 border-t border-[var(--mkt-line)] pt-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
              Integrations
            </h3>
            {/* Three states, because there are three real situations. The
                two-state version had to call a finished connector with no
                credentials either "available" — offering a connection nobody
                can make — or "planned", denying work that exists and is
                tested. The honest middle is "needs setup". */}
            <ul className="mt-4 flex flex-wrap gap-2">
              {integrations.map((it) => (
                <li key={it.name}>
                  <span
                    title={CAPABILITY_STATUS_HELP[it.status]}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]",
                      it.status === "available" &&
                        "border border-[var(--mkt-line)] bg-[var(--mkt-surface)] text-[var(--mkt-ink)]",
                      it.status === "needs_setup" &&
                        "border border-[var(--mkt-line)] text-[var(--mkt-ink)]",
                      it.status === "planned" &&
                        "border border-dashed border-[var(--mkt-line)] text-[var(--mkt-muted)]"
                    )}
                  >
                    {it.status === "available" && (
                      <span
                        className="size-1.5 rounded-full bg-[var(--mkt-success)]"
                        aria-hidden
                      />
                    )}
                    {it.status === "needs_setup" && (
                      <span
                        className="size-1.5 rounded-full border border-[var(--mkt-success)]"
                        aria-hidden
                      />
                    )}
                    {it.name}
                    {it.status !== "available" && (
                      <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--mkt-muted)]">
                        {it.status === "needs_setup" ? "needs setup" : "planned"}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
              A filled dot works now with nothing to configure. A hollow dot is
              built and tested but needs credentials or a connection first.
              Dashed is not built — we would rather say so than imply otherwise.
            </p>

            {/* What "email history" means here, stated before anyone pays for
                it. Selryn reads who wrote, when, and whether a reply came
                back — subjects, direction and timestamps, which is what a CRM
                exposes. It does not read message bodies, so it cannot find a
                question inside one; that is why open questions are marked
                Inferred in the product and are something you record, not
                something Selryn discovers. Writing the limit down is cheaper
                than a pilot that ends on it. */}
            <p className="mt-3 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-3.5 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
              <span className="font-medium text-[var(--mkt-ink)]">
                What Selryn reads from your email.
              </span>{" "}
              Who wrote, when, and whether a reply came back — the subject
              line, the direction and the date, which is what a connected CRM
              exposes. It does not open message bodies, so it will not find a
              question buried in one; questions you have noted on a deal count,
              and the product marks that difference on every card. Starting
              from a spreadsheet instead works too, on the dates in it.
            </p>

            <h3 className="mt-9 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
              What gets written down
            </h3>
            <ol className="mt-4 space-y-2.5">
              {RECORDED_STEPS.map((row, i) => (
                <li key={row.step} className="flex gap-3">
                  <span
                    className="mt-0.5 font-mono text-[10.5px] tabular-nums text-[var(--mkt-brand-deep)]"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] leading-snug text-[var(--mkt-ink)]">
                      {row.step}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--mkt-muted)]">
                      {row.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
              You can walk all five in the demo. Selryn has no customer results
              to publish yet and will not print a number it has not measured.
            </p>
          </div>

          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-muted)]">
              Control and trust
            </h3>
            <ul className="mt-4 space-y-3.5">
              {TRUST_POINTS.map((t) => (
                <li key={t.text} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                      t.status === "available"
                        ? "border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]"
                        : "border-[var(--mkt-line)] text-[var(--mkt-muted)]"
                    )}
                    aria-hidden
                  >
                    {t.status === "available" ? (
                      <Check className="size-3" />
                    ) : (
                      <Clock className="size-3" />
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-[14px] leading-snug text-[var(--mkt-ink)]">
                    {t.text}
                    {t.status === "planned" && (
                      <span className="rounded border border-[var(--mkt-line)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--mkt-muted)]">
                        Planned
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-[var(--mkt-line)] pt-4 text-[12px] leading-relaxed text-[var(--mkt-muted)]">
              Selryn holds no third-party security certification and does not
              claim one.{" "}
              <Link
                href="/security"
                className="font-medium text-[var(--mkt-ink)] underline decoration-[var(--mkt-line)] underline-offset-4 transition-colors hover:text-[var(--mkt-brand-deep)]"
              >
                The security page
              </Link>{" "}
              lists what is in place and what is not, in enough detail to send
              to whoever asks.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
