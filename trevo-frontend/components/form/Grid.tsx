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
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import type { FormController, Row } from "@/lib/form/FormController";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import LinkInput from "@/components/list/LinkInput";
import FormBody from "@/components/form/FormBody";
import { formatCell } from "@/lib/list/format";
import { currencyFor } from "@/lib/trevo-form/controls/NumberField";

const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Button", "Heading", "Image", "Table", "Table MultiSelect"]);
const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);

/** Desk grid default widths (grid_row.js setup_columns) */
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
    return (
      <LinkInput
        doctype={String(df.options)}
        value={String(value ?? "")}
        onChange={(v) => set(v || null)}
        placeholder=""
        getQuery={() => ctl.getQuery(df.fieldname, table)?.(parent, row.doctype, row.name)}
        className="[&_input]:border-transparent [&_input]:bg-transparent [&_input:hover]:border-zinc-200 [&_input:focus]:border-zinc-400 dark:[&_input:hover]:border-zinc-700"
      />
    );
  }
  if (df.fieldtype === "Select") {
    return (
      <select value={String(value ?? "")} onChange={(e) => set(e.target.value)} className={base}>
        {String(df.options ?? "").split("\n").map((o, i) => <option key={`${i}-${o}`} value={o}>{o}</option>)}
      </select>
    );
  }
  if (NUMERIC.has(df.fieldtype)) return <NumberCell df={df} value={value} display={display} onCommit={set} className={base} />;
  if (df.fieldtype === "Date") return <input type="date" value={String(value ?? "")} onChange={(e) => set(e.target.value || null)} className={base} />;
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
    <input
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
  const tableReadOnly = readOnly || !!(overrides[table]?.read_only ?? df.read_only);
  const cannotAdd = !!(df as { cannot_add_rows?: unknown }).cannot_add_rows || !!overrides[table]?.cannot_add_rows;
  const cannotDelete = !!(df as { cannot_delete_rows?: unknown }).cannot_delete_rows;
  const template = `2.25rem 2.5rem ${cols.map((c) => `minmax(0,${c.width}fr)`).join(" ")} 2.5rem`;
  const editRow = rows.find((r) => r.name === editing);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.name));

  const add = async (at?: number) => {
    const row = await ctl.add_child(table, {}, at);
    // Desk focuses the first cell of the new row; open the editor if no inline columns
    if (!cols.length) setEditing(row.name);
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
                {!!(overrides[`${table}.${c.fieldname}`]?.reqd ?? c.reqd) && <span className="ml-0.5 text-red-500">*</span>}
              </div>
            ))}
            <div />
          </div>

          {rows.map((row, i) => (
            <div key={row.name} className={`group grid items-center border-b border-zinc-100 last:border-0 dark:border-zinc-800/70 ${selected.has(row.name) ? "bg-zinc-50 dark:bg-zinc-800/40" : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20"}`} style={{ gridTemplateColumns: template }}>
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
              <div className="text-center text-xs tabular-nums text-zinc-400">{i + 1}</div>
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
            </div>
          ))}

          {rows.length === 0 && <div className="px-4 py-6 text-center text-sm text-zinc-400">No rows</div>}
        </div>
      </div>

      {!tableReadOnly && (
        <div className="flex items-center gap-2 border-t border-zinc-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          {selected.size > 0 ? (
            <>
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
                    {!cannotAdd && (
                      <button type="button" onClick={async () => { const r = await ctl.add_child(table, {}, editRow.idx); setEditing(r.name); }} className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                        Insert below
                      </button>
                    )}
                    {!cannotDelete && (
                      <button type="button" onClick={() => { void ctl.remove_rows(table, [editRow.name]); setEditing(null); }} aria-label="Delete row" className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </>
                )}
                <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
              </div>
            </div>
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
