import { redirect } from "next/navigation";

/** Insights are shown on Today and on each deal, where they can be acted on. */
export default function InsightsRedirect() {
  redirect("/dashboard");
}
