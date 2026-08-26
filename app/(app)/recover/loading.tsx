import { Skeleton } from "@/components/ui/skeleton";

export default function RecoverLoading() {
  return (
    <div>
      <div className="mb-8 min-w-0 space-y-2">
        <Skeleton className="h-8 w-36 max-w-full" />
        <Skeleton className="h-4 w-full max-w-[28rem]" />
      </div>
      <Skeleton className="mb-8 h-36 rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
