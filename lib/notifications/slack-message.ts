import type { NotificationMessage } from "@/lib/notifications/types";

/**
 * Rendering a notification as Slack blocks.
 *
 * A renderer and nothing more: it takes the same `NotificationMessage` the
 * email renderer takes and knows nothing about how it was composed. That
 * separation is the point of the shared shape — adding Teams later means
 * writing another one of these, not re-deriving what a digest is.
 *
 * Deliberately compact. A digest that fills a channel with five expanded
 * deals is one people mute, so each deal is two lines and the detail lives
 * behind the link.
 */

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function renderSlackMessage(
  message: NotificationMessage,
  opts: { workspaceName: string; simulated: boolean }
): { text: string; blocks: unknown[] } {
  const blocks: unknown[] = [];

  if (opts.simulated) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: ":test_tube: *Sample data* — a preview of what Selryn would post. Nothing here describes a real company.",
        },
      ],
    });
  }

  blocks.push({
    type: "header",
    // Slack caps header text at 150 characters and errors above it.
    text: { type: "plain_text", text: truncate(message.headline, 150), emoji: true },
  });

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `Selryn · ${opts.workspaceName}` },
      { type: "mrkdwn", text: `${message.summary.revenueAtRisk} est. value at risk` },
      {
        type: "mrkdwn",
        text: `${message.summary.openPipeline} open across ${message.summary.openCount}`,
      },
    ],
  });

  for (const deal of message.deals) {
    const money = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: deal.currency,
      maximumFractionDigits: 0,
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*<${deal.url}|${deal.company}>*${deal.atRisk > 0 ? "  :warning: needs attention" : ""}`,
          `${deal.stage} · ${truncate(deal.reason, 140)}`,
          `*${money.format(deal.dealValue)}*${deal.risk ? ` · ${deal.risk}` : ""}${deal.basis ? ` · _${deal.basis}_` : ""}`,
          `*Next:* ${truncate(deal.nextAction, 140)} _(${deal.urgency})_`,
        ].join("\n"),
      },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: message.primaryLabel, emoji: true },
        url: message.primaryUrl,
        style: "primary",
      },
    ],
  });

  return { text: message.headline, blocks };
}
