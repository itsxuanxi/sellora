"use client";

import { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Lightbulb,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { Insight } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dismissInsight } from "@/app/(app)/insights/actions";

const KIND_CONFIG: Record<
  string,
  { icon: LucideIcon; label: string; chip: string; iconBg: string }
> = {
  opportunity: {
    icon: Lightbulb,
    label: "Opportunity",
    chip: "bg-emerald-50 text-emerald-700",
    iconBg: "bg-emerald-50 text-emerald-600",
  },
  action: {
    icon: Target,
    label: "Recommended action",
    chip: "bg-sky-50 text-sky-700",
    iconBg: "bg-sky-50 text-sky-600",
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    chip: "bg-amber-50 text-amber-700",
    iconBg: "bg-amber-50 text-amber-600",
  },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const [pending, startTransition] = useTransition();
  const config = KIND_CONFIG[insight.kind] ?? KIND_CONFIG.action;
  const Icon = config.icon;

  function dismiss() {
    startTransition(async () => {
      const result = await dismissInsight(insight.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div
      className={cn(
        "group relative rounded-2xl border border-border/70 bg-card p-5 transition-all",
        pending && "opacity-50"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        disabled={pending}
        aria-label="Dismiss insight"
        className="absolute right-3 top-3 size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </Button>
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            config.iconBg
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 pr-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                config.chip
              )}
            >
              {config.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(insight.createdAt, { addSuffix: true })}
            </span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug">
            {insight.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {insight.body}
          </p>
        </div>
      </div>
    </div>
  );
}
