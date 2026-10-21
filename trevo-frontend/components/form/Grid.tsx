"use client";

/**
 * Child table grid, Desk-style (frappe/public/js/frappe/form/grid.js):
 *  - columns = child fields with in_list_view (width from df.columns, Desk's
 *    default per type), total ≤ 10 units; ✓ for Check
 *  - cells edit inline; the pencil opens the full row editor (every field)
 *  - select rows → Delete / Duplicate; per-row insert below, move up/down
 *  - every change goes through the FormController, so child events
 *    (item_code(frm, cdt, cdn), qty…) and fetch_from run exactly once
 */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Download, GripVertical, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { confirm as deskConfirm } from "@/lib/desk-runtime/dialogs";
import type { FormController, Row } from "@/lib/form/FormController";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import LinkField from "@/lib/trevo-form/controls/LinkField";
import FormBody from "@/components/form/FormBody";
import DatePicker from "@/components/form/DatePicker";
import { formatCell } from "@/lib/list/format";
import { currencyFor } from "@/lib/trevo-form/controls/NumberField";

const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Button", "Heading", "Image", "Table", "Table MultiSelect"]);
const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);

/** Desk grid default widths (grid_row.js setup_columns) */
const PAGE_SIZE = 50;
const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Heading", "Fold", "Table", "Table MultiSelect", "Image"]);
const csvCell = (v: unknown) => {
  const t = v == null ? "" : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
/** Minimal RFC 4180 parser (quoted fields, escaped quotes, CRLF) */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

function SortableGridRow({ id, disabled, template, selected, children }: { id: string; disabled: boolean; template: string; selected: boolean; children: (handle: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ gridTemplateColumns: template, transform: CSS.Transform.toString(transform), transition }}
      className={`group relative grid items-center border-b border-zinc-100 last:border-0 dark:border-zinc-800/70 ${isDragging ? "z-10 bg-white shadow-md dark:bg-zinc-900" : selected ? "bg-zinc-50 dark:bg-zinc-800/40" : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20"}`}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

function defaultWidth(df: DocField): number {
  if (df.columns) return Number(df.columns);
  if (df.fieldtype === "Check") return 1;
  if (NUMERIC.has(df.fieldtype)) return df.fieldtype === "Currency" ? 2 : 1;
  if (["Text", "Small Text", "Text Editor", "Long Text"].includes(df.fieldtype)) return 3;
  return 2;
}

export function gridColumns(meta: DocTypeMeta, overrides: Record<string, Record<string, unknown>>, table: string): Array<DocField & { width: number }> {
  const visible = (meta.fields ?? []).filter((f) => !NO_VALUE.has(f.fieldtype) && !(overrides[`${table}.${f.fieldname}`]?.hidden ?? f.hidden));
  let cols = visible.filter((f) => f.in_list_view);
  if (!cols.length) cols = visible.filter((f) => f.reqd).concat(visible.filter((f) => !f.reqd)).slice(0, 4);
  const out: Array<DocField & { width: number }> = [];
  let total = 0;
  for (const f of cols) {
    const w = defaultWidth(f);
    if (total + w > 10) break;
    total += w;
    out.push({ ...f, width: w });
  }
  return out;
}

function Cell({
  df,
  row,
  table,
  ctl,
  readOnly,
  error,
}: {
  df: DocField;
  row: Row;
  table: string;
  ctl: FormController;
  readOnly: boolean;
  error?: string;
}) {
  const value = row[df.fieldname];
  const set = (v: unknown) => void ctl.set_child_value(row.doctype, row.name, df.fieldname, v);
  const parent = ctl.getDoc();
  const display = formatCell(value, df, { ...row, currency: parent.currency }, { currency: currencyFor(df, { ...parent, ...row }) });
  const base = `h-8 w-full rounded-md border bg-transparent px-2 text-sm text-zinc-900 focus:bg-white focus:outline-none dark:text-zinc-100 dark:focus:bg-zinc-900 ${error ? "border-red-400" : "border-transparent hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700"}`;

  if (df.fieldtype === "Check") {
    return (
      <div className="flex h-8 items-center justify-center">
        {readOnly ? (
          Number(value) ? <span className="text-zinc-700 dark:text-zinc-200">✓</span> : null
        ) : (
          <input type="checkbox" checked={!!Number(value)} onChange={(e) => set(e.target.checked ? 1 : 0)} aria-label={df.label ?? df.fieldname} className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100" />
        )}
      </div>
    );
  }
  if (readOnly) {
    return <div className={`truncate px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 ${NUMERIC.has(df.fieldtype) ? "text-right tabular-nums" : ""}`}>{display}</div>;
  }
  if (df.fieldtype === "Link") {
    // full Link control: suggestions on focus (set_query filters), "Create a new …", validation
    return (
      <LinkField
        field={df}
        value={value}
        onChange={(v) => set(v)}
        compact
        error={error}
        getQuery={() => ctl.getQuery(df.fieldname, table)?.(parent, row.doctype, row.name)}
      />
    );
  }
  if (df.fieldtype === "Select") {
    return (
      <select aria-label={df.label ?? df.fieldname} value={String(value ?? "")} onChange={(e) => set(e.target.value)} className={base}>
        {String(df.options ?? "").split("\n").map((o, i) => <option key={`${i}-${o}`} value={o}>{o}</option>)}
      </select>
    );
  }
  if (NUMERIC.has(df.fieldtype)) return <NumberCell df={df} value={value} display={display} onCommit={set} className={base} />;
  if (df.fieldtype === "Date") return <DatePicker value={typeof value === "string" ? value : null} onChange={(v) => set(v)} compact error={!!error} ariaLabel={df.label ?? df.fieldname} />;
  return <TextCell value={String(value ?? "")} onCommit={set} className={base} />;
}

function NumberCell({ df, value, display, onCommit, className }: { df: DocField; value: unknown; display: string; onCommit: (v: unknown) => void; className: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const num = value == null || value === "" ? null : Number(value);
  return (
    <input
      inputMode="decimal"
      value={editing ?? display}
      aria-label={df.label ?? df.fieldname}
      onFocus={() => setEditing(num == null ? "" : String(num))}
      onChange={(e) => setEditing(e.target.value)}
      onBlur={() => {
        if (editing === null) return;
        const raw = editing.replace(/,/g, "").trim();
        setEditing(null);
        const next = raw === "" ? null : Number(raw);
        if (next !== num && !(next !== null && Number.isNaN(next))) onCommit(next);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`${className} text-right tabular-nums`}
    />
  );
}

function TextCell({ value, onCommit, className }: { value: string; onCommit: (v: unknown) => void; className: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input aria-label="Value"
      value={text ?? value}
      onFocus={() => setText(value)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== null && text !== value) onCommit(text || null);
        setText(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={className}
    />
  );
}

export default function Grid({
  ctl,
  df,
  meta,
  readOnly,
  overrides,
  errors,
}: {
  ctl: FormController;
  df: DocField;
  meta: DocTypeMeta;
  readOnly: boolean;
  overrides: Record<string, Record<string, unknown>>;
  errors: Record<string, string>;
}) {
  const table = df.fieldname;
  const rows = (ctl.getDoc()[table] as Row[]) ?? [];
  const cols = useMemo(() => gridColumns(meta, overrides, table), [meta, overrides, table]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  // Desk grid_row.move(): "Move To" prompt for the row number (value kept as typed)
  const [moveOpen, setMoveOpen] = useState<{ name: string; value: string } | null>(null);
  const tableReadOnly = readOnly || !!(overrides[table]?.read_only ?? df.read_only);
  const cannotAdd = !!(df as { cannot_add_rows?: unknown }).cannot_add_rows || !!overrides[table]?.cannot_add_rows;
  const cannotDelete = !!(df as { cannot_delete_rows?: unknown }).cannot_delete_rows;
  const template = `2.25rem 2.5rem ${cols.map((c) => `minmax(0,${c.width}fr)`).join(" ")} 2.5rem`;
  const editRow = rows.find((r) => r.name === editing);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.name));
  // Desk grid_pagination: 50 rows per page
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const curPage = Math.min(page, pages - 1);
  const pageStart = curPage * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const to = rows.findIndex((r) => r.name === e.over!.id);
    if (to >= 0) ctl.reorder_row(table, String(e.active.id), to);
  };
  // Desk: Download / Upload only when the Table field allows bulk edit
  const bulkEdit = !!(df as { allow_bulk_edit?: unknown }).allow_bulk_edit;
  const dataFields = useMemo(() => (meta.fields ?? []).filter((f) => !LAYOUT.has(f.fieldtype) && f.fieldname), [meta]);
  const download = () => {
    const header = dataFields.map((f) => csvCell(f.label ?? f.fieldname)).join(",");
    const body = rows.map((r) => dataFields.map((f) => csvCell(r[f.fieldname])).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${df.label ?? table}.csv`;
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
    toast.success(`Added ${n} row${n === 1 ? "" : "s"} to ${df.label ?? table}`);
  };

  const add = async (at?: number) => {
    const row = await ctl.add_child(table, {}, at);
    if (at === undefined) setPage(Math.floor(rows.length / PAGE_SIZE));
    // Desk focuses the first cell of the new row; open the editor if no inline columns
    if (!cols.length) setEditing(row.name);
  };

  // Desk grid_row.insert(show, below, duplicate): new row at idx (0-based `at`), editor opens on it
  // Desk grid_row.move(): row moves to the 1-based position, idx renumbered (reorder_row handles it)
  const applyMove = () => {
    if (!editRow || moveOpen?.name !== editRow.name) return;
    const n = Math.round(Number(moveOpen.value));
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a row number");
      return;
    }
    ctl.reorder_row(table, editRow.name, Math.min(n, rows.length) - 1);
    setMoveOpen(null);
    setEditing(null);
  };

  const insertAt = async (at: number, copyFrom?: Row) => {
    const copy = copyFrom ? Object.fromEntries(Object.entries(copyFrom).filter(([k]) => !["name", "idx", "__islocal", "creation", "modified", "owner", "modified_by"].includes(k))) : {};
    const r = await ctl.add_child(table, copy, at);
    setEditing(r.name);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid items-center border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60" style={{ gridTemplateColumns: template }}>
            <div className="flex justify-center py-2">
              {!tableReadOnly && (
                <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.name)))} className="h-3.5 w-3.5 accent-zinc-900 dark:accent-zinc-100" />
              )}
            </div>
            <div className="py-2 text-center">No.</div>
            {cols.map((c) => (
              <div key={c.fieldname} className={`truncate px-2 py-2 ${NUMERIC.has(c.fieldtype) ? "text-right" : c.fieldtype === "Check" ? "text-center" : ""}`} title={c.label ?? undefined}>
                {c.label}
                {!!(overrides[`${table}.${c.fieldname}`]?.reqd ?? c.reqd) && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
              </div>
            ))}
            <div />
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={pageRows.map((r) => r.name)} strategy={verticalListSortingStrategy}>
              {pageRows.map((row, k) => {
                const i = pageStart + k;
                return (
                  <SortableGridRow key={row.name} id={row.name} disabled={tableReadOnly} template={template} selected={selected.has(row.name)}>
                    {(handle) => (
                      <>
                        <div className="flex justify-center">
                          {!tableReadOnly && (
                            <input
                              type="checkbox"
                              aria-label={`Select row ${i + 1}`}
                              checked={selected.has(row.name)}
                              onChange={() => {
                                const next = new Set(selected);
                                if (next.has(row.name)) next.delete(row.name);
                                else next.add(row.name);
                                setSelected(next);
                              }}
                              className="h-3.5 w-3.5 accent-zinc-900 dark:accent-zinc-100"
                            />
                          )}
                        </div>
                        <div className="relative flex items-center justify-center text-xs tabular-nums text-zinc-400">
                          <span className={tableReadOnly ? "" : "group-hover:opacity-0"}>{i + 1}</span>
                          {!tableReadOnly && (
                            <button type="button" {...handle} aria-label={`Drag row ${i + 1}`} className="absolute inset-0 m-auto flex h-6 w-6 cursor-grab items-center justify-center rounded text-zinc-400 opacity-0 hover:bg-zinc-100 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-800">
                              <GripVertical className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          )}
                        </div>
                        {cols.map((c) => (
                          <div key={c.fieldname} className="min-w-0 px-0.5 py-0.5">
                            <Cell
                              df={{ ...c, ...(overrides[`${table}.${c.fieldname}`] as Partial<DocField>) }}
                              row={row}
                              table={table}
                              ctl={ctl}
                              readOnly={tableReadOnly || !!(overrides[`${table}.${c.fieldname}`]?.read_only ?? c.read_only)}
                              error={errors[`${table}.${i}.${c.fieldname}`]}
                            />
                          </div>
                        ))}
                        <div className="flex justify-center">
                          <button type="button" onClick={() => setEditing(row.name)} aria-label={`Edit row ${i + 1}`} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </SortableGridRow>
                );
              })}
            </SortableContext>
          </DndContext>

          {rows.length === 0 && <div className="px-4 py-6 text-center text-sm text-zinc-400">No rows</div>}
        </div>
      </div>

      {(pages > 1 || bulkEdit) && (
        <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800">
          {pages > 1 && (
            <nav aria-label={`${df.label ?? table} pages`} className="flex items-center gap-1">
              <button type="button" disabled={curPage === 0} onClick={() => setPage(curPage - 1)} className="rounded px-2 py-0.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
                Previous
              </button>
              <span>
                Page {curPage + 1} of {pages} · {rows.length} rows
              </span>
              <button type="button" disabled={curPage >= pages - 1} onClick={() => setPage(curPage + 1)} className="rounded px-2 py-0.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
                Next
              </button>
            </nav>
          )}
          {bulkEdit && (
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={download} className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Download className="h-3.5 w-3.5" aria-hidden /> Download
              </button>
              {!tableReadOnly && !cannotAdd && (
                <label className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Upload className="h-3.5 w-3.5" aria-hidden /> Upload
                  <input
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    aria-label={`Upload rows to ${df.label ?? table}`}
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
      )}

      {!tableReadOnly && (
        <div className="flex items-center gap-2 border-t border-zinc-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          {selected.size > 0 ? (
            <>
              {!cannotDelete && allSelected && rows.length > pageRows.length && (
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
                <button
                  type="button"
                  onClick={async () => {
                    for (const r of rows.filter((x) => selected.has(x.name))) {
                      const copy = Object.fromEntries(Object.entries(r).filter(([k]) => !["name", "idx", "__islocal", "creation", "modified", "owner"].includes(k)));
                      // keep duplicated rows in their original order
                      // react-doctor-disable-next-line async-await-in-loop
                      await ctl.add_child(table, copy);
                    }
                    setSelected(new Set());
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </button>
              )}
              <span className="text-xs text-zinc-400">{selected.size} selected</span>
            </>
          ) : (
            !cannotAdd && (
              <button type="button" onClick={() => void add()} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <Plus className="h-3.5 w-3.5" /> Add row
              </button>
            )
          )}
        </div>
      )}

      {editRow && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)} role="dialog" aria-modal="true" aria-label={`Editing row ${editRow.idx}`}>
          <div className="flex h-full w-full max-w-2xl flex-col bg-zinc-50 shadow-2xl dark:bg-zinc-950">
            <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {df.label} · Row #{editRow.idx}
              </h3>
              <div className="ml-auto flex items-center gap-1">
                {!tableReadOnly && (
                  <>
                    <button type="button" onClick={() => ctl.move_row(table, editRow.name, -1)} aria-label="Move up" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => ctl.move_row(table, editRow.name, 1)} aria-label="Move down" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setMoveOpen({ name: editRow.name, value: String(editRow.idx) })} className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                      Move To
                    </button>
                    {!cannotAdd && (
                      <>
                      <button type="button" onClick={() => void insertAt(editRow.idx - 1)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                        Insert Above
                      </button>
                      <button type="button" onClick={() => void insertAt(editRow.idx)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                        Insert Below
                      </button>
                        <button type="button" onClick={() => void insertAt(editRow.idx, editRow)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                          Duplicate
                        </button>
                      </>
                    )}
                    {!cannotDelete && (
                      <button type="button" onClick={() => { void ctl.remove_rows(table, [editRow.name]); setEditing(null); }} aria-label="Delete row" className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </>
                )}
                <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
              </div>
            </div>
            {moveOpen?.name === editRow.name && (
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-5 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                <label className="flex items-center gap-2">
                  Move to Row Number
                  <input
                    type="number"
                    min={1}
                    max={rows.length}
                    value={moveOpen.value}
                    onChange={(e) => setMoveOpen({ name: editRow.name, value: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && applyMove()}
                    className="w-20 rounded-md border border-zinc-200 bg-white px-2 py-1 tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
                <button type="button" onClick={applyMove} className="rounded-md bg-zinc-900 px-2.5 py-1 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                  Update
                </button>
                <button type="button" onClick={() => setMoveOpen(null)} className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  Cancel
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4">
              <FormBody
                meta={meta}
                values={editRow}
                parent={ctl.getDoc()}
                readOnly={tableReadOnly}
                overrides={overrides}
                overridePrefix={`${table}.`}
                errors={Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith(`${table}.${editRow.idx - 1}.`)).map(([k, v]) => [k.split(".").pop()!, v]))}
                onChange={(f, v) => void ctl.set_child_value(editRow.doctype, editRow.name, f, v)}
                getQuery={(f) => () => ctl.getQuery(f, table)?.(ctl.getDoc(), editRow.doctype, editRow.name)}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
