import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { RETENTION_POLICY } from "@/lib/integrations/retention-policy";

export const metadata: Metadata = {
  title: { absolute: "Security | Selryn" },
  description:
    "What Selryn does to protect your data today, and what it does not do yet. Written from the implementation, not from a template.",
};

/**
 * The security page.
 *
 * It exists because the footer link labelled "Security" pointed at a
 * marketing section whose last paragraph mentioned certification. Procurement
 * follows that link expecting a page it can forward to someone, and a buyer
 * who cannot find one assumes the answer is bad.
 *
 * Every line in "In place" names something in this repository and can be
 * checked against it — the file is cited in the copy where it helps. Every
 * line in "Not in place" is something a buyer may well need and Selryn does
 * not have; it is listed rather than omitted, because the omission is what a
 * security review finds anyway, and finding it after a conversation about
 * controls is worse than reading it here.
 *
 * Nothing on this page may describe a control that is not implemented. If a
 * claim here cannot be traced to code, it is a defect, not marketing.
 */

const IN_PLACE: { title: string; body: string }[] = [
  {
    title: "Separation between workspaces",
    body: "Every record carries the id of the workspace that owns it, and queries filter on it. A test in the suite reads the source of the follow-up, deal-facts, recovery, import, Today and deal-detail layers and fails the build on any database call whose filter omits that id — because the mistake has a shape, and a static check catches it where a unit test with no database cannot.",
  },
  {
    title: "Integration credentials encrypted before storage",
    body: "HubSpot and Slack access and refresh tokens are encrypted with AES-256-GCM before they are written, using a key held in the deployment's environment and never in the database. If that key is not configured, the connection is not offered at all rather than storing a token in the clear.",
  },
  {
    title: "Five roles, with the dangerous permissions held narrowly",
    body: "Owner, admin, manager, rep and viewer, each with an explicit list of permissions rather than an inherited wildcard. Approving an outbound message, connecting an integration, exporting data and deleting the workspace are separate permissions. A test asserts every role has an explicit grant list, so a new role cannot default to full access.",
  },
  {
    title: "Human approval on anything customer-facing",
    body: "No code path sends a message to a customer without a person approving that specific draft. Selryn's draft is stored alongside what was actually sent, with a flag recording whether a human changed it, so the distinction is in the data rather than in a policy document.",
  },
  {
    title: "An audit log of the decisions that matter",
    body: "Connecting an integration, approving an action, exporting data and changing a member's role are written to an append-only log scoped to the workspace, with the actor, the target and the time.",
  },
  {
    title: "No model is trained on your data",
    body: "Selryn trains nothing. If a workspace configures an OpenAI key, follow-up drafting calls that API with the account name, the contact name, the reason for the follow-up and the subject lines of prior messages — never message bodies. With no key configured, drafts are generated from local templates and nothing leaves the deployment.",
  },
];

/** What a security review will ask for and Selryn does not have. */
const NOT_IN_PLACE: { title: string; body: string }[] = [
  {
    title: "No third-party certification",
    body: "No SOC 2, ISO 27001 or equivalent. None is in progress, and Selryn does not hold a report it can send you.",
  },
  {
    title: "No independent penetration test",
    body: "The application has not been tested by an external party.",
  },
  {
    title: "No SSO or SAML",
    body: "Sign-in is email, or Google where the deployment has it configured. There is no SAML, SCIM or directory provisioning.",
  },
  {
    title: "No published uptime or recovery commitment",
    body: "There is no SLA, and no tested recovery-time or recovery-point objective. Backups are whatever the managed Postgres provider does by default; Selryn adds nothing of its own on top and should not be relied on as the only copy of anything.",
  },
  {
    title: "No data-residency choice",
    body: "The deployment runs in one region. You cannot pin a workspace to another.",
  },
  {
    title: "No customer-managed encryption keys",
    body: "The encryption key for integration tokens belongs to the deployment, not to your workspace.",
  },
];

export default function SecurityPage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_55%_100%_at_60%_0%,rgba(103,87,229,0.07),transparent_72%)]"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[820px] px-5 pb-24 pt-24 md:px-8 md:pt-28">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-brand-deep)]">
          Security
        </p>

        <h1 className="mt-5 text-balance text-[2.2rem] font-medium leading-[1.1] tracking-tight text-[var(--mkt-ink)] sm:text-[2.7rem]">
          What protects your data, and what does not yet.
        </h1>

        <p className="mt-6 text-pretty text-[16.5px] leading-relaxed text-[var(--mkt-muted)]">
          Selryn reads your pipeline and your email history, which is some of
          the most sensitive data a sales team has. This page is written from
          the implementation rather than from a template, so it is shorter than
          most security pages and the second half is the part worth reading.
        </p>

        {/* ── In place ── */}
        <h2 className="mt-14 text-[1.35rem] font-medium tracking-tight text-[var(--mkt-ink)]">
          In place today
        </h2>
        <ul className="mt-6 space-y-5">
          {IN_PLACE.map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--mkt-success)]/30 bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]"
                aria-hidden
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-medium text-[var(--mkt-ink)]">
                  {item.title}
                </h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--mkt-muted)]">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* ── Not in place ── */}
        <h2 className="mt-14 text-[1.35rem] font-medium tracking-tight text-[var(--mkt-ink)]">
          Not in place
        </h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--mkt-muted)]">
          Listed because a review will ask, and because finding this out after
          a conversation about controls is worse than reading it now.
        </p>
        <ul className="mt-6 space-y-5">
          {NOT_IN_PLACE.map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--mkt-line)] text-[var(--mkt-muted)]"
                aria-hidden
              >
                <Minus className="size-3" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-medium text-[var(--mkt-ink)]">
                  {item.title}
                </h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--mkt-muted)]">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* ── What happens to synced data ──
               Quoted from the same constant the disconnect dialog shows, so
               the page and the product cannot describe the policy
               differently. */}
        <h2 className="mt-14 text-[1.35rem] font-medium tracking-tight text-[var(--mkt-ink)]">
          If you disconnect a CRM
        </h2>
        <dl className="mt-6 space-y-4 rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-6">
          {(
            [
              ["Credentials", RETENTION_POLICY.credentials],
              ["Synced records, by default", RETENTION_POLICY.syncedRecordsDefault],
              ["If you ask us to erase them", RETENTION_POLICY.syncedRecordsOnRequest],
              ["The audit log", RETENTION_POLICY.auditLog],
            ] as const
          ).map(([term, definition]) => (
            <div key={term}>
              <dt className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--mkt-muted)]">
                {term}
              </dt>
              <dd className="mt-1 text-[14.5px] leading-relaxed text-[var(--mkt-ink)]">
                {definition}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 border-t border-[var(--mkt-line)] pt-7">
          <h2 className="text-[1.1rem] font-medium tracking-tight text-[var(--mkt-ink)]">
            Reporting a vulnerability, or asking something this page misses
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--mkt-muted)]">
            Use the{" "}
            <Link
              href="/request-demo"
              className="font-medium text-[var(--mkt-ink)] underline decoration-[var(--mkt-line)] underline-offset-4 transition-colors hover:text-[var(--mkt-brand-deep)]"
            >
              contact form
            </Link>{" "}
            and say it is a security question — it reaches a person directly.
            There is no bug-bounty programme and no published response time,
            because there is no on-call rotation to promise one against.
          </p>
        </div>

        <p className="mt-10 text-[12.5px] leading-relaxed text-[var(--mkt-muted)]">
          Last reviewed against the codebase in November 2026. If you find a
          claim on this page that the product does not do, that is a defect and
          we want to hear about it.
        </p>
      </div>
    </div>
  );
}
