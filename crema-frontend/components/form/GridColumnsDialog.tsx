"use client";

/**
 * Configure a child table's columns for the current user (Desk: grid_row.js configure_columns → "Column Settings",
 * column_selector_for_dialog, update_user_settings_for_grid). Pick, order and size columns; saved in the parent
 * DocType's user settings as GridView[<child doctype>] = [{ fieldname, width (px), sticky }], the record Desk v16
 * reads, so the layout follows the user between Desk and Crema.
 */
import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import type { DocField } from "@/lib/frappe/types";
import { MAX_COL_PX, MIN_COL_PX, clampWidth, type GridViewColumn } from "@/components/form/gridColumns";

export default function GridColumnsDialog({
  title,
  current,
  available,
  onSave,
  onReset,
  onClose,
}: {
  title: string;
  /** the columns shown now, in order, with their width in px */
  current: GridViewColumn[];
  /** every field that can be a column */
  available: DocField[];
  onSave: (cols: GridViewColumn[]) => Promise<void>;
  onReset: () => Promise<void>;
  onClose: () => void;
}) {
  const [cols, setCols] = useState<GridViewColumn[]>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = (fn: string) => available.find((f) => f.fieldname === fn)?.label || fn;
  const unused = available.filter((f) => !cols.some((c) => c.fieldname === f.fieldname));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cols.length) return;
    const next = [...cols];
    [next[i], next[j]] = [next[j], next[i]];
    setCols(next);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Column Settings: {title}</DialogTitle>
          <DialogDescription>Columns you see in this table. Saved for you only; Desk uses the same setting.</DialogDescription>
        </DialogHeader>
        <ol aria-label="Columns" className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {cols.map((c, i) => (
            <li key={c.fieldname} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="w-5 text-xs tabular-nums text-zinc-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-100">{label(c.fieldname)}</span>
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                <input
                  type="number"
                  min={MIN_COL_PX}
                  max={MAX_COL_PX}
                  step={10}
                  aria-label={`${label(c.fieldname)} width`}
                  // an emptied box stays empty while retyping (Number("") is 0); blur / Update clamp it
                  value={c.width || ""}
                  onChange={(e) => setCols(cols.map((x) => (x.fieldname === c.fieldname ? { ...x, width: Number(e.target.value) } : x)))}
                  onBlur={() => setCols(cols.map((x) => (x.fieldname === c.fieldname ? { ...x, width: clampWidth(x.width) } : x)))}
                  className="w-16 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-right tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                />
                px
              </label>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${label(c.fieldname)} up`} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === cols.length - 1} aria-label={`Move ${label(c.fieldname)} down`} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                // Desk remove_selected_column: "At least one column is required to show in the grid."
                onClick={() => (cols.length > 1 ? setCols(cols.filter((x) => x.fieldname !== c.fieldname)) : setError("At least one column is required to show in the grid."))}
                aria-label={`Remove ${label(c.fieldname)}`}
                className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
        {unused.length > 0 && (
          <select
            aria-label="Add a column"
            value=""
            onChange={(e) => {
              const f = available.find((x) => x.fieldname === e.target.value);
              if (f) setCols([...cols, { fieldname: f.fieldname, width: 140 }]);
            }}
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="">+ Add a column…</option>
            {unused.map((f) => (
              <option key={f.fieldname} value={f.fieldname}>
                {f.label || f.fieldname} ({f.fieldtype})
              </option>
            ))}
          </select>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <DialogFooter className="gap-2 sm:justify-between">
          <button type="button" disabled={busy} onClick={() => void run(onReset)} className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Reset to default
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => onSave(cols.map((c) => ({ ...c, width: clampWidth(c.width) }))))}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Update
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
