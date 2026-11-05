import { redirect } from "next/navigation";
import { REDIRECTED_NAV_HREFS } from "@/lib/nav";

/**
 * Preserved address.
 *
 * /actions was a navigation destination for months, so it is in bookmarks,
 * in Slack threads and in the guided tour. Forwarding costs one file and is a
 * far better answer than a 404 for anyone following an old link.
 */
export default function Page() {
  redirect(REDIRECTED_NAV_HREFS["/actions"]);
}
