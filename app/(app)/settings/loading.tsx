import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="mb-6 h-9 w-80 rounded-lg" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
