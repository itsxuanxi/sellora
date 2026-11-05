import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/security/rbac";
import { dealTemplateCsv } from "@/lib/import/deals";
import { DealImportPanel } from "@/components/import/deal-import-panel";

export const metadata = { title: "Import deals" };

/**
 * Getting a pilot customer's pipeline in before any CRM is connected.
 *
 * Deliberately its own page rather than a dialog: the first import is a
 * several-minute job involving a spreadsheet in another window, and a modal
 * that loses the uploaded file when it closes is the wrong container for it.
 */
export default async function ImportDealsPage() {
  const session = await requireSession();
  const allowed = can(session.role, "integration:connect");

  return (
    <>
      <Link
        href="/opportunities"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Deals
      </Link>

      <PageHeader
        title="Import deals"
        description="Bring your open pipeline in from a spreadsheet. Selryn reads it; your CRM, if you have one, stays the system of record."
      />

      {session.org.isSample ? (
        <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-8 text-center text-sm text-muted-foreground">
          This is a sample workspace, so importing is disabled here. Create a
          real workspace to bring in your own pipeline.
        </p>
      ) : !allowed ? (
        // Permission, not capability: say who can do it rather than hiding it.
        <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-8 text-center text-sm text-muted-foreground">
          You do not have permission to import data into this workspace. An
          owner or admin can do it.
        </p>
      ) : (
        <DealImportPanel templateCsv={dealTemplateCsv()} />
      )}
    </>
  );
}
