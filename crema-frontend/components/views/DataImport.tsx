"use client";

/**
 * Data Import (Desk: frappe/core/doctype/data_import/data_import.js) as a guided page:
 *   1. DocType + import type (+ template download)  2. upload CSV/XLSX → Data Import doc
 *   3. preview with column mapping warnings          4. start (background job) → progress → log
 * Endpoints: data_import.get_preview_from_template · form_start_import · get_import_status · get_import_logs
 */
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, FileUp, Loader2 } from "lucide-react";
import LinkInput from "@/components/list/LinkInput";
import ExportDialog from "@/components/list/ExportDialog";
import { TYPES } from "./parts/dataimport/shared";
import { useDataImport } from "./parts/dataimport/useDataImport";
import { ImportPreview } from "./parts/dataimport/ImportPreview";
import { ImportProgress } from "./parts/dataimport/ImportProgress";

export default function DataImport() {
  const params = useSearchParams();
  const [doctype, setDoctype] = useState(() => params.get("doctype") ?? "");
  const [importType, setImportType] = useState(TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [submitAfter, setSubmitAfter] = useState(false);
  const [template, setTemplate] = useState(false);
  const { busy, di, preview, status, logs, reset, loadPreview, start } = useDataImport(doctype, file, importType, submitAfter);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div>
        <div className="text-xs text-zinc-500">
          <Link href="/desk/doctype/Data%20Import" className="hover:underline">
            Data Import
          </Link>
        </div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Import data</h1>
      </div>

      {/* step 1 + 2 */}
      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="di-doctype" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Document Type
            </label>
            <LinkInput
              id="di-doctype"
              doctype="DocType"
              value={doctype}
              onChange={(v) => {
                setDoctype(v);
                reset();
              }}
              getQuery={() => ({ filters: { allow_import: 1, istable: 0, issingle: 0 } })}
              className="[&_input]:h-9 [&_input]:w-full"
            />
          </div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Import Type
            <select
              value={importType}
              onChange={(e) => {
                setImportType(e.target.value);
                reset();
              }}
              className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
            >
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <FileUp className="h-4 w-4" aria-hidden />
            {file ? file.name : "Choose CSV or Excel file"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              aria-label="Import file"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                reset();
              }}
            />
          </label>
          <button type="button" disabled={!doctype} onClick={() => setTemplate(true)} className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:underline disabled:opacity-50 dark:text-zinc-400">
            <Download className="h-4 w-4" aria-hidden /> Download template
          </button>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={submitAfter} onChange={(e) => setSubmitAfter(e.target.checked)} /> Submit after import
          </label>
          <button type="button" disabled={!doctype || !file || !!busy || !!preview} onClick={() => void loadPreview()} className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ?? "Preview"}
          </button>
        </div>
      </section>

      {/* step 3: preview */}
      {preview && <ImportPreview preview={preview} canStart={!status} onStart={() => void start()} />}

      {/* step 4: progress + log */}
      {status && <ImportProgress status={status} logs={logs} doctype={doctype} di={di} />}

      {template && doctype && <ExportDialog doctype={doctype} template onClose={() => setTemplate(false)} />}
    </div>
  );
}
