"use client";

/**
 * A Table field inside a frappe.ui.Dialog (form/controls/table.js + grid.js without a frm): editable rows over
 * `df.data`, add row / delete selected, a cell per child field rendered with the regular form controls.
 * Rows are mutated in place (like Desk) so `fields_dict.<f>.df.data` and `grid.get_selected_children()` stay live.
 */
import { Plus, Trash2 } from "lucide-react";
import FormControl from "@/lib/trevo-form/controls/FormControl";
import type { DocField } from "@/lib/frappe/types";
import { isGridChildField, type DeskDialog, type DialogField, type DialogRow } from "@/lib/desk-runtime/dialogs";

export default function DialogTable({ d, df: shown }: { d: DeskDialog; df: DialogField }) {
  const name = shown.fieldname!;
  // FormBody hands over a merged copy; scripts mutate the original (df.data = [...], cannot_add_rows, …)
  const df = d.fields_dict[name]?.df ?? shown;
  const grid = d.fields_dict[name]?.grid;
  const rows = d.tableData(df);
  const all = (df.fields ?? []).filter((c) => !!c && typeof c === "object" && isGridChildField(c));
  // grid.js shows the in_list_view columns; with none flagged, every field
  const cols = all.some((c) => c.in_list_view) ? all.filter((c) => c.in_list_view) : all;
  const canAdd = !df.cannot_add_rows;
  const canDelete = !df.cannot_delete_rows;
  const selected = rows.filter((r) => r.__checked);
  const toggleAll = (on: boolean) => {
    rows.forEach((r) => (r.__checked = on));
    grid?.refresh();
  };

  return (
    <div data-dialog-table={name} className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-800">
            <tr>
              {canDelete && (
                <th className="w-8 px-2 py-2">
                  <input type="checkbox" aria-label="Select all rows" checked={rows.length > 0 && selected.length === rows.length} onChange={(e) => toggleAll(e.target.checked)} />
                </th>
              )}
              <th className="w-8 px-2 py-2 text-left text-xs font-medium text-zinc-500">No.</th>
              {cols.map((c) => (
                <th key={c.fieldname} className="px-2 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {c.label ?? c.fieldname}
                  {!!c.reqd && <span className="ml-0.5 text-red-500">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length + 2} className="px-3 py-6 text-center text-sm text-zinc-500">No Data</td>
              </tr>
            )}
            {rows.map((row: DialogRow, i) => (
              <tr key={row.name ?? i} data-idx={row.idx} className="grid-row">
                {canDelete && (
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${row.idx}`}
                      checked={!!row.__checked}
                      onChange={(e) => {
                        row.__checked = e.target.checked;
                        grid?.refresh();
                      }}
                    />
                  </td>
                )}
                <td className="px-2 py-1.5 text-xs text-zinc-500">{row.idx}</td>
                {cols.map((c) => (
                  <td key={c.fieldname} className="min-w-28 px-1.5 py-1 align-top [&_label]:sr-only">
                    <FormControl
                      field={{ ...c, fieldname: c.fieldname!, label: c.label ?? c.fieldname } as DocField}
                      value={row[c.fieldname!]}
                      doc={row}
                      compact
                      disabled={!!c.read_only || !!df.read_only}
                      onChange={(v) => void d.set_row_value(name, row, c.fieldname!, v)}
                      getQuery={c.get_query ? () => c.get_query?.call({ df: c, doc: row, grid }, row) : undefined}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(canAdd || (canDelete && selected.length > 0)) && (
        <div className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
          {canDelete && selected.length > 0 && (
            <button type="button" onClick={() => grid?.delete_rows()} className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          {canAdd && (
            <button type="button" onClick={() => grid?.add_new_row()} className="ml-auto inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100">
              <Plus className="h-3.5 w-3.5" /> Add Row
            </button>
          )}
        </div>
      )}
    </div>
  );
}
