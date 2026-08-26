"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboarding } from "@/app/(app)/settings/actions";

/**
 * Shown once for accounts created via OTP sign-in (they have no name yet).
 * Deliberately not dismissable — a name makes greetings, email signatures,
 * and AI copy work properly.
 */
export function OnboardingDialog({
  defaultWorkspaceName,
}: {
  defaultWorkspaceName: string;
}) {
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState(defaultWorkspaceName);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await completeOnboarding({ name, orgName });
      if (result.ok) {
        setDone(true);
        toast.success(`Welcome to Sellora, ${name.split(/\s+/)[0]}!`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={!done}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <LogoMark size="xl" />
          <DialogTitle className="mt-2">Welcome to Sellora 👋</DialogTitle>
          <DialogDescription>
            Two quick details so your outreach is signed properly — you can
            change both anytime in Settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ob-name">Your full name</Label>
            <Input
              id="ob-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Carter"
              autoComplete="name"
              autoFocus
              required
            />
            <p className="text-xs text-muted-foreground">
              Used in greetings and as the sender of your emails.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ob-org">Workspace name</Label>
            <Input
              id="ob-org"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Labs"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Setting up…" : "Get started"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
