"use client";

/** The full row editor: every child field of one row (Desk grid_row_form.js), slid in from the right */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2, X } from "lucide-react";
import type { FormController, Row } from "@/lib/form/FormController";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import FormBody from "@/components/form/FormBody";
import { copyOf } from "@/components/form/gridData";
import { useBackdropClose } from "@/components/form/useBackdropClose";

const smallBtn = "rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

interface Props {
  ctl: FormController;
  df: DocField;
  meta: DocTypeMeta;
  row: Row;
  rowCount: number;
  readOnly: boolean;
  cannotAdd: boolean;
  cannotDelete: boolean;
  overrides: Record<string, Record<string, unknown>>;
  errors: Record<string, string>;
  onEdit: (name: string | null) => void;
}

export default function GridRowEditor({ ctl, df, meta, row, rowCount, readOnly, cannotAdd, cannotDelete, overrides, errors, onEdit }: Props) {
  const table = df.fieldname;
  // Desk grid_row.move(): "Move To" prompt for the row number (value kept as typed)
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  useBackdropClose(backdrop, () => onEdit(null));
  // Desk grid_row.insert(show, below, duplicate): new row at idx (0-based `at`), editor opens on it
  const insertAt = async (at: number, copyFrom?: Row) => {
    const r = await ctl.add_child(table, copyFrom ? copyOf(copyFrom) : {}, at);
    onEdit(r.name);
  };
  const prefix = `${table}.${row.idx - 1}.`;
  const rowErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.split(".").pop()!, v]));

  return (
    <div ref={backdrop} className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <dialog open aria-modal="true" aria-label={`Editing row ${row.idx}`} className="static m-0 flex h-full max-h-none w-full max-w-2xl flex-col border-0 bg-zinc-50 p-0 text-inherit shadow-2xl dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3 sm:px-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {df.label} · Row #{row.idx}
          </h3>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {!readOnly && (
              <>
                <button type="button" onClick={() => ctl.move_row(table, row.name, -1)} aria-label="Move up" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => ctl.move_row(table, row.name, 1)} aria-label="Move down" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setMoveTo(String(row.idx))} className={smallBtn}>
                  Move To
                </button>
                {!cannotAdd && (
                  <>
                    <button type="button" onClick={() => void insertAt(row.idx - 1)} className={smallBtn}>
                      Insert Above
                    </button>
                    <button type="button" onClick={() => void insertAt(row.idx)} className={smallBtn}>
                      Insert Below
                    </button>
                    <button type="button" onClick={() => void insertAt(row.idx, row)} className={smallBtn}>
                      Duplicate
                    </button>
                  </>
                )}
                {!cannotDelete && (
                  <button type="button" onClick={() => { void ctl.remove_rows(table, [row.name]); onEdit(null); }} aria-label="Delete row" className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /></button>
                )}
              </>
            )}
            <button type="button" onClick={() => onEdit(null)} aria-label="Close" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
          </div>
        </div>
        {moveTo !== null && (
          <MoveToRow
            value={moveTo}
            max={rowCount}
            onChange={setMoveTo}
            onCancel={() => setMoveTo(null)}
            onMove={(to) => {
              // Desk grid_row.move(): row moves to the 1-based position, idx renumbered (reorder_row handles it)
              ctl.reorder_row(table, row.name, to - 1);
              setMoveTo(null);
              onEdit(null);
            }}
          />
        )}
        <div className="flex-1 overflow-y-auto p-4">
          <FormBody
            meta={meta}
            values={row}
            parent={ctl.getDoc()}
            readOnly={readOnly}
            overrides={overrides}
            overridePrefix={`${table}.`}
            errors={rowErrors}
            onChange={(f, v) => void ctl.editChild(row.doctype, row.name, f, v)}
            getQuery={(f) => () => ctl.getQuery(f, table)?.(ctl.getDoc(), row.doctype, row.name)}
            // Button fields in the row form fire the child doctype's event (Desk script_manager.trigger(fieldname, cdt, cdn))
            onButton={(f) => void ctl.clickButton(f, row.doctype, row.name)}
            compact
          />
        </div>
      </dialog>
    </div>
  );
}

function MoveToRow({ value, max, onChange, onCancel, onMove }: { value: string; max: number; onChange: (v: string) => void; onCancel: () => void; onMove: (to: number) => void }) {
  const apply = () => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a row number");
      return;
    }
    onMove(Math.min(n, max));
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-5 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      <label className="flex items-center gap-2">
        Move to Row Number
        <input
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className="w-20 rounded-md border border-zinc-200 bg-white px-2 py-1 tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      <button type="button" onClick={apply} className="rounded-md bg-zinc-900 px-2.5 py-1 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
        Update
      </button>
      <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
        Cancel
      </button>
    </div>
  );
}
