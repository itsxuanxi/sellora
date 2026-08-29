"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IntegrationHealth } from "@/lib/integrations/sync-runner";
import {
  disconnectHubspot,
  resyncHubspot,
} from "@/app/(app)/intent/integration-actions";

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
  sandbox = false,
  connected = false,
  canManage = true,
}: {
  health: IntegrationHealth[];
  /** False when the deployment has no HubSpot credentials at all. */
  hubspotConfigured: boolean;
  /** Sandbox workspaces may not hold a real customer credential. */
  sandbox?: boolean;
  /** A HubSpot connection row exists — show operating controls. */
  connected?: boolean;
  /** The viewer holds `integration:connect`. */
  canManage?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Connected data sources</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Selryn scores and recommends from these. A stale source is shown as
            delayed rather than connected.
          </p>
        </div>
        {connected && canManage && !sandbox ? (
          <HubspotControls />
        ) : hubspotConfigured &&
          (sandbox ? (
            // Shown, disabled and explained — never a live-looking button that
            // would fail on click.
            <span
              aria-disabled
              title="Sandbox workspaces cannot hold a real CRM credential."
              className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-full border border-border/70 px-4 text-[13px] font-medium text-muted-foreground"
            >
              <Plug className="size-3.5" aria-hidden />
              Connect HubSpot
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
                Real workspace only
              </span>
            </span>
          ) : (
            <Link
              href="/api/integrations/hubspot/connect"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              <Plug className="size-3.5" aria-hidden />
              Connect HubSpot
            </Link>
          ))}
      </div>

      {!hubspotConfigured && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            HubSpot is not configured on this deployment.
          </span>{" "}
          Set <code className="rounded bg-muted px-1">HUBSPOT_CLIENT_ID</code>,{" "}
          <code className="rounded bg-muted px-1">HUBSPOT_CLIENT_SECRET</code> and{" "}
          <code className="rounded bg-muted px-1">ENCRYPTION_KEY</code>, then
          restart. Until then Selryn runs on imported and demo data only, and
          says so everywhere it does.
        </p>
      )}

      <PlannedChannels />

      {health.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No data source connected yet. Until one is, every figure in Selryn
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

/**
 * Operating controls for a live connection.
 *
 * Disconnect asks first. It is the one control here that cannot be undone
 * without sending the customer back through an OAuth consent screen, and the
 * confirmation states what is kept as well as what is lost — the fear when
 * disconnecting a CRM is that the synced pipeline vanishes with it.
 */
function HubspotControls() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; data?: string; error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.data ?? "Done.");
      else toast.error(result.error ?? "Something went wrong.");
      setConfirming(false);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(resyncHubspot)}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Sync now
      </Button>

      {confirming ? (
        <div className="flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 dark:bg-rose-950/30">
          <span className="text-xs text-rose-800 dark:text-rose-300">
            Disconnect? Synced records are kept.
          </span>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => run(disconnectHubspot)}
          >
            Disconnect
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          <Unplug className="size-3.5" />
          Disconnect
        </Button>
      )}
    </div>
  );
}

/**
 * Channels that are designed but not built.
 *
 * Listed rather than hidden, and deliberately not rendered as controls: a
 * disabled-looking button still invites a click and still implies the feature
 * is one toggle away. Naming what is coming is honest; a dead button is not.
 *
 * Both will run on the notification service email already uses — same
 * composition, same dedupe, same rate limit — so what is missing is the
 * OAuth install and a renderer per channel, not the reasoning.
 */
function PlannedChannels() {
  const planned = [
    {
      name: "Microsoft Teams",
      body: "Notification bot via Microsoft Graph — not the retiring Office 365 connectors — matching Slack feature for feature. It will reuse the same notification service and message shape Slack already uses.",
    },
  ];

  return (
    <div className="mt-5 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Planned channels
      </div>
      <ul className="mt-3 space-y-2.5">
        {planned.map((c) => (
          <li key={c.name} className="flex gap-3">
            <span className="mt-0.5 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Planned
            </span>
            <span className="min-w-0">
              <span className="text-sm font-medium">{c.name}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {c.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
