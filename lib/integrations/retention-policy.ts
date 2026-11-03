/**
 * What happens to synced CRM data when a customer disconnects, as text.
 *
 * Separate from `retention.ts` — which does the deleting and is server-only —
 * so the same words can be shown in the confirmation dialog the customer
 * reads before deciding. A policy the implementation states and the UI
 * paraphrases is a policy that drifts.
 */
export const RETENTION_POLICY = {
  credentials:
    "Access and refresh tokens are destroyed immediately and cannot be recovered.",
  syncedRecordsDefault:
    "Companies, contacts, deals and their activity stay in your workspace. They are your pipeline, and disconnecting a CRM does not delete it.",
  syncedRecordsOnRequest:
    "If you choose to erase them, every record that came from this CRM is deleted, along with the follow-ups and extracted details attached to those deals.",
  auditLog:
    "The audit log is kept either way, so there is a record that the disconnection and any deletion took place.",
} as const;
