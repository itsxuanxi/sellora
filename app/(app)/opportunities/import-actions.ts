"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { actionError, type ActionResult } from "@/lib/types";
import { requirePermission } from "@/lib/security/rbac";
import { recordAudit } from "@/lib/security/audit";
import { parseDealsCsv } from "@/lib/import/deals";
import { applyImportedDeals, type ApplyReport } from "@/lib/import/apply";
import type { RowError } from "@/lib/import/csv";

/**
 * Importing a pipeline from a spreadsheet.
 *
 * Two passes, deliberately. `preview` parses and reports without writing
 * anything, so a customer sees the row-by-row errors before committing a file
 * they are not sure about; `commit` re-parses the same text server-side
 * rather than trusting a parsed payload from the browser — the client is a
 * convenience, never the authority on what is about to be written.
 */

/** Guards an accidental paste of something enormous. */
const MAX_CSV_BYTES = 2_000_000;
const MAX_ROWS = 5_000;

const csvSchema = z.object({
  csv: z.string().min(1).max(MAX_CSV_BYTES),
});

export interface ImportPreview {
  parsed: number;
  errors: RowError[];
  missingColumns: string[];
  ignoredColumns: string[];
  /** The first few rows, so the mapping can be eyeballed before committing. */
  sample: {
    row: number;
    externalId: string;
    company: string;
    stage: string;
    amount: number | null;
    currency: string;
  }[];
}

export async function previewDealImport(
  input: z.infer<typeof csvSchema>
): Promise<ActionResult<ImportPreview>> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    const { csv } = csvSchema.parse(input);
    const result = parseDealsCsv(csv);

    if (result.deals.length > MAX_ROWS) {
      return {
        ok: false,
        error: `That file has ${result.deals.length} rows. Import up to ${MAX_ROWS} at a time.`,
      };
    }

    return {
      ok: true,
      data: {
        parsed: result.deals.length,
        errors: result.errors,
        missingColumns: result.missingColumns,
        ignoredColumns: result.ignoredColumns,
        sample: result.deals.slice(0, 5).map((d) => ({
          row: d.row,
          externalId: d.externalId,
          company: d.company,
          stage: d.stage,
          amount: d.amount,
          currency: d.currency,
        })),
      },
    };
  } catch (e) {
    return actionError(e, "Could not read that file.");
  }
}

export interface ImportResult extends ApplyReport {
  skipped: number;
}

export async function commitDealImport(
  input: z.infer<typeof csvSchema>
): Promise<ActionResult<ImportResult>> {
  try {
    const session = await requireSession();
    requirePermission(session.role, "integration:connect");

    if (session.org.isSample) {
      return {
        ok: false,
        error: "This is a sample workspace. Create a real workspace to import your pipeline.",
      };
    }

    const { csv } = csvSchema.parse(input);
    // Parsed again here rather than trusting the preview's output.
    const parsed = parseDealsCsv(csv);
    if (parsed.deals.length === 0) {
      return { ok: false, error: "Nothing in that file could be imported." };
    }
    if (parsed.deals.length > MAX_ROWS) {
      return { ok: false, error: `Import up to ${MAX_ROWS} rows at a time.` };
    }

    const report = await applyImportedDeals(session.orgId, parsed.deals);

    await recordAudit({
      orgId: session.orgId,
      actorId: session.id,
      actorType: "user",
      action: "data.exported",
      targetType: "import",
      targetId: "csv_deals",
      // Counts only — never the contents of the customer's pipeline.
      metadata: {
        created: report.created,
        updated: report.updated,
        rejectedRows: parsed.errors.length,
        failedWrites: report.failures.length,
      },
    });

    revalidatePath("/opportunities");
    revalidatePath("/dashboard");

    return { ok: true, data: { ...report, skipped: parsed.errors.length } };
  } catch (e) {
    return actionError(e, "Could not import that file.");
  }
}
