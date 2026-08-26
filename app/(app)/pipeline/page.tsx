import { Kanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { PipelineBoard } from "@/components/pipeline/board";
import { ProspectFormDialog } from "@/components/prospects/prospect-form-dialog";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const session = await requireSession();
  const prospects = await db.prospect.findMany({
    where: { orgId: session.orgId },
    orderBy: { updatedAt: "desc" },
  });

  const won = prospects.filter((p) => p.stage === "WON").length;
  const active = prospects.filter(
    (p) => !["WON", "LOST"].includes(p.stage)
  ).length;

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={`${active} active deal${active === 1 ? "" : "s"} · ${won} won. Drag cards between stages.`}
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

      {prospects.length === 0 ? (
        <EmptyState
          icon={Kanban}
          title="Your pipeline is empty"
          description="Add prospects and they'll appear here as cards you can drag from New Lead all the way to Won."
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
      ) : (
        <PipelineBoard prospects={prospects} />
      )}
    </>
  );
}
