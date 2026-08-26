import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-64 shrink-0 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
