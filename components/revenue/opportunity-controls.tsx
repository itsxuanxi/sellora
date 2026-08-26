"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OPPORTUNITY_STAGES,
  STAGE_LABELS,
  type OpportunityStage,
} from "@/lib/revenue/config";
import {
  logInteraction,
  setNextStep,
  updateDealValue,
  updateOpportunityStage,
} from "@/app/(app)/opportunities/actions";

/**
 * The three inputs that most change a score: what the deal is worth, what
 * stage it is at, and when the next step is due. Editing any of them
 * rescores immediately, so the user sees the model respond to their input.
 */
export function OpportunityControls({
  opportunityId,
  stage,
  dealValue,
  nextStepDueAt,
}: {
  opportunityId: string;
  stage: string;
  dealValue: number;
  nextStepDueAt: string;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(String(dealValue));
  const [due, setDue] = useState(nextStepDueAt);
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="deal-value" className="text-xs">
          Deal value
        </Label>
        <div className="flex gap-2">
          <Input
            id="deal-value"
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending || value === String(dealValue)}
            onClick={() =>
              run(
                () => updateDealValue({ opportunityId, dealValue: Number(value) }),
                "Deal value updated and rescored."
              )
            }
          >
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stage" className="text-xs">
          Stage
        </Label>
        <Select
          value={stage}
          disabled={pending}
          onValueChange={(next) =>
            run(
              () =>
                updateOpportunityStage({
                  opportunityId,
                  stage: next as OpportunityStage,
                }),
              `Moved to ${STAGE_LABELS[next as OpportunityStage]}.`
            )
          }
        >
          <SelectTrigger id="stage" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPPORTUNITY_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {STAGE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="next-step" className="text-xs">
          Next step due
        </Label>
        <div className="flex gap-2">
          <Input
            id="next-step"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-9"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending || due === nextStepDueAt}
            onClick={() =>
              run(
                () => setNextStep({ opportunityId, dueAt: due }),
                due ? "Next step scheduled." : "Next step cleared."
              )
            }
          >
            Save
          </Button>
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={pending}
        onClick={() =>
          run(
            () => logInteraction(opportunityId, "note"),
            "Logged — this deal no longer reads as silent."
          )
        }
      >
        Log a touch today
      </Button>
    </div>
  );
}
