"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  commitDealImport,
  previewDealImport,
  type ImportPreview,
  type ImportResult,
} from "@/app/(app)/opportunities/import-actions";
import { DEAL_COLUMNS } from "@/lib/import/deals";

/**
 * Bringing a pipeline in from a spreadsheet.
 *
 * Preview before commit, because the file a pilot customer has is never quite
 * the file the template describes and finding that out after the write is how
 * a first impression is lost. Errors are listed per row with the line number
 * as the spreadsheet shows it, so fixing them is a matter of scrolling to
 * that line rather than guessing.
 */
export function DealImportPanel({ templateCsv }: { templateCsv: string }) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [checking, startCheck] = useTransition();
  const [importing, startImport] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setResult(null);
    startCheck(async () => {
      const res = await previewDealImport({ csv: text });
      if (!res.ok) {
        toast.error(res.error);
        setPreview(null);
        return;
      }
      setPreview(res.data);
    });
  }

  function download() {
    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "selryn-deals-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Import your pipeline</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A CSV of your open deals. Re-importing the same file updates them
            rather than creating duplicates.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-3.5" />
          Download template
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
        <Button onClick={() => fileInput.current?.click()} disabled={checking || importing}>
          {checking ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
          Choose a CSV
        </Button>
        {fileName && <span className="text-[13px] text-muted-foreground">{fileName}</span>}
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
        Columns: {DEAL_COLUMNS.join(", ")}. Common alternatives such as
        “Deal ID”, “Account Name” and “Deal Value” are recognised automatically.
      </p>

      {/* ── What the file says, before anything is written ── */}
      {preview && !result && (
        <div className="mt-5 space-y-4 border-t border-border/60 pt-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className="font-medium">{preview.parsed} rows ready</span>
            {preview.errors.length > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {preview.errors.length} rows need attention
              </span>
            )}
          </div>

          {preview.sample.length > 0 && (
            <ul className="divide-y divide-border/50 rounded-xl border border-border/60">
              {preview.sample.map((row) => (
                <li key={row.row} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-[13px]">
                  <span className="text-muted-foreground tabular-nums">Row {row.row}</span>
                  <span className="font-medium">{row.company}</span>
                  <span className="text-muted-foreground">{row.externalId}</span>
                  <span className="ml-auto text-muted-foreground">
                    {row.stage}
                    {row.amount !== null && ` · ${row.amount.toLocaleString()} ${row.currency}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {preview.errors.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-amber-900 dark:text-amber-200">
                <AlertTriangle className="size-3.5" />
                These rows will be skipped
              </p>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {preview.errors.slice(0, 50).map((e, i) => (
                  <li key={i} className="text-[12.5px] leading-snug text-amber-900/90 dark:text-amber-300/90">
                    <span className="font-medium tabular-nums">Row {e.row}</span>
                    {e.column && <span className="text-amber-900/70"> · {e.column}</span>} — {e.message}
                  </li>
                ))}
                {preview.errors.length > 50 && (
                  <li className="text-[12.5px] text-amber-900/70">
                    …and {preview.errors.length - 50} more.
                  </li>
                )}
              </ul>
            </div>
          )}

          <Button
            disabled={importing || preview.parsed === 0}
            onClick={() =>
              startImport(async () => {
                if (!csv) return;
                const res = await commitDealImport({ csv });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setResult(res.data);
                toast.success(
                  res.data.created === 0 && res.data.updated === 0
                    ? "Nothing changed — every deal in the file already matches."
                    : `${res.data.created} added, ${res.data.updated} updated.`
                );
              })
            }
          >
            {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Import {preview.parsed} deals
          </Button>
        </div>
      )}

      {result && (
        <div
          className={cn(
            "mt-5 rounded-xl border p-4 text-sm",
            "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
          )}
        >
          <p className="font-medium">Import finished</p>
          <ul className="mt-1.5 space-y-0.5 text-[13px]">
            <li>{result.created} deals added</li>
            <li>{result.updated} deals updated</li>
            {/* Stated rather than omitted. Re-uploading the same file to fix
                two rows is normal, and the useful answer is that the other
                rows were left alone — not silence about them. */}
            {result.unchanged > 0 && (
              <li>{result.unchanged} already up to date, left alone</li>
            )}
            {result.skipped > 0 && <li>{result.skipped} rows skipped because of the errors above</li>}
            {result.failures.length > 0 && (
              <li className="text-rose-700 dark:text-rose-400">
                {result.failures.length} rows could not be saved
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
