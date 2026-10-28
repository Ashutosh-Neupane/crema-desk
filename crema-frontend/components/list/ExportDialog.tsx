"use client";

/**
 * Export / template download (Desk: frappe/core/doctype/data_export → data_import.download_template).
 * Pick fields (parent + child tables), which records, CSV or Excel; the server builds the file.
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { useFormMetas } from "@/lib/hooks/useFormMetas";
import type { Filter } from "@/lib/list/api";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

const NO_EXPORT = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Image", "Fold", "Heading", "Table", "Table MultiSelect", "Password", "Signature", "Geolocation"]);
type Records = "all" | "by_filter" | "5_records" | "blank_template";

const exportable = (m: DocTypeMeta): DocField[] => (m.fields ?? []).filter((f) => !NO_EXPORT.has(f.fieldtype) && f.fieldname);

/** Download a template/export through the BFF proxy (the response is the file) */
export function downloadTemplate(doctype: string, fields: Record<string, string[]>, records: Records, filters: Filter[], fileType: "CSV" | "Excel") {
  const qs = new URLSearchParams({
    doctype,
    export_fields: JSON.stringify(fields),
    export_records: records,
    export_filters: JSON.stringify(records === "by_filter" ? filters : []),
    file_type: fileType,
  });
  const a = document.createElement("a");
  a.href = `/api/frappe/api/method/frappe.core.doctype.data_import.data_import.download_template?${qs}`;
  a.rel = "noopener";
  a.download = `${doctype}.${fileType === "Excel" ? "xlsx" : "csv"}`;
  a.click();
}

export default function ExportDialog({
  doctype,
  filters = [],
  template = false,
  onClose,
}: {
  doctype: string;
  filters?: Filter[];
  /** open as "Download Template" (blank, mandatory fields) */
  template?: boolean;
  onClose: () => void;
}) {
  const { data: metas } = useFormMetas(doctype);
  const tables = useMemo(() => (metas?.meta.fields ?? []).filter((f) => f.fieldtype === "Table" && f.options), [metas]);
  const [records, setRecords] = useState<Records>(template ? "blank_template" : filters.length ? "by_filter" : "all");
  const [fileType, setFileType] = useState<"CSV" | "Excel">("CSV");
  // default selection: name + mandatory + list-view fields (Desk "Select Mandatory")
  const [picked, setPicked] = useState<Record<string, Set<string>> | null>(null);
  const defaults = useMemo(() => {
    if (!metas) return null;
    const out: Record<string, Set<string>> = { [doctype]: new Set(["name", ...exportable(metas.meta).filter((f) => f.reqd || (!template && f.in_list_view)).map((f) => f.fieldname)]) };
    for (const c of metas.children) out[c.name] = new Set(exportable(c).filter((f) => f.reqd).map((f) => f.fieldname));
    return out;
  }, [metas, doctype, template]);
  const sel = picked ?? defaults ?? {};

  const toggle = (dt: string, fn: string) => {
    const next = Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, new Set(v)]));
    const s = (next[dt] ??= new Set());
    if (s.has(fn)) s.delete(fn);
    else s.add(fn);
    setPicked(next);
  };
  const setAll = (dt: string, fields: DocField[], on: boolean) => {
    const next = Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, new Set(v)]));
    next[dt] = on ? new Set([...(dt === doctype ? ["name"] : []), ...fields.map((f) => f.fieldname)]) : new Set(dt === doctype ? ["name"] : []);
    setPicked(next);
  };

  const run = () => {
    // export_fields keys: parent doctype, then child *table fieldnames* (Exporter's contract)
    const fields: Record<string, string[]> = { [doctype]: [...(sel[doctype] ?? [])] };
    for (const t of tables) {
      const chosen = [...(sel[String(t.options)] ?? [])];
      if (chosen.length) fields[t.fieldname] = chosen;
    }
    downloadTemplate(doctype, fields, records, filters, fileType);
    onClose();
  };

  const group = (dt: string, label: string, fields: DocField[]) => (
    <section key={dt}>
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</h3>
        <button type="button" className="text-xs text-zinc-500 hover:underline" onClick={() => setAll(dt, fields, true)}>
          All
        </button>
        <button type="button" className="text-xs text-zinc-500 hover:underline" onClick={() => setAll(dt, fields, false)}>
          None
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {dt === doctype && (
          <label className="flex items-center gap-2 text-sm text-zinc-500">
            <input type="checkbox" checked disabled /> ID
          </label>
        )}
        {fields.map((f) => (
          <label key={f.fieldname} className="flex cursor-pointer items-center gap-2 truncate text-sm">
            <input type="checkbox" checked={!!sel[dt]?.has(f.fieldname)} onChange={() => toggle(dt, f.fieldname)} />
            <span className="truncate">
              {f.label || f.fieldname}
              {f.reqd ? <span className="text-red-500" aria-hidden> *</span> : null}
            </span>
          </label>
        ))}
      </div>
    </section>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? "Download Template" : `Export ${doctype}`}</DialogTitle>
          <DialogDescription>{template ? "A blank file with the columns the importer expects." : "The server builds the file with the selected columns."}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Records
            <select value={records} onChange={(e) => setRecords(e.target.value as Records)} className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900">
              <option value="all">All records</option>
              <option value="by_filter" disabled={!filters.length}>
                Filtered records{filters.length ? ` (${filters.length} filter${filters.length > 1 ? "s" : ""})` : ""}
              </option>
              <option value="5_records">5 records</option>
              <option value="blank_template">Blank template</option>
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            File Type
            <select value={fileType} onChange={(e) => setFileType(e.target.value as "CSV" | "Excel")} className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900">
              <option value="CSV">CSV</option>
              <option value="Excel">Excel</option>
            </select>
          </label>
        </div>
        <div className="max-h-[50vh] space-y-4 overflow-auto pr-1">
          {metas ? (
            <>
              {group(doctype, doctype, exportable(metas.meta))}
              {tables.map((t) => {
                const cm = metas.children.find((c) => c.name === t.options);
                return cm ? group(cm.name, `${t.label ?? t.fieldname} (${cm.name})`, exportable(cm)) : null;
              })}
            </>
          ) : (
            <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          )}
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200">
            Cancel
          </button>
          <button type="button" onClick={run} disabled={!metas} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            {template ? "Download" : "Export"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
