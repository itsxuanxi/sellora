import { Skeleton } from "@/components/ui/skeleton";

export default function ProspectsLoading() {
  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="mb-5 flex gap-2.5">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>
      <Skeleton className="h-[480px] rounded-2xl" />
    </div>
  );
}
