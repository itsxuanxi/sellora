"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hash, Loader2, MessagesSquare, Send, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  disconnectSlack,
  sendSlackTest,
  setSlackChannel,
  slackChannels,
} from "@/app/(app)/intent/slack-actions";

/**
 * Slack, in the three states it can actually be in.
 *
 * "Connected" is not claimed until a token exists *and* a channel has been
 * chosen, because an install with nowhere to post delivers nothing and
 * saying otherwise is the exact lie this panel exists to avoid.
 */
export function SlackPanel({
  configured,
  connected,
  teamName,
  channelId,
  channelName,
  sandbox,
  canManage,
}: {
  /** The deployment has Slack credentials at all. */
  configured: boolean;
  connected: boolean;
  teamName: string | null;
  channelId: string | null;
  channelName: string | null;
  sandbox: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  useEffect(() => {
    if (!connected || !canManage) return;
    let cancelled = false;
    setLoadingChannels(true);
    slackChannels()
      .then((result) => {
        if (!cancelled && result.ok) setChannels(result.data);
      })
      .finally(() => {
        if (!cancelled) setLoadingChannels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, canManage]);

  const live = connected && Boolean(channelId);

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-muted">
            <MessagesSquare className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Slack</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {live
                ? `Posting the daily digest and risk alerts to #${channelName}.`
                : connected
                  ? "Installed, but no channel chosen yet — nothing is being posted."
                  : "Post the daily digest and high-risk alerts into a channel."}
            </p>
          </div>
        </div>

        <span
          className={
            "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide " +
            (live
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : connected
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-muted text-muted-foreground")
          }
        >
          {live ? "Connected" : connected ? "Needs a channel" : "Not connected"}
        </span>
      </div>

      {!configured && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            Slack is not set up on this deployment yet.
          </span>{" "}
          The connector is built and tested; it needs its Slack app credentials
          configured on the server before it can be offered. Until then digests
          and alerts go to email only, and Selryn says so rather than showing a
          button that cannot work.
        </p>
      )}

      {configured && sandbox && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          Sandbox workspaces cannot hold a real Slack credential. Create a real
          workspace to install it.
        </p>
      )}

      {configured && !sandbox && (
        <div className="mt-4 space-y-4">
          {connected && teamName && (
            <p className="text-xs text-muted-foreground">
              Installed in <span className="font-medium text-foreground">{teamName}</span>.
            </p>
          )}

          {connected && canManage && (
            <div className="space-y-1.5">
              <label htmlFor="slack-channel" className="text-xs font-medium text-muted-foreground">
                Post to
              </label>
              <Select
                value={channelId ?? undefined}
                disabled={pending || loadingChannels}
                onValueChange={(id) => {
                  const chosen = channels.find((c) => c.id === id);
                  if (!chosen) return;
                  startTransition(async () => {
                    const result = await setSlackChannel({
                      channelId: chosen.id,
                      channelName: chosen.name,
                    });
                    if (!result.ok) toast.error(result.error);
                    else router.refresh();
                  });
                }}
              >
                <SelectTrigger id="slack-channel" className="max-w-xs">
                  <SelectValue
                    placeholder={loadingChannels ? "Loading channels…" : "Choose a channel"}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-1.5">
                        <Hash className="size-3" />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingChannels && channels.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No public channels found. Invite the Selryn app to a channel,
                  then reload.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!connected ? (
              <Button asChild disabled={!canManage}>
                <a href="/api/integrations/slack/connect">
                  <MessagesSquare className="size-3.5" />
                  Add to Slack
                </a>
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || !live || !canManage}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await sendSlackTest();
                      if (result.ok) toast.success(result.data);
                      else toast.error(result.error);
                    })
                  }
                >
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Post a test digest
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending || !canManage}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await disconnectSlack();
                      if (result.ok) {
                        toast.success(result.data);
                        router.refresh();
                      } else toast.error(result.error);
                    })
                  }
                >
                  <Unplug className="size-3.5" />
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
