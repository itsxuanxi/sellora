import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSlackMessage } from "@/lib/notifications/slack-message";
import { readConfig, SLACK_SCOPES, isSlackConfigured } from "@/lib/integrations/slack/oauth";
import type { NotificationMessage } from "@/lib/notifications/types";

const MESSAGE: NotificationMessage = {
  kind: "daily_digest",
  dedupeKey: "daily_digest:2026-08-29",
  subject: "Today's priorities",
  headline: "$26,040 at risk across 2 deals.",
  deals: [
    {
      opportunityId: "opp1",
      company: "Cloudmint",
      stage: "Proposal",
      dealValue: 42_000,
      winProbability: 62,
      expectedValue: 26_040,
      currency: "USD",
      reason: "They opened your proposal and nobody has followed up since.",
      nextAction: "Send Maya Chen a personal follow-up today",
      urgency: "Today",
      atRisk: 26_040,
      url: "https://app.example.com/opportunities/opp1",
    },
  ],
  summary: { revenueAtRisk: "$26,040", openPipeline: "$108,500", openCount: 7 },
  primaryUrl: "https://app.example.com/dashboard",
  primaryLabel: "Open today's priorities",
};

test("the scopes are write-only — Selryn never reads conversations", () => {
  // Asking a customer for read access to their Slack to deliver a digest
  // would be the wrong trade, so the absence is the assertion.
  assert.ok(SLACK_SCOPES.includes("chat:write"));
  assert.ok(!SLACK_SCOPES.some((s) => s.startsWith("channels:history")));
  assert.ok(!SLACK_SCOPES.some((s) => s.includes("groups:history")));
  assert.ok(!SLACK_SCOPES.some((s) => s.includes("im:")));
});

test("a message always carries fallback text, not only blocks", () => {
  // Slack shows `text` in notifications and where blocks cannot render, so a
  // blocks-only message arrives blank on a phone.
  const rendered = renderSlackMessage(MESSAGE, {
    workspaceName: "Acme Labs",
    simulated: false,
  });
  assert.ok(rendered.text.length > 0);
  assert.equal(rendered.text, MESSAGE.headline);
  assert.ok(Array.isArray(rendered.blocks) && rendered.blocks.length > 0);
});

test("the deal, its reason, the money and the next action all survive", () => {
  const json = JSON.stringify(
    renderSlackMessage(MESSAGE, { workspaceName: "Acme Labs", simulated: false })
  );
  assert.match(json, /Cloudmint/);
  assert.match(json, /nobody has followed up/);
  assert.match(json, /\$42,000/);
  assert.match(json, /62%/);
  assert.match(json, /\$26,040/);
  assert.match(json, /Send Maya Chen a personal follow-up/);
  // And the link back into Selryn.
  assert.match(json, /opportunities\/opp1/);
});

test("a header longer than Slack allows is truncated rather than rejected", () => {
  // Slack errors on a header above 150 characters, which would drop the whole
  // post rather than shortening it.
  const long = { ...MESSAGE, headline: "x".repeat(400) };
  const rendered = renderSlackMessage(long, {
    workspaceName: "Acme Labs",
    simulated: false,
  });
  const header = (rendered.blocks as { type: string; text?: { text: string } }[]).find(
    (b) => b.type === "header"
  );
  assert.ok(header);
  assert.ok(header!.text!.text.length <= 150);
});

test("a simulated post says so in the message itself", () => {
  const json = JSON.stringify(
    renderSlackMessage(MESSAGE, { workspaceName: "Acme Labs", simulated: true })
  );
  assert.match(json, /Sample data/i);
});

test("channel config survives a round trip and tolerates rubbish", () => {
  assert.deepEqual(readConfig('{"channelId":"C1","channelName":"revenue"}'), {
    channelId: "C1",
    channelName: "revenue",
  });
  // A corrupt config must not take the settings page down with it.
  assert.deepEqual(readConfig("not json"), {});
  assert.deepEqual(readConfig(null), {});
});

test("Slack reports itself unconfigured without credentials", () => {
  const id = process.env.SLACK_CLIENT_ID;
  const secret = process.env.SLACK_CLIENT_SECRET;
  delete process.env.SLACK_CLIENT_ID;
  delete process.env.SLACK_CLIENT_SECRET;
  try {
    assert.equal(isSlackConfigured(), false);
  } finally {
    if (id) process.env.SLACK_CLIENT_ID = id;
    if (secret) process.env.SLACK_CLIENT_SECRET = secret;
  }
});
