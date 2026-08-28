import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the real shape of Today's priorities: header, table, summary. */
export default function TodayLoading() {
  return (
    <div>
      <div className="mb-8 min-w-0 space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <Skeleton className="h-[22rem] rounded-2xl" />
      <Skeleton className="mt-4 h-20 rounded-2xl" />
    </div>
  );
}
