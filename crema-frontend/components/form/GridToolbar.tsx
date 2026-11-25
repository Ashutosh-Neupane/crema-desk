"use client";

/** The grid's footers: pages + bulk Download / Upload, then the row actions (Add row / Add Multiple, or the selection's) */
import { Copy, Download, ListPlus, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { confirm as deskConfirm } from "@/lib/desk-runtime/dialogs";
import type { FormController, Row } from "@/lib/form/FormController";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { LAYOUT, copyOf, csvCell, parseCsv } from "@/components/form/gridData";

const outlineBtn = "inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

/** Desk grid_pagination (50 rows a page) and, when the Table field allows bulk edit, Download / Upload as CSV */
export function GridFooter({
  ctl,
  table,
  label,
  meta,
  rows,
  page,
  pages,
  setPage,
  bulkEdit,
  canUpload,
}: {
  ctl: FormController;
  table: string;
  label: string;
  meta: DocTypeMeta;
  rows: Row[];
  page: number;
  pages: number;
  setPage: (p: number) => void;
  bulkEdit: boolean;
  canUpload: boolean;
}) {
  const dataFields = (meta.fields ?? []).filter((f) => !LAYOUT.has(f.fieldtype) && f.fieldname);
  const download = () => {
    const header = dataFields.map((f) => csvCell(f.label ?? f.fieldname)).join(",");
    const body = rows.map((r) => dataFields.map((f) => csvCell(r[f.fieldname])).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const upload = async (file: File) => {
    const [head = [], ...lines] = parseCsv(await file.text());
    const map = head.map((h) => dataFields.find((f) => f.label === h.trim() || f.fieldname === h.trim())?.fieldname);
    let n = 0;
    for (const line of lines) {
      if (!line.some((v) => v.trim())) continue;
      const values: Record<string, unknown> = {};
      line.forEach((v, i) => map[i] && v !== "" && (values[map[i]!] = v));
      // in order: each add fires <table>_add like Desk
      // react-doctor-disable-next-line async-await-in-loop
      await ctl.add_child(table, values);
      n++;
    }
    toast.success(`Added ${n} row${n === 1 ? "" : "s"} to ${label}`);
  };
  if (pages <= 1 && !bulkEdit) return null;
  return (
    <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800">
      {pages > 1 && (
        <nav aria-label={`${label} pages`} className="flex items-center gap-1">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded px-2 py-0.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
            Previous
          </button>
          <span>
            Page {page + 1} of {pages} · {rows.length} rows
          </span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded px-2 py-0.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
            Next
          </button>
        </nav>
      )}
      {bulkEdit && (
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={download} className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Download className="h-3.5 w-3.5" aria-hidden /> Download
          </button>
          {canUpload && (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Upload className="h-3.5 w-3.5" aria-hidden /> Upload
              <input
                type="file"
                accept=".csv"
                className="sr-only"
                aria-label={`Upload rows to ${label}`}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(f);
                }}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/** Add row / Add Multiple, or Delete / Duplicate for the checked rows */
export function GridActions({
  ctl,
  table,
  rows,
  pageRowCount,
  selected,
  setSelected,
  cannotAdd,
  cannotDelete,
  canAddMultiple,
  onAdd,
  onAddMultiple,
}: {
  ctl: FormController;
  table: string;
  rows: Row[];
  pageRowCount: number;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  cannotAdd: boolean;
  cannotDelete: boolean;
  canAddMultiple: boolean;
  onAdd: () => void;
  onAddMultiple: () => void;
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.name));
  const duplicate = async () => {
    for (const r of rows.filter((x) => selected.has(x.name))) {
      // keep duplicated rows in their original order
      // react-doctor-disable-next-line async-await-in-loop
      await ctl.add_child(table, copyOf(r));
    }
    setSelected(new Set());
  };
  if (!selected.size) {
    if (cannotAdd) return <Bar />;
    return (
      <Bar>
        <button type="button" onClick={onAdd} className={outlineBtn}>
          <Plus className="h-3.5 w-3.5" /> Add row
        </button>
        {canAddMultiple && (
          <button type="button" onClick={onAddMultiple} className={outlineBtn}>
            <ListPlus className="h-3.5 w-3.5" /> Add Multiple
          </button>
        )}
      </Bar>
    );
  }
  return (
    <Bar>
      {!cannotDelete && allSelected && rows.length > pageRowCount && (
        // Desk grid.js delete_all_rows: header checkbox across pages → "Delete all N rows" (confirmed)
        <button
          type="button"
          onClick={() => {
            deskConfirm(`Are you sure you want to delete all ${rows.length} rows?`, () => {
              void ctl.delete_all_rows(table);
              setSelected(new Set());
            });
          }}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete all {rows.length} rows
        </button>
      )}
      {!cannotDelete && (
        <button type="button" onClick={() => { void ctl.remove_rows(table, [...selected]); setSelected(new Set()); }} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      )}
      {!cannotAdd && (
        <button type="button" onClick={() => void duplicate()} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
      )}
      <span className="text-xs text-zinc-400">{selected.size} selected</span>
    </Bar>
  );
}

function Bar({ children }: { children?: React.ReactNode }) {
  return <div className="flex items-center gap-2 border-t border-zinc-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">{children}</div>;
}

