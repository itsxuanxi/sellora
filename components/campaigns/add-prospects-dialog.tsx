"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { Prospect } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addProspectsToCampaign } from "@/app/(app)/campaigns/actions";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function AddProspectsDialog({
  campaignId,
  available,
}: {
  campaignId: string;
  available: Prospect[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }, [available, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    startTransition(async () => {
      const result = await addProspectsToCampaign(campaignId, [...selected]);
      if (result.ok) {
        toast.success(
          `${result.data.added} prospect${result.data.added === 1 ? "" : "s"} added`,
          { description: "Generate their emails when you're ready." }
        );
        setSelected(new Set());
        setQuery("");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelected(new Set());
          setQuery("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserPlus className="size-4" />
          Add prospects
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add prospects to campaign</DialogTitle>
          <DialogDescription>
            {available.length === 0
              ? "Everyone in your prospect base is already in this campaign."
              : `${available.length} prospect${available.length === 1 ? "" : "s"} available.`}
          </DialogDescription>
        </DialogHeader>

        {available.length > 0 && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search prospects…"
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-72 rounded-xl border border-border/60">
              <div className="p-1.5">
                {filtered.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No prospects match “{query}”.
                  </p>
                ) : (
                  filtered.map((prospect) => (
                    <label
                      key={prospect.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={selected.has(prospect.id)}
                        onCheckedChange={() => toggle(prospect.id)}
                      />
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-accent text-[11px] font-medium text-accent-foreground">
                          {initials(prospect.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {prospect.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {prospect.position ? `${prospect.position} · ` : ""}
                          {prospect.company}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.size === 0 || pending}>
            {pending
              ? "Adding…"
              : `Add ${selected.size || ""} prospect${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
