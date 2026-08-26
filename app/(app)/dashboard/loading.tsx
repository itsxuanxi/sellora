import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div>
      <div className="mb-8 min-w-0 space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-96" />
      </div>

      {/* Headline "revenue at risk" panel */}
      <Skeleton className="h-44 rounded-2xl" />

      {/* Supporting money tiles */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
