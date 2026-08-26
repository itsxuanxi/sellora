"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rescoreAccountNow } from "@/app/(app)/intent/actions";

export function RescoreButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await rescoreAccountNow(accountId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Re-scored from current active signals.");
          router.refresh();
        })
      }
    >
      <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
      Re-score
    </Button>
  );
}
