"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Prospect } from "@prisma/client";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  PIPELINE_STAGES,
  STAGE_CONFIG,
  type PipelineStage,
} from "@/lib/constants";
import type { ProspectInput } from "@/lib/validators";
import { createProspect, updateProspect } from "@/app/(app)/prospects/actions";

function toFormState(p?: Prospect) {
  return {
    name: p?.name ?? "",
    company: p?.company ?? "",
    email: p?.email ?? "",
    position: p?.position ?? "",
    website: p?.website ?? "",
    linkedin: p?.linkedin ?? "",
    industry: p?.industry ?? "",
    country: p?.country ?? "",
    companySize: p?.companySize ?? "",
    stage: (p?.stage as PipelineStage) ?? "NEW_LEAD",
    notes: p?.notes ?? "",
  };
}

export function ProspectFormDialog({
  prospect,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  prospect?: Prospect;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [form, setForm] = useState(() => toFormState(prospect));
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(prospect);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setForm(toFormState(prospect));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: ProspectInput = {
      name: form.name,
      company: form.company,
      email: form.email,
      position: form.position || null,
      website: form.website || null,
      linkedin: form.linkedin || null,
      industry: form.industry || null,
      country: form.country || null,
      companySize: (form.companySize || null) as ProspectInput["companySize"],
      stage: form.stage,
      notes: form.notes || null,
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateProspect(prospect!.id, input)
        : await createProspect(input);
      if (result.ok) {
        toast.success(isEdit ? "Prospect updated" : "Prospect added", {
          description: `${form.name} · ${form.company}`,
        });
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit prospect" : "Add prospect"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this prospect's details."
              : "The more context you add, the sharper the AI personalization."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Full name *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Maya Lindqvist"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-company">Company *</Label>
              <Input
                id="p-company"
                value={form.company}
                onChange={(e) => set("company")(e.target.value)}
                placeholder="Nordform AI"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-email">Email *</Label>
              <Input
                id="p-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="maya@nordform.ai"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-position">Position</Label>
              <Input
                id="p-position"
                value={form.position}
                onChange={(e) => set("position")(e.target.value)}
                placeholder="Co-founder & CEO"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-website">Website</Label>
              <Input
                id="p-website"
                value={form.website}
                onChange={(e) => set("website")(e.target.value)}
                placeholder="nordform.ai"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-linkedin">LinkedIn</Label>
              <Input
                id="p-linkedin"
                value={form.linkedin}
                onChange={(e) => set("linkedin")(e.target.value)}
                placeholder="linkedin.com/in/maya"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={set("industry")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-country">Country</Label>
              <Input
                id="p-country"
                value={form.country}
                onChange={(e) => set("country")(e.target.value)}
                placeholder="Sweden"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company size</Label>
              <Select value={form.companySize} onValueChange={set("companySize")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Employees" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.stage}
                onValueChange={(v) => set("stage")(v as PipelineStage)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {STAGE_CONFIG[stage].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Notes</Label>
            <Textarea
              id="p-notes"
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              placeholder="Context the AI should know — recent funding, tech stack, mutual connections…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? isEdit
                  ? "Saving…"
                  : "Adding…"
                : isEdit
                  ? "Save changes"
                  : "Add prospect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
