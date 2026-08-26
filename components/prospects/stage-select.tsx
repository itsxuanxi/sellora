"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PIPELINE_STAGES,
  STAGE_CONFIG,
  type PipelineStage,
} from "@/lib/constants";
import { updateProspectStage } from "@/app/(app)/prospects/actions";

export function StageSelect({
  prospectId,
  stage,
}: {
  prospectId: string;
  stage: string;
}) {
  const [optimisticStage, setOptimisticStage] = useOptimistic(stage);
  const [, startTransition] = useTransition();

  function handleChange(next: string) {
    startTransition(async () => {
      setOptimisticStage(next);
      const result = await updateProspectStage(prospectId, next as PipelineStage);
      if (!result.ok) toast.error(result.error);
    });
  }

  const config =
    STAGE_CONFIG[optimisticStage as PipelineStage] ?? STAGE_CONFIG.NEW_LEAD;

  return (
    <Select value={optimisticStage} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-40" aria-label="Pipeline stage">
        <span className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${config.dot}`} />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {PIPELINE_STAGES.map((s) => (
          <SelectItem key={s} value={s}>
            {STAGE_CONFIG[s].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
