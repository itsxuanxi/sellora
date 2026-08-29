import { redirect } from "next/navigation";

/**
 * Recover is a view of the deal list, not a separate place.
 *
 * Keeping it as its own page meant the same opportunities appeared twice
 * under two names, and a rep had to know which one to open. It is a filter
 * now; the route stays so existing links resolve.
 */
export default function RecoverRedirect() {
  redirect("/opportunities?filter=needs-attention");
}
