"use client";

import { useTransition } from "react";
import { Gauge, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  researchAccountNow,
  scoreAccountNow,
} from "@/app/(app)/accounts/actions";

export function ResearchButtons({
  accountId,
  hasResearch,
  hasScore,
}: {
  accountId: string;
  hasResearch: boolean;
  hasScore: boolean;
}) {
  const [researching, startResearch] = useTransition();
  const [scoring, startScore] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={hasResearch ? "outline" : "default"}
        className="gap-1.5"
        disabled={researching || scoring}
        onClick={() =>
          startResearch(async () => {
            const result = await researchAccountNow(accountId);
            if (result.ok) toast.success("Account brief updated");
            else toast.error(result.error);
          })
        }
      >
        <Sparkles className={`size-3.5 ${researching ? "animate-pulse" : ""}`} />
        {researching ? "Researching…" : hasResearch ? "Re-research" : "Research"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={researching || scoring}
        onClick={() =>
          startScore(async () => {
            const result = await scoreAccountNow(accountId);
            if (result.ok) toast.success("Scores updated");
            else toast.error(result.error);
          })
        }
      >
        <Gauge className={`size-3.5 ${scoring ? "animate-pulse" : ""}`} />
        {scoring ? "Scoring…" : hasScore ? "Re-score" : "Score"}
      </Button>
    </div>
  );
}
