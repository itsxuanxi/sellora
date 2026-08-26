"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshInsights } from "@/app/(app)/insights/actions";

export function RefreshInsightsButton({ hasInsights }: { hasInsights: boolean }) {
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await refreshInsights();
      if (result.ok) {
        toast.success(
          `${result.data.count} insight${result.data.count === 1 ? "" : "s"} generated`,
          {
            description:
              result.data.source === "openai"
                ? "GPT analyzed your live pipeline and outreach data."
                : "Analyzed locally — add an OpenAI key in Settings for GPT analysis.",
          }
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button onClick={refresh} disabled={pending} className="gap-2">
      <Sparkles className={`size-4 ${pending ? "animate-pulse" : ""}`} />
      {pending
        ? "Analyzing your data…"
        : hasInsights
          ? "Regenerate insights"
          : "Generate insights"}
    </Button>
  );
}
