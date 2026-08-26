"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Prospect } from "@prisma/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProspectFormDialog } from "@/components/prospects/prospect-form-dialog";
import { STAGE_CONFIG, type PipelineStage } from "@/lib/constants";
import { deleteProspect } from "@/app/(app)/prospects/actions";

export function StageBadge({ stage }: { stage: string }) {
  const config = STAGE_CONFIG[stage as PipelineStage] ?? STAGE_CONFIG.NEW_LEAD;
  return (
    <Badge variant="secondary" className={`gap-1.5 font-normal ${config.badge}`}>
      <span className={`size-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  );
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function RowActions({ prospect }: { prospect: Prospect }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProspect(prospect.id);
      if (result.ok) {
        toast.success("Prospect deleted", { description: prospect.name });
        setDeleteOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Actions for ${prospect.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => router.push(`/prospects/${prospect.id}`)}>
            <ExternalLink className="size-4" /> View & personalize
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProspectFormDialog prospect={prospect} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {prospect.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the prospect and all associated emails and
              activities. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ProspectTable({ prospects }: { prospects: Prospect[] }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Prospect</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="max-lg:hidden">Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="max-xl:hidden">Country</TableHead>
            <TableHead className="max-xl:hidden">Size</TableHead>
            <TableHead className="max-lg:hidden">Added</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {prospects.map((prospect) => (
            <TableRow
              key={prospect.id}
              className="cursor-pointer"
              onClick={() => router.push(`/prospects/${prospect.id}`)}
            >
              <TableCell className="pl-5">
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-accent text-[11px] font-medium text-accent-foreground">
                      {initials(prospect.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{prospect.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {prospect.email}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {prospect.company}
                  {prospect.website && (
                    <Link
                      href={prospect.website}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`${prospect.company} website`}
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>
                {prospect.industry && (
                  <div className="text-xs text-muted-foreground">
                    {prospect.industry}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground max-lg:hidden">
                {prospect.position ?? "—"}
              </TableCell>
              <TableCell>
                <StageBadge stage={prospect.stage} />
              </TableCell>
              <TableCell className="text-muted-foreground max-xl:hidden">
                {prospect.country ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground max-xl:hidden">
                {prospect.companySize ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground max-lg:hidden">
                {format(prospect.createdAt, "MMM d")}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <RowActions prospect={prospect} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
