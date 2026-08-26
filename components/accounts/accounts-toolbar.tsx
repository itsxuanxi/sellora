"use client";

import { useState, useTransition } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
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
  createAccount,
  importAccountsFromContacts,
} from "@/app/(app)/accounts/actions";

export function AccountsToolbar({ unlinkedContacts }: { unlinkedContacts: number }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "", industry: "", companySize: "", region: "" });
  const [creating, startCreate] = useTransition();
  const [importing, startImport] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startCreate(async () => {
      const result = await createAccount(form);
      if (result.ok) {
        toast.success(`${form.name} added`, {
          description: "Run Research to build the account brief.",
        });
        setOpen(false);
        setForm({ name: "", domain: "", industry: "", companySize: "", region: "" });
      } else toast.error(result.error);
    });
  }

  function runImport() {
    startImport(async () => {
      const result = await importAccountsFromContacts();
      if (result.ok) {
        toast.success(
          `${result.data.created} account(s) created, ${result.data.linked} contact(s) linked`,
          {
            description:
              result.data.queued > 0
                ? `${result.data.queued} research/scoring task(s) queued for the agent — see the Agent page.`
                : undefined,
          }
        );
      } else toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2.5">
      {unlinkedContacts > 0 && (
        <Button variant="outline" className="gap-2" onClick={runImport} disabled={importing}>
          <Download className="size-4" />
          {importing ? "Importing…" : `Import from contacts (${unlinkedContacts})`}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="size-4" />
            Add account
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add target account</DialogTitle>
            <DialogDescription>
              A company you want to win. The agent researches and scores it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="a-name">Company name *</Label>
              <Input
                id="a-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Meridian Consulting Group"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="a-domain">Website</Label>
                <Input
                  id="a-domain"
                  value={form.domain}
                  onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                  placeholder="meridian.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-industry">Industry</Label>
                <Input
                  id="a-industry"
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  placeholder="Consulting"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-size">Employees</Label>
                <Input
                  id="a-size"
                  value={form.companySize}
                  onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))}
                  placeholder="11-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-region">Region</Label>
                <Input
                  id="a-region"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="United States"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Adding…" : "Add account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
