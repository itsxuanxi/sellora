"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Campaign } from "@prisma/client";
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
  CAMPAIGN_STATUSES,
  TONES,
  type CampaignStatus,
  type Tone,
} from "@/lib/constants";
import type { CampaignInput } from "@/lib/validators";
import { createCampaign, updateCampaign } from "@/app/(app)/campaigns/actions";

const TONE_LABELS: Record<Tone, string> = {
  professional: "Professional — crisp and credible",
  friendly: "Friendly — warm and casual",
  direct: "Direct — short and to the point",
  witty: "Witty — playful with personality",
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

export function CampaignFormDialog({
  campaign,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  campaign?: Campaign;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(campaign);

  const [form, setForm] = useState({
    name: campaign?.name ?? "",
    description: campaign?.description ?? "",
    goal: campaign?.goal ?? "",
    tone: (campaign?.tone as Tone) ?? "professional",
    status: (campaign?.status as CampaignStatus) ?? "DRAFT",
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm({
        name: campaign?.name ?? "",
        description: campaign?.description ?? "",
        goal: campaign?.goal ?? "",
        tone: (campaign?.tone as Tone) ?? "professional",
        status: (campaign?.status as CampaignStatus) ?? "DRAFT",
      });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: CampaignInput = {
      name: form.name,
      description: form.description || null,
      goal: form.goal || null,
      tone: form.tone,
      status: form.status,
    };
    startTransition(async () => {
      if (isEdit) {
        const result = await updateCampaign(campaign!.id, input);
        if (result.ok) {
          toast.success("Campaign updated");
          setOpen(false);
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createCampaign(input);
        if (result.ok) {
          toast.success("Campaign created", {
            description: "Now add prospects and generate their emails.",
          });
          setOpen(false);
          router.push(`/campaigns/${result.data.id}`);
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            The AI uses the description, goal, and tone to write every email in
            this campaign.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name *</Label>
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="AI Startups — Q3 Outbound"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-description">Who are you targeting?</Label>
            <Textarea
              id="c-description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Founders and growth leads at AI-native startups, 11–200 people."
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-goal">Goal</Label>
            <Input
              id="c-goal"
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              placeholder="Book a 20-minute discovery call"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select
                value={form.tone}
                onValueChange={(v) => setForm((f) => ({ ...f, tone: v as Tone }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {TONE_LABELS[tone]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as CampaignStatus }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
