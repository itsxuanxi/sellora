import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, Plug, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegrationHealth } from "@/lib/integrations/sync-runner";

/**
 * Connection health.
 *
 * The whole point of this panel is that it refuses to say "Connected" when the
 * data is stale. A green tick over a three-day-old sync is the specific lie
 * that lets a customer trust a dashboard built on frozen data, so staleness is
 * a distinct state with its own colour, and the timestamp always travels with
 * the status rather than being tucked away in a tooltip.
 */

const PROVIDER_LABEL: Record<string, string> = {
  hubspot: "HubSpot",
  gmail: "Gmail",
  google_calendar: "Google Calendar",
  website_sdk: "Website signals",
  salesforce: "Salesforce",
};

type Tone = "good" | "warn" | "bad" | "idle";

function toneFor(h: IntegrationHealth): Tone {
  if (h.status === "REVOKED" || h.status === "PENDING") return "idle";
  if (h.status === "ERROR" || h.status === "REAUTH_REQUIRED") return "bad";
  if (h.status === "DEGRADED" || h.stale) return "warn";
  return "good";
}

const TONE_STYLE: Record<Tone, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  bad: "border-rose-200 bg-rose-50 text-rose-700",
  idle: "border-border bg-muted text-muted-foreground",
};

const TONE_ICON: Record<Tone, typeof CheckCircle2> = {
  good: CheckCircle2,
  warn: Clock,
  bad: XCircle,
  idle: Plug,
};

export function IntegrationHealthPanel({
  health,
  hubspotConfigured,
}: {
  health: IntegrationHealth[];
  /** False when the deployment has no HubSpot credentials at all. */
  hubspotConfigured: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Connected data sources</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sellora scores and recommends from these. A stale source is shown as
            delayed rather than connected.
          </p>
        </div>
        {hubspotConfigured && (
          <Link
            href="/api/integrations/hubspot/connect"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            <Plug className="size-3.5" aria-hidden />
            Connect HubSpot
          </Link>
        )}
      </div>

      {!hubspotConfigured && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            HubSpot is not configured on this deployment.
          </span>{" "}
          Set <code className="rounded bg-muted px-1">HUBSPOT_CLIENT_ID</code>,{" "}
          <code className="rounded bg-muted px-1">HUBSPOT_CLIENT_SECRET</code> and{" "}
          <code className="rounded bg-muted px-1">ENCRYPTION_KEY</code>, then
          restart. Until then Sellora runs on imported and demo data only, and
          says so everywhere it does.
        </p>
      )}

      {health.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No data source connected yet. Until one is, every figure in Sellora
          comes from imported or demo data.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {health.map((h) => {
            const tone = toneFor(h);
            const Icon = TONE_ICON[tone];
            return (
              <li
                key={h.provider}
                className="rounded-xl border border-border/60 bg-background p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium">
                      {PROVIDER_LABEL[h.provider] ?? h.provider}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        TONE_STYLE[tone]
                      )}
                    >
                      <Icon className="size-3" aria-hidden />
                      {h.statusLabel}
                    </span>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {h.lastSyncSucceededAt
                      ? `Last synced ${formatDistanceToNow(h.lastSyncSucceededAt, { addSuffix: true })}`
                      : "Never synced"}
                  </span>
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  <Stat label="Records processed" value={h.recordsProcessed.toLocaleString()} />
                  <Stat label="Active jobs" value={String(h.activeJobs)} />
                  {h.deadLetters > 0 && (
                    <Stat label="Needs replay" value={String(h.deadLetters)} tone="bad" />
                  )}
                  {h.consecutiveFailures > 0 && (
                    <Stat
                      label="Consecutive failures"
                      value={String(h.consecutiveFailures)}
                      tone="warn"
                    />
                  )}
                </dl>

                {/* Errors are shown, not swallowed. A sync that stopped
                    working without saying so is the worst outcome here. */}
                {h.lastError && (
                  <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2.5 text-[11.5px] leading-snug text-rose-700">
                    <AlertTriangle className="mt-[1px] size-3.5 shrink-0" aria-hidden />
                    {h.lastError}
                  </p>
                )}

                {h.status === "REAUTH_REQUIRED" && (
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    The access grant expired and could not be renewed
                    automatically. Reconnecting is the only fix.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "bad";
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium tabular-nums",
          tone === "bad" && "text-rose-600",
          tone === "warn" && "text-amber-600"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
