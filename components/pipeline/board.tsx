"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Building2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Prospect } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PIPELINE_STAGES,
  STAGE_CONFIG,
  type PipelineStage,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { updateProspectStage } from "@/app/(app)/prospects/actions";

type Columns = Record<PipelineStage, Prospect[]>;

function groupByStage(prospects: Prospect[]): Columns {
  const columns = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, [] as Prospect[]])
  ) as Columns;
  for (const prospect of prospects) {
    const stage = (prospect.stage as PipelineStage) ?? "NEW_LEAD";
    (columns[stage] ?? columns.NEW_LEAD).push(prospect);
  }
  return columns;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function CardContent({ prospect }: { prospect: Prospect }) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <Avatar className="size-7">
          <AvatarFallback className="bg-accent text-[10px] font-medium text-accent-foreground">
            {initials(prospect.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium leading-tight">
            {prospect.name}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {prospect.position ?? prospect.email}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="size-3 shrink-0" />
        <span className="truncate">{prospect.company}</span>
      </div>
    </>
  );
}

function DraggableCard({ prospect }: { prospect: Prospect }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: prospect.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative cursor-grab rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <CardContent prospect={prospect} />
      <Link
        href={`/prospects/${prospect.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        aria-label={`Open ${prospect.name}`}
      >
        <ExternalLink className="size-3.5" />
      </Link>
    </div>
  );
}

function Column({
  stage,
  prospects,
}: {
  stage: PipelineStage;
  prospects: Prospect[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const config = STAGE_CONFIG[stage];
  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <span className={`size-2 rounded-full ${config.dot}`} />
        <span className="text-sm font-medium">{config.label}</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {prospects.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2 rounded-2xl border border-transparent bg-muted/50 p-2 transition-colors",
          isOver && "border-primary/40 bg-accent/60"
        )}
      >
        {prospects.map((prospect) => (
          <DraggableCard key={prospect.id} prospect={prospect} />
        ))}
        {prospects.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl text-xs text-muted-foreground/70">
            Drop prospects here
          </div>
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({ prospects }: { prospects: Prospect[] }) {
  const [columns, setColumns] = useState<Columns>(() => groupByStage(prospects));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Server is the source of truth; resync whenever revalidated data arrives.
  useEffect(() => {
    setColumns(groupByStage(prospects));
  }, [prospects]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeProspect = useMemo(
    () => prospects.find((p) => p.id === activeId) ?? null,
    [prospects, activeId]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const prospectId = String(active.id);
    const targetStage = String(over.id) as PipelineStage;
    if (!PIPELINE_STAGES.includes(targetStage)) return;

    const sourceStage = PIPELINE_STAGES.find((stage) =>
      columns[stage].some((p) => p.id === prospectId)
    );
    if (!sourceStage || sourceStage === targetStage) return;

    const moved = columns[sourceStage].find((p) => p.id === prospectId)!;
    const previous = columns;
    setColumns({
      ...columns,
      [sourceStage]: columns[sourceStage].filter((p) => p.id !== prospectId),
      [targetStage]: [{ ...moved, stage: targetStage }, ...columns[targetStage]],
    });

    startTransition(async () => {
      const result = await updateProspectStage(prospectId, targetStage);
      if (!result.ok) {
        setColumns(previous);
        toast.error(result.error);
      } else {
        toast.success(
          `${moved.name} moved to ${STAGE_CONFIG[targetStage].label}`
        );
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        <div className="flex min-w-max gap-3">
          {PIPELINE_STAGES.map((stage) => (
            <Column key={stage} stage={stage} prospects={columns[stage]} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180 }}>
        {activeProspect && (
          <div className="w-60 rotate-2 rounded-xl border border-primary/30 bg-card p-3 shadow-xl">
            <CardContent prospect={activeProspect} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
