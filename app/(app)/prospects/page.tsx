import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProspectFormDialog } from "@/components/prospects/prospect-form-dialog";
import { ProspectTable } from "@/components/prospects/prospect-table";
import { ProspectsToolbar } from "@/components/prospects/prospects-toolbar";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Prospects" };

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; industry?: string }>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const { q, stage, industry } = params;

  const where: Prisma.ProspectWhereInput = {
    orgId: session.orgId,
    ...(stage ? { stage } : {}),
    ...(industry ? { industry } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { company: { contains: q } },
            { email: { contains: q } },
            { position: { contains: q } },
          ],
        }
      : {}),
  };

  const [prospects, total] = await Promise.all([
    db.prospect.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    db.prospect.count({ where: { orgId: session.orgId } }),
  ]);

  const isFiltered = Boolean(q || stage || industry);

  return (
    <>
      <PageHeader
        title="Prospects"
        description={`${total.toLocaleString()} ${total === 1 ? "person" : "people"} in your prospect base.`}
      >
        <ProspectFormDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              Add prospect
            </Button>
          }
        />
      </PageHeader>

      <ProspectsToolbar />

      {prospects.length > 0 ? (
        <>
          <ProspectTable prospects={prospects} />
          {isFiltered && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {prospects.length} matching prospect
              {prospects.length === 1 ? "" : "s"}
            </p>
          )}
        </>
      ) : isFiltered ? (
        <EmptyState
          icon={Users}
          title="No prospects match your filters"
          description="Try a different search term, or clear the filters to see everyone."
        />
      ) : (
        <EmptyState
          icon={Users}
          title="No prospects yet"
          description="Add your first prospect and Selryn will generate a personalized cold email, icebreaker, and outreach angle for them."
        >
          <ProspectFormDialog
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Add your first prospect
              </Button>
            }
          />
        </EmptyState>
      )}
    </>
  );
}
