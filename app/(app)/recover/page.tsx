import { redirect } from "next/navigation";

/** The old route. Kept so existing links resolve to the dedicated view. */
export default function RecoverRedirect() {
  redirect("/recovery");
}
