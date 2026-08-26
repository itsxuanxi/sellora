import { Skeleton } from "@/components/ui/skeleton";

export default function OpportunitiesLoading() {
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-96" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="mb-5 h-20 rounded-xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
