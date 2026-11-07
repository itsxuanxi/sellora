import type { Metadata } from "next";
import Link from "next/link";
import { SandboxEntry } from "@/components/marketing/sandbox-entry";

export const metadata: Metadata = {
  title: "Try Selryn",
  description:
    "Follow one deal from an unanswered proposal to a booked meeting, in a private sandbox running the real product. No sign-up, nothing sent.",
};

/**
 * The demo's front door.
 *
 * One promise, one button. There is no separate demo product behind it: the
 * CTA provisions a private workspace, fills it with the sample dataset and
 * drops the visitor into the actual application with the guided story
 * running. The four stages below are the shape of that story, not a feature
 * list — which is why they are numbered and stated in one line each.
 */

const STAGES = [
  {
    n: "01",
    phase: "Detect",
    body: "Find the deal that went quiet after its proposal.",
  },
  {
    n: "02",
    phase: "Decide",
    body: "Read the emails and records that say why it needs attention.",
  },
  {
    n: "03",
    phase: "Act",
    body: "Edit the draft, then approve it yourself.",
  },
  {
    n: "04",
    phase: "Learn",
    body: "Log what the buyer did next, and watch the advice change.",
  },
];

export default function DemoPage() {
  return (
    <section className="relative isolate overflow-hidden px-5 pb-24 pt-20 md:px-8 md:pb-28 md:pt-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,rgba(103,87,229,0.09),transparent_70%)]"
        aria-hidden
      />

      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          3 minutes · No sign-up · Sample data
        </p>

        <h1 className="mt-7 text-balance text-[2.75rem] font-medium leading-[1.04] tracking-[-0.02em] sm:text-[3.4rem] lg:text-[3.9rem]">
          Follow one deal from an unanswered proposal
          <span className="text-primary"> to a booked meeting.</span>
        </h1>

        <p className="mt-7 max-w-2xl text-pretty text-[17px] leading-[1.65] text-muted-foreground">
          See how Selryn spots a proposal nobody answered, shows you the
          records behind it, drafts the follow-up for your approval, and
          records what the buyer does next.
        </p>

        <div className="mt-10">
          <SandboxEntry />
        </div>

        <p className="mt-6 text-[13.5px] leading-relaxed text-muted-foreground">
          You get your own workspace of invented companies. Every action works
          and is recorded, but nothing leaves the building — no email is sent
          and no CRM is written. It is deleted after seven days.
        </p>
      </div>

      <ol className="mx-auto mt-20 grid max-w-5xl gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s) => (
          <li key={s.n} className="bg-card p-6">
            <span className="font-mono text-[13px] text-primary">{s.n}</span>
            <h2 className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
              {s.phase}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              {s.body}
            </p>
          </li>
        ))}
      </ol>

      <p className="mx-auto mt-12 max-w-3xl text-[13.5px] text-muted-foreground">
        Prefer to talk to someone?{" "}
        <Link
          href="/request-demo"
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-primary"
        >
          Book a demo
        </Link>
        .
      </p>
    </section>
  );
}
