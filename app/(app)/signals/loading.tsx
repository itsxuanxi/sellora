import { Skeleton } from "@/components/ui/skeleton";

export default function SignalsLoading() {
  return (
    <div>
      <div className="mb-8 min-w-0 space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-80" />
      </div>
      <Skeleton className="mb-6 h-20 rounded-xl" />
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
