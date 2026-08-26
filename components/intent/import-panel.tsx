"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { importSignalsCsv, runMockDetection } from "@/app/(app)/intent/actions";

const CSV_TEMPLATE = `company,domain,industry,region,company_size,signal_type,title,description,evidence,source_url,occurred_at,confidence
Acme Staffing,acmestaffing.com,Staffing,"Toronto, ON",51-200,job_surge,7 new roles posted this week,Acme posted 7 roles in 7 days,"7 postings, LinkedIn Jobs",https://linkedin.com/jobs/acme,2026-08-15,high`;

export function ImportPanel({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [csvText, setCsvText] = useState("");
  const [companyNames, setCompanyNames] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setCsvText);
  }

  function submitCsv() {
    if (!csvText.trim()) {
      toast.error("Paste or upload a CSV first.");
      return;
    }
    startTransition(async () => {
      const result = await importSignalsCsv(campaignId, csvText);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.data.created} new compan${result.data.created === 1 ? "y" : "ies"}, ${result.data.signals} signal(s) added (${result.data.deduped} already existed).`
      );
      if (result.data.errors.length > 0) {
        toast.warning(`${result.data.errors.length} row(s) skipped — see console.`);
        console.warn("[intent] CSV import row errors:", result.data.errors);
      }
      setCsvText("");
      router.refresh();
    });
  }

  function submitMock() {
    if (!companyNames.trim()) {
      toast.error("Enter at least one company name.");
      return;
    }
    startTransition(async () => {
      const result = await runMockDetection(campaignId, companyNames);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Demo detection ran on ${result.data.created + result.data.matched} compan(ies) — ${result.data.signals} signal(s) generated.`
      );
      setCompanyNames("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6">
      <h2 className="font-medium">Add companies &amp; signals</h2>
      <Tabs defaultValue="csv" className="mt-4">
        <TabsList>
          <TabsTrigger value="csv">CSV import (real data)</TabsTrigger>
          <TabsTrigger value="mock">Demo data</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Real, verifiable signals only — one row per signal. Required
            columns: <code className="text-xs">company, signal_type, title, occurred_at</code>.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <UploadCloud className="size-4" />
              Upload CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCsvText(CSV_TEMPLATE)}
            >
              Load example row
            </Button>
          </div>
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder="Paste CSV content here…"
            className="font-mono text-xs"
          />
          <Button onClick={submitCsv} disabled={pending}>
            {pending ? "Importing…" : "Import signals"}
          </Button>
        </TabsContent>

        <TabsContent value="mock" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-amber-600">Demo data</span> — deterministically
            generated, clearly labeled everywhere it appears, never presented
            as a verified fact. Use this to try the full flow before
            connecting a real data source.
          </p>
          <Textarea
            value={companyNames}
            onChange={(e) => setCompanyNames(e.target.value)}
            rows={4}
            placeholder={"One company name per line, e.g.\nAcme Staffing\nBrightpath Recruiting"}
          />
          <Button onClick={submitMock} disabled={pending} variant="outline">
            <Sparkles className="size-4" />
            {pending ? "Running…" : "Run demo detection"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
