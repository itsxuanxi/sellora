import { PageHeader } from "@/components/app/page-header";
import { IntegrationHealthPanel } from "@/components/settings/integration-health";
import { SlackPanel } from "@/components/settings/slack-panel";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/security/rbac";
import { integrationHealth } from "@/lib/integrations/sync-runner";
import { isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
import { isEncryptionConfigured } from "@/lib/security/crypto";
import {
  isSlackConfigured,
  readConfig,
  SLACK_PROVIDER,
} from "@/lib/integrations/slack/oauth";

export const metadata = { title: "Integrations" };

/**
 * Integrations answers one question: where does the data come from?
 *
 * Split out of the old Intent Dashboard, which mixed connection health with
 * campaign tooling — two unrelated jobs sharing a page, so neither read as
 * the answer to anything. The campaign side still lives at /intent; this is
 * only the plumbing.
 */
export default async function IntegrationsPage() {
  const session = await requireSession();

  const [health, slackConnection] = await Promise.all([
    integrationHealth(session.orgId),
    db.integrationConnection.findUnique({
      where: { orgId_provider: { orgId: session.orgId, provider: SLACK_PROVIDER } },
      select: { status: true, externalAccountName: true, config: true },
    }),
  ]);

  const hubspotConnection = await db.integrationConnection.findFirst({
    where: { orgId: session.orgId, provider: "hubspot", status: "ACTIVE" },
    select: { id: true },
  });

  const canManage = can(session.role, "integration:connect");

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Where Selryn reads your pipeline from, and where it sends what you approve."
      />

      <div className="space-y-6">
        <IntegrationHealthPanel
          sandbox={session.org.isSample}
          connected={Boolean(hubspotConnection)}
          canManage={canManage}
          health={health}
          hubspotConfigured={isHubspotConfigured() && isEncryptionConfigured()}
        />

        <SlackPanel
          configured={isSlackConfigured()}
          connected={slackConnection?.status === "CONNECTED"}
          teamName={slackConnection?.externalAccountName ?? null}
          channelId={readConfig(slackConnection?.config).channelId ?? null}
          channelName={readConfig(slackConnection?.config).channelName ?? null}
          sandbox={session.org.isSample}
          canManage={canManage}
        />
      </div>
    </>
  );
}
