import "server-only";

import {
  INTEGRATION_CATALOG,
  type CapabilityStatus,
  type IntegrationKey,
} from "@/components/marketing/home/demo-data";
import { isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
import { isSlackConfigured } from "@/lib/integrations/slack/oauth";
import { isGmailConfigured } from "@/lib/integrations/gmail/oauth";
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

    // Same reasoning as HubSpot: a mailbox token is stored encrypted, so the
    // connector cannot run without an encryption key however valid the
    // Google credentials are. GMAIL_INTEGRATION_ENABLED is the extra gate —
    // the restricted scopes need Google's verification before this can be
    // offered to anyone outside the developer's own domain, and a deployment
    // that has not passed it must not show a button that cannot work.
    case "gmail":
      return isGmailConfigured() && isEncryptionConfigured();

    default:
      return false;
  }
}

export interface IntegrationClaim {
  name: string;
  status: CapabilityStatus;
}

/**
 * The integration list as this deployment may honestly present it.
 *
 * Three outcomes, because there are three real situations. The two-state
 * version collapsed the middle one and had to lie in one direction or the
 * other: a finished connector with no credentials was reported as "planned",
 * which denied work that exists and is tested, and the alternative would have
 * been to advertise a connection that errors on click.
 *
 * `built` is a fact about the codebase; `isUsableHere` is a fact about this
 * deployment. Both true means available. Built but not usable is the honest
 * middle: it exists, and someone has to set it up. Not built is planned, and
 * nothing moves it until the code does.
 */
export function integrationClaims(): IntegrationClaim[] {
  return INTEGRATION_CATALOG.map(({ key, name, built }) => ({
    name,
    status: !built ? "planned" : isUsableHere(key) ? "available" : "needs_setup",
  }));
}

/** Grouped for display, in the order a reader cares about. */
export function groupedIntegrationClaims(): {
  status: CapabilityStatus;
  items: IntegrationClaim[];
}[] {
  const claims = integrationClaims();
  return (["available", "needs_setup", "planned"] as CapabilityStatus[])
    .map((status) => ({ status, items: claims.filter((c) => c.status === status) }))
    .filter((g) => g.items.length > 0);
}
