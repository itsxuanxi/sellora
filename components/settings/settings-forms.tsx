"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { INDUSTRIES } from "@/lib/constants";
import {
  updateApiKeys,
  updateCompany,
  updateProfile,
} from "@/app/(app)/settings/actions";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/60 px-6 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────

export function ProfileForm({
  initialName,
  email,
  clerkEnabled,
}: {
  initialName: string;
  email: string;
  clerkEnabled: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateProfile({ name });
      if (result.ok) toast.success("Profile updated");
      else toast.error(result.error);
    });
  }

  return (
    <SectionCard
      title="Profile"
      description="How you appear inside Sellora."
    >
      <form onSubmit={submit} className="max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Full name</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} disabled />
          <p className="text-xs text-muted-foreground">
            {clerkEnabled
              ? "Your email and password are managed through your account menu (bottom of the sidebar)."
              : "Your email is your sign-in identity and can't be changed here."}
          </p>
        </div>
        <Button type="submit" disabled={pending || name === initialName}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </SectionCard>
  );
}

// ── Company ────────────────────────────────────────────────────────────────

export interface CompanyFormValues {
  name: string;
  website: string;
  industry: string;
  description: string;
  senderName: string;
  senderEmail: string;
}

export function CompanyForm({ initial }: { initial: CompanyFormValues }) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof CompanyFormValues) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateCompany({
        name: form.name,
        website: form.website || null,
        industry: form.industry || null,
        description: form.description || null,
        senderName: form.senderName || null,
        senderEmail: form.senderEmail || null,
      });
      if (result.ok) toast.success("Company updated");
      else toast.error(result.error);
    });
  }

  return (
    <SectionCard
      title="Company"
      description="The AI writes every email from this profile — the sharper your pitch, the better the copy."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-website">Website</Label>
            <Input
              id="company-website"
              value={form.website}
              onChange={(e) => set("website")(e.target.value)}
              placeholder="acmelabs.dev"
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company-description">
            What does your product do?
          </Label>
          <Textarea
            id="company-description"
            value={form.description}
            onChange={(e) => set("description")(e.target.value)}
            placeholder="Acme Labs builds an AI copilot that helps engineering teams review code 4x faster."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            One or two sentences, written the way you&apos;d pitch it to a
            customer. This goes directly into the AI&apos;s prompt.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sender-name">Sender name</Label>
            <Input
              id="sender-name"
              value={form.senderName}
              onChange={(e) => set("senderName")(e.target.value)}
              placeholder="Alex Carter"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sender-email">Sender email</Label>
            <Input
              id="sender-email"
              value={form.senderEmail}
              onChange={(e) => set("senderEmail")(e.target.value)}
              placeholder="alex@acmelabs.dev"
            />
            <p className="text-xs text-muted-foreground">
              Must be a verified domain in Resend to send from it.
            </p>
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save company"}
        </Button>
      </form>
    </SectionCard>
  );
}

// ── API Keys ───────────────────────────────────────────────────────────────

export function ApiKeysForm({
  hasOpenAi,
  hasResend,
  envOpenAi,
  envResend,
}: {
  hasOpenAi: boolean;
  hasResend: boolean;
  envOpenAi: boolean;
  envResend: boolean;
}) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateApiKeys({
        // Only touch keys the user actually typed into.
        openaiApiKey: openaiKey === "" ? undefined : openaiKey,
        resendApiKey: resendKey === "" ? undefined : resendKey,
      });
      if (result.ok) {
        toast.success("API keys saved");
        setOpenaiKey("");
        setResendKey("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function clearKey(which: "openai" | "resend") {
    startTransition(async () => {
      const result = await updateApiKeys(
        which === "openai" ? { openaiApiKey: "" } : { resendApiKey: "" }
      );
      if (result.ok) toast.success("Key removed");
      else toast.error(result.error);
    });
  }

  const rows = [
    {
      id: "openai",
      label: "OpenAI API key",
      placeholder: "sk-…",
      saved: hasOpenAi,
      env: envOpenAi,
      value: openaiKey,
      onChange: setOpenaiKey,
      help: "Powers personalization, campaign emails, follow-ups, and insights.",
    },
    {
      id: "resend",
      label: "Resend API key",
      placeholder: "re_…",
      saved: hasResend,
      env: envResend,
      value: resendKey,
      onChange: setResendKey,
      help: "Powers real email delivery. Without it, sends are simulated.",
    },
  ] as const;

  return (
    <SectionCard
      title="API Keys"
      description="Bring your own keys for full control over costs and deliverability. Keys are stored per-workspace and never shown again after saving."
    >
      <form onSubmit={submit} className="max-w-xl space-y-6">
        {rows.map((row) => (
          <div key={row.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`key-${row.id}`} className="flex items-center gap-2">
                <KeyRound className="size-3.5 text-muted-foreground" />
                {row.label}
              </Label>
              {row.saved ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="size-3.5" />
                  Key saved
                  <button
                    type="button"
                    onClick={() => clearKey(row.id)}
                    className="ml-2 text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Remove
                  </button>
                </span>
              ) : row.env ? (
                <span className="text-xs text-muted-foreground">
                  Using server environment key
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not set</span>
              )}
            </div>
            <Input
              id={`key-${row.id}`}
              type="password"
              autoComplete="off"
              value={row.value}
              onChange={(e) => row.onChange(e.target.value)}
              placeholder={row.saved ? "Enter a new key to replace" : row.placeholder}
            />
            <p className="text-xs text-muted-foreground">{row.help}</p>
          </div>
        ))}
        <Button type="submit" disabled={pending || (!openaiKey && !resendKey)}>
          {pending ? "Saving…" : "Save keys"}
        </Button>
      </form>
    </SectionCard>
  );
}
