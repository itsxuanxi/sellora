import { Skeleton } from "@/components/ui/skeleton";

export default function ProspectDetailLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-5 w-24" />
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="h-[560px] rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}
