import "server-only";
import { db } from "@/lib/db";

export type ActivityType =
  | "prospect_created"
  | "email_sent"
  | "email_opened"
  | "email_replied"
  | "stage_changed"
  | "followup_sent"
  | "ai_generated"
  | "campaign_created";

export async function logActivity(params: {
  orgId: string;
  type: ActivityType;
  description: string;
  prospectId?: string | null;
}) {
  try {
    await db.activity.create({
      data: {
        orgId: params.orgId,
        type: params.type,
        description: params.description,
        prospectId: params.prospectId ?? null,
      },
    });
  } catch (err) {
    // The activity feed is best-effort; never fail the primary action over it.
    console.error("[activity] failed to log:", err);
  }
}
