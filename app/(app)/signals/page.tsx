import { redirect } from "next/navigation";

/**
 * Signals belong to the deal they were detected on.
 *
 * A feed of signals divorced from the opportunities they explain is a list of
 * facts with nothing to decide about, so the evidence now lives on the deal
 * and this route forwards to the pipeline it describes.
 */
export default function SignalsRedirect() {
  redirect("/opportunities?filter=high-intent");
}
