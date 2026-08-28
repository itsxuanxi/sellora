import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Database, MailX, ShieldCheck } from "lucide-react";
import { SandboxEntryButton } from "@/components/marketing/sandbox-entry";

export const metadata: Metadata = {
  title: "Try Selryn",
  description:
    "A private sandbox workspace running the real product, filled with sample data. No sign-up, no CRM connection, nothing sent.",
};

/**
 * The sandbox front door.
 *
 * There is no separate demo product behind this button. It provisions a
 * private workspace, fills it with the sample dataset and drops the visitor
 * into the actual application — same pages, same scoring, same actions. What
 * differs is only that outbound effects are simulated, which this page says
 * plainly before anyone clicks.
 */

const RULES = [
  {
    icon: Database,
    title: "Real product, sample data",
    body: "Every screen, score and action is the product itself — not a mockup. The workspace is fictional: Acme Labs, and nine invented companies.",
  },
  {
    icon: MailX,
    title: "Nothing is sent",
    body: "Approving a follow-up records the action, the draft and the outcome exactly as it would for a customer, but no email leaves the building and no CRM is written.",
  },
  {
    icon: ShieldCheck,
    title: "Yours alone",
    body: "You get your own workspace, not a shared one. Anything you approve, dismiss or edit is yours, and it is deleted after seven days.",
  },
];

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          Sandbox
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          No sign-up
        </span>
      </div>

      <h1 className="mt-5 max-w-3xl text-balance text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-[3.4rem]">
        Use the real product, on data that cannot bite.
      </h1>
      <p className="mt-6 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted-foreground">
        Selryn ranks your pipeline by expected revenue, finds the deals leaking
        money, recommends one action per deal and records what the buyer did
        about it. The sandbox runs all of that — on a workspace of invented
        companies, with every send simulated.
      </p>

      <div className="mt-9">
        <SandboxEntryButton />
      </div>

      <p className="mt-5 text-[13px] text-muted-foreground">
        Takes a few seconds to build. No credit card, no CRM connection.
      </p>

      <ol className="mt-16 grid gap-5 md:grid-cols-3">
        {RULES.map((r) => (
          <li key={r.title} className="rounded-2xl border border-border/70 bg-card p-6">
            <r.icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-4 text-[16px] font-medium leading-snug tracking-tight">
              {r.title}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              {r.body}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-12 text-[13px] text-muted-foreground">
        Prefer to talk to someone?{" "}
        <Link
          href="/request-demo"
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-primary"
        >
          Book a demo
        </Link>
        .
      </p>
    </div>
  );
}
