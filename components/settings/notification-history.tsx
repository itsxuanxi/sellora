import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * What actually happened to the last few notifications.
 *
 * Delivery state comes from Resend's signed webhook, so this is a record of
 * what the mail provider observed rather than what Selryn hoped. A status
 * stuck on "Sent" is itself information: it means nothing has confirmed
 * delivery, which is worth being able to see.
 */

const TONE: Record<string, string> = {
  DELIVERED: "text-emerald-700 dark:text-emerald-400",
  OPENED: "text-emerald-700 dark:text-emerald-400",
  CLICKED: "text-emerald-700 dark:text-emerald-400",
  BOUNCED: "text-rose-700 dark:text-rose-400",
  COMPLAINED: "text-rose-700 dark:text-rose-400",
  FAILED: "text-rose-700 dark:text-rose-400",
  SIMULATED: "text-amber-700 dark:text-amber-400",
};

const LABEL: Record<string, string> = {
  PENDING: "Queued",
  SENT: "Sent — awaiting confirmation",
  DELIVERED: "Delivered",
  OPENED: "Opened",
  CLICKED: "Clicked",
  BOUNCED: "Bounced",
  COMPLAINED: "Marked as spam",
  FAILED: "Failed",
  SIMULATED: "Simulated — not delivered",
};

const KIND: Record<string, string> = {
  daily_digest: "Daily digest",
  risk_alert: "Risk alert",
};

export interface NotificationRow {
  id: string;
  kind: string;
  subject: string;
  status: string;
  simulated: boolean;
  sentAt: string | null;
  createdAt: string;
  failureReason: string | null;
}

export function NotificationHistory({ rows }: { rows: NotificationRow[] }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="text-sm font-semibold">Recent notifications</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Delivery status is reported by Resend through a signed webhook.
      </p>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing sent yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {KIND[row.kind] ?? row.kind}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{row.subject}</span>
              <span
                className={cn(
                  "text-xs font-medium",
                  TONE[row.status] ?? "text-muted-foreground"
                )}
              >
                {LABEL[row.status] ?? row.status}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatDistanceToNow(new Date(row.sentAt ?? row.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {row.failureReason && (
                <span className="w-full text-xs text-rose-700 dark:text-rose-400">
                  {row.failureReason}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
