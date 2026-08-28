"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  sendDigestNow,
  updateNotificationPreferences,
  type NotificationPrefsInput,
} from "@/app/(app)/settings/notification-actions";

/**
 * Notification preferences.
 *
 * Every control here answers a way Selryn could become annoying: what it
 * sends, when, how big a deal has to be to interrupt you, and how long it
 * waits before mentioning the same deal again. A notification product without
 * these is one people turn off entirely.
 */

const FALLBACK_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

/**
 * The selectable zones, guaranteed to contain `current`.
 *
 * `Intl.supportedValuesOf("timeZone")` returns the canonical IANA list, which
 * does NOT include "UTC" — the stored default. Without this union the select
 * has no option matching its own value, renders blank, and the first edit
 * silently replaces a zone the user never saw.
 */
function zones(current: string): string[] {
  let supported: string[] = FALLBACK_ZONES;
  try {
    const values = (
      Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (values?.length) supported = values;
  } catch {
    // Keep the fallback list.
  }
  const union = new Set<string>(["UTC", ...supported]);
  union.add(current);
  return [...union];
}

/** The visitor's own zone, offered as the sensible default. */
function detectZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export interface NotificationDefaults extends NotificationPrefsInput {
  unsubscribed: boolean;
}

export function NotificationsForm({
  defaults,
  simulated,
}: {
  defaults: NotificationDefaults;
  /** Sandbox workspace: composed and recorded, never delivered. */
  simulated: boolean;
}) {
  const [form, setForm] = useState<NotificationPrefsInput>(defaults);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();
  const [zoneList] = useState(() => zones(defaults.timezone));
  const [browserZone] = useState(detectZone);

  function save(next: NotificationPrefsInput) {
    setForm(next);
    startSave(async () => {
      const result = await updateNotificationPreferences(next);
      if (!result.ok) toast.error(result.error);
    });
  }

  const set = <K extends keyof NotificationPrefsInput>(
    key: K,
    value: NotificationPrefsInput[K]
  ) => save({ ...form, [key]: value });

  return (
    <div className="space-y-6">
      {defaults.unsubscribed && !form.dailyDigest && !form.riskAlerts && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You unsubscribed from an email footer. Turning either switch back on
          re-enables notifications.
        </p>
      )}

      {simulated && (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This is a sandbox workspace. Notifications are composed and recorded
          exactly as they would be, but nothing is delivered.
        </p>
      )}

      <Row
        title="Daily digest"
        body="One email each morning: the ranked pipeline, what is leaking, and the next action on each deal."
      >
        <Switch
          checked={form.dailyDigest}
          onCheckedChange={(v) => set("dailyDigest", v)}
          aria-label="Daily digest"
        />
      </Row>

      {form.dailyDigest && (
        <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="digest-hour">Send at</Label>
            <Select
              value={String(form.digestHour)}
              onValueChange={(v) => set("digestHour", Number(v))}
            >
              <SelectTrigger id="digest-hour">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }).map((_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="digest-tz">Time zone</Label>
            <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
              <SelectTrigger id="digest-tz">
                <SelectValue placeholder="Select a time zone" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {zoneList.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {browserZone && browserZone !== form.timezone && (
              <button
                type="button"
                onClick={() => set("timezone", browserZone)}
                className="text-xs text-primary hover:underline"
              >
                Use {browserZone} (this device)
              </button>
            )}
          </div>

          <div className="sm:col-span-2">
            <Row title="Weekdays only" body="Skip Saturday and Sunday." compact>
              <Switch
                checked={form.weekdaysOnly}
                onCheckedChange={(v) => set("weekdaysOnly", v)}
                aria-label="Weekdays only"
              />
            </Row>
          </div>
        </div>
      )}

      <Row
        title="High-risk deal alerts"
        body="An email the moment a deal starts leaking expected revenue, rather than waiting for tomorrow's digest."
      >
        <Switch
          checked={form.riskAlerts}
          onCheckedChange={(v) => set("riskAlerts", v)}
          aria-label="High-risk deal alerts"
        />
      </Row>

      {form.riskAlerts && (
        <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="min-value">Only alert above</Label>
            <Input
              id="min-value"
              type="number"
              min={0}
              step={500}
              value={form.minAlertValue}
              onChange={(e) => setForm({ ...form, minAlertValue: Number(e.target.value) })}
              onBlur={() => save(form)}
            />
            <p className="text-xs text-muted-foreground">
              Expected revenue, in whole units. 0 alerts on everything.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cooldown">Do not repeat within</Label>
            <Select
              value={String(form.alertCooldownHours)}
              onValueChange={(v) => set("alertCooldownHours", Number(v))}
            >
              <SelectTrigger id="cooldown">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[6, 12, 24, 48, 72, 168].map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h >= 24 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} hours`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The same deal will not alert twice inside this window.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
        <Button
          variant="outline"
          disabled={sending}
          onClick={() =>
            startSend(async () => {
              const result = await sendDigestNow();
              if (result.ok) toast.success(result.data);
              else toast.error(result.error);
            })
          }
        >
          {sending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          Send me the digest now
        </Button>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bell className="size-3.5" />
          {saving ? "Saving…" : "Changes save automatically."}
        </span>
      </div>
    </div>
  );
}

function Row({
  title,
  body,
  children,
  compact,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className={compact ? "text-sm font-medium" : "font-medium"}>{title}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}
