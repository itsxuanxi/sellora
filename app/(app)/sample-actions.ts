"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionError, type ActionResult } from "@/lib/types";
import { clearSampleData, seedSampleData } from "@/lib/sample-data";

/** Sample rows show up on every revenue screen, so they all revalidate. */
function revalidateEverything() {
  for (const path of [
    "/dashboard",
    "/opportunities",
    "/recover",
    "/signals",
    "/analytics",
    "/accounts",
    "/prospects",
    "/campaigns",
    "/insights",
    "/agent",
    "/settings",
  ]) {
    revalidatePath(path);
  }
}

/**
 * Removes every sample row from the workspace, leaving the user's own data
 * alone. Deliberately not confirmable-away: this is the promised escape hatch
 * from "Load sample data", so it must be one click and it must be complete.
 */
export async function clearSampleDataAction(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await clearSampleData(db, session.orgId);
    revalidateEverything();
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not clear the sample data.");
  }
}

/** Fills the workspace with the sample dataset — onboarding's other branch. */
export async function loadSampleDataAction(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    // Re-seeding on top of an existing sample set would double every row.
    await clearSampleData(db, session.orgId);
    await seedSampleData(db, session.orgId, {
      applyIdentity: session.org.isSample,
    });
    revalidateEverything();
    return { ok: true, data: undefined };
  } catch (e) {
    return actionError(e, "Could not load the sample data.");
  }
}
