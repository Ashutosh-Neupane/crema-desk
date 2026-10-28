"use client";

/**
 * Data Import (Desk: frappe/core/doctype/data_import/data_import.js) as a guided page:
 *   1. DocType + import type (+ template download)  2. upload CSV/XLSX → Data Import doc
 *   3. preview with column mapping warnings          4. start (background job) → progress → log
 * Endpoints: data_import.get_preview_from_template · form_start_import · get_import_status · get_import_logs
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, XCircle } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import LinkInput from "@/components/list/LinkInput";
import ExportDialog from "@/components/list/ExportDialog";

interface PreviewColumn {
  header_title: string;
  skip_import?: boolean;
  df?: { label?: string; fieldname?: string; reqd?: number };
  map_to_field?: string | null;
  warnings?: Array<{ message: string }>;
}
interface Preview {
  columns: PreviewColumn[];
  data: unknown[][];
  warnings: Array<{ row?: number; col?: number; message: string; type?: string }>;
  total_number_of_rows: number;
}
interface Status {
  status: string;
  total_records?: number;
  success?: number;
  failed?: number;
  processed_records?: number;
}
interface LogRow {
  success: number;
  docname?: string;
  messages?: string;
  exception?: string | null;
  row_indexes?: string;
}

const enc = encodeURIComponent;
const TYPES = ["Insert New Records", "Update Existing Records", "Insert or Update Records"];
const DONE = new Set(["Success", "Partial Success", "Error", "Timed Out"]);
const strip = (s: string) => s.replace(/<[^>]+>/g, "");

async function uploadFile(file: File, docname: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("doctype", "Data Import");
  fd.append("docname", docname);
  fd.append("fieldname", "import_file");
  fd.append("is_private", "1");
  const res = await fetch("/api/frappe/api/method/upload_file", { method: "POST", body: fd, credentials: "include" });
  const json = (await res.json().catch(() => ({}))) as { message?: { file_url?: string }; exc_type?: string };
  if (!res.ok || !json.message?.file_url) throw new Error(json.exc_type ? `Upload failed: ${json.exc_type}` : "Upload failed");
  return json.message.file_url;
}

export default function DataImport() {
  const params = useSearchParams();
  const [doctype, setDoctype] = useState(params.get("doctype") ?? "");
  const [importType, setImportType] = useState(TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [submitAfter, setSubmitAfter] = useState(false);
  const [template, setTemplate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [di, setDi] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (poll.current) clearTimeout(poll.current);
  }, []);

  const reset = () => {
    setDi(null);
    setPreview(null);
    setStatus(null);
    setLogs([]);
  };

  const loadPreview = async () => {
    if (!doctype || !file) return;
    setBusy("Uploading…");
    try {
      const { env } = await deskCall("frappe.client.insert", { doc: { doctype: "Data Import", reference_doctype: doctype, import_type: importType, submit_after_import: submitAfter ? 1 : 0 } });
      const name = (env.message as { name: string }).name;
      setDi(name);
      const url = await uploadFile(file, name);
      await deskCall("frappe.client.set_value", { doctype: "Data Import", name, fieldname: "import_file", value: url });
      setBusy("Reading file…");
      const p = await deskCall("frappe.core.doctype.data_import.data_import.get_preview_from_template", { data_import: name, import_file: url });
      setPreview(p.env.message as Preview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the file", { duration: 10000 });
    } finally {
      setBusy(null);
    }
  };

  const track = async (name: string) => {
    try {
      const { env } = await deskCall("frappe.core.doctype.data_import.data_import.get_import_status", { data_import_name: name });
      const s = env.message as Status;
      setStatus(s);
      if (DONE.has(s.status)) {
        const l = await deskCall("frappe.core.doctype.data_import.data_import.get_import_logs", { data_import: name });
        setLogs((l.env.message as LogRow[]) ?? []);
        return;
      }
    } catch {
      /* keep polling */
    }
    poll.current = setTimeout(() => void track(name), 1500);
  };

  const start = async () => {
    if (!di) return;
    try {
      await deskCall("frappe.core.doctype.data_import.data_import.form_start_import", { data_import: di });
      setStatus({ status: "Pending" });
      void track(di);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start import", { duration: 10000 });
    }
  };

  const errors = preview?.warnings.filter((w) => w.type !== "info") ?? [];
  const pct = status?.total_records ? Math.round(((status.processed_records ?? 0) / status.total_records) * 100) : 0;
  const failedLogs = logs.filter((l) => !l.success);

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
      {preview && (
        <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Preview</h2>
            <span className="text-xs text-zinc-500">
              {preview.total_number_of_rows} {preview.total_number_of_rows === 1 ? "row" : "rows"} · {preview.columns.filter((c) => !c.skip_import).length} columns
            </span>
            {!status && (
              <button type="button" onClick={() => void start()} disabled={preview.total_number_of_rows === 0} className="ml-auto h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
                Start Import
              </button>
            )}
          </div>
          {errors.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {errors.slice(0, 20).map((w, i) => (
                <li key={`${w.row ?? ""}|${w.col ?? ""}|${i}`} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {w.row ? `Row ${w.row}: ` : ""}
                    {strip(w.message)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="max-h-96 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm" aria-label="Import preview">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  {preview.columns.map((c, i) => (
                    <th key={`${c.header_title}|${i}`} scope="col" className={`whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-left text-xs font-medium dark:border-zinc-800 ${c.skip_import ? "text-zinc-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                      {c.header_title}
                      {!c.skip_import && c.df?.fieldname && <span className="block font-normal text-zinc-400">→ {c.df.label ?? c.df.fieldname}</span>}
                      {c.warnings?.length ? <span className="block font-normal text-amber-600">{strip(c.warnings[0].message)}</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.slice(0, 50).map((row, ri) => (
                  <tr key={String(row[0] ?? ri)} className="border-b border-zinc-100 dark:border-zinc-800">
                    {row.map((v, ci) => (
                      <td key={ci} className={`whitespace-nowrap px-3 py-1.5 ${preview.columns[ci]?.skip_import ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                        {v == null ? "" : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* step 4: progress + log */}
      {status && (
        <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" aria-live="polite">
          <div className="flex items-center gap-2 text-sm">
            {!DONE.has(status.status) ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" aria-hidden />
            ) : status.status === "Success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" aria-hidden />
            )}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Import status: {status.status}</span>
            <span className="text-zinc-500">
              {status.success ?? 0} imported{status.failed ? `, ${status.failed} failed` : ""}
              {status.total_records ? ` of ${status.total_records}` : ""}
            </span>
            {DONE.has(status.status) && doctype && (
              <Link href={`/desk/doctype/${enc(doctype)}`} className="ml-auto text-sm font-medium text-zinc-900 underline dark:text-zinc-100">
                Open {doctype} list
              </Link>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Import progress">
            <div className={`h-full transition-all ${status.failed ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${DONE.has(status.status) ? 100 : pct}%` }} />
          </div>
          {failedLogs.length > 0 && (
            <ul className="space-y-1 text-sm">
              {failedLogs.map((l, i) => {
                let msgs: string[] = [];
                try {
                  const parsed = JSON.parse(JSON.parse(l.messages || '"[]"')) as Array<{ message?: string; title?: string }>;
                  msgs = parsed.map((m) => strip(m.message ?? m.title ?? ""));
                } catch {
                  msgs = l.exception ? [l.exception.split("\n").filter(Boolean).pop() ?? ""] : [];
                }
                return (
                  <li key={`${l.row_indexes}|${i}`} className="rounded-md bg-red-50 px-3 py-1.5 text-red-800 dark:bg-red-950/40 dark:text-red-300">
                    Row {(() => {
                      try {
                        return (JSON.parse(l.row_indexes || "[]") as number[]).join(", ");
                      } catch {
                        return l.row_indexes;
                      }
                    })()}
                    : {msgs.join("; ") || "Failed"}
                  </li>
                );
              })}
            </ul>
          )}
          {logs.some((l) => l.success) && (
            <p className="text-xs text-zinc-500">
              Created:{" "}
              {logs
                .filter((l) => l.success && l.docname)
                .slice(0, 10)
                .map((l, i, a) => (
                  <span key={l.docname}>
                    <Link href={`/desk/doctype/${enc(doctype)}/${enc(String(l.docname))}`} className="underline">
                      {l.docname}
                    </Link>
                    {i < a.length - 1 ? ", " : ""}
                  </span>
                ))}
            </p>
          )}
          {di && (
            <Link href={`/desk/doctype/Data%20Import/${enc(di)}`} className="text-xs text-zinc-500 underline">
              View Data Import record
            </Link>
          )}
        </section>
      )}

      {template && doctype && <ExportDialog doctype={doctype} template onClose={() => setTemplate(false)} />}
    </div>
  );
}
