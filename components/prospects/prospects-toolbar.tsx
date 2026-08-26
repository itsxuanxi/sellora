"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INDUSTRIES,
  PIPELINE_STAGES,
  STAGE_CONFIG,
} from "@/lib/constants";

const ALL = "all";

export function ProspectsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== query) setParam("q", query || null);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, setParam, searchParams]);

  const stage = searchParams.get("stage") ?? ALL;
  const industry = searchParams.get("industry") ?? ALL;
  const hasFilters = Boolean(searchParams.get("q") || stage !== ALL || industry !== ALL);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-56 flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, company, email…"
          className="pl-9"
          aria-label="Search prospects"
        />
      </div>
      <Select value={stage} onValueChange={(v) => setParam("stage", v)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {PIPELINE_STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {STAGE_CONFIG[s].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={industry} onValueChange={(v) => setParam("industry", v)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All industries</SelectItem>
          {INDUSTRIES.map((i) => (
            <SelectItem key={i} value={i}>
              {i}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => {
            setQuery("");
            router.replace(pathname, { scroll: false });
          }}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
