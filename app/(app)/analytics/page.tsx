import { redirect } from "next/navigation";

/** Analytics became Impact. Kept so existing bookmarks and links still land. */
export default function AnalyticsRedirect() {
  redirect("/impact");
}
