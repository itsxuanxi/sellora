import { redirect } from "next/navigation";

/**
 * Conversations merged into Actions.
 *
 * Outbound was never a separate feature — it is one of the things an approved
 * recommendation turns into, and giving it its own page hid that. Individual
 * campaigns are still reachable at /campaigns/[id].
 */
export default function CampaignsRedirect() {
  redirect("/actions?filter=sent");
}
