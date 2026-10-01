import "server-only";

import {
  INTEGRATION_CATALOG,
  type CapabilityStatus,
  type IntegrationKey,
} from "@/components/marketing/home/demo-data";
import { isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
import { isSlackConfigured } from "@/lib/integrations/slack/oauth";
import { isEncryptionConfigured } from "@/lib/security/crypto";
import { isGoogleEnabled } from "@/lib/google-oauth";

/**
 * What the marketing page is allowed to claim about integrations, resolved
 * against this deployment rather than hard-coded beside the names.
 *
 * The problem this fixes: the integration list was a literal with a `status`
 * typed next to each row, so it recorded what somebody believed on the day
 * they wrote it. HubSpot sat there marked "planned" long after the connector
 * shipped, which is a strange way to lose deals — the page was the only thing
 * standing between a visitor and a feature that already worked.
 *
 * A connector is claimable only when both halves are true: the code exists
 * (`built` in the catalog) and this deployment can actually run it. For an
 * OAuth integration the second half is real and separate — a finished HubSpot
 * client is useless to a customer until a HubSpot app is registered and its
 * credentials are present. Missing credentials therefore read as "planned",
 * which is the honest answer to "can I connect this today?", and the row flips
 * to available on its own once the keys are set.
 *
 * Failing toward the smaller claim is deliberate. A deploy that loses an
 * environment variable quietly under-promises; the opposite default would have
 * the page advertise a connection that errors the moment anyone clicks it.
 */
function isUsableHere(key: IntegrationKey): boolean {
  switch (key) {
    // Nothing to configure — these are in the product itself.
    case "csv":
      return true;

    case "google_signin":
      return isGoogleEnabled;

    // Sends fall back to a simulated transport without a key, which is fine
    // for a developer and not something to advertise to a buyer.
    case "outbound_email":
      return Boolean(process.env.RESEND_API_KEY);

    // Tokens are stored encrypted, so the connector genuinely cannot run
    // without ENCRYPTION_KEY even with valid HubSpot credentials.
    case "hubspot":
      return isHubspotConfigured() && isEncryptionConfigured();

    case "slack":
      return isSlackConfigured();

    default:
      return false;
  }
}

export interface IntegrationClaim {
  name: string;
  status: CapabilityStatus;
}

/** The integration list as this deployment may honestly present it. */
export function integrationClaims(): IntegrationClaim[] {
  return INTEGRATION_CATALOG.map(({ key, name, built }) => ({
    name,
    status: built && isUsableHere(key) ? "available" : "planned",
  }));
}
