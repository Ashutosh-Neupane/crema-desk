"use client";

/** Pick Columns dialog: the DocType's and its child tables' fields (Desk: report_view.js setup_columns_picker). */
import { useMemo, useState } from "react";
import { NO_VALUE } from "@/components/list/filters";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { STD, type Col } from "./shared";

export default function ColumnPicker({ open, onClose, meta, childMetas, value, onChange }: { open: boolean; onClose: () => void; meta: DocTypeMeta; childMetas: DocTypeMeta[]; value: Col[]; onChange: (f: Col[]) => void }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const std: DocField[] = Object.entries(STD).map(([fieldname, d]) => ({ fieldname, ...d }) as DocField);
    const mk = (m: DocTypeMeta, extra: DocField[] = []) => ({ doctype: m.name, fields: [...extra, ...(m.fields ?? []).filter((f) => !NO_VALUE.has(f.fieldtype))] });
    return [mk(meta, std), ...childMetas.map((c) => mk(c))];
  }, [meta, childMetas]);
  const has = (c: Col) => value.some((x) => x[0] === c[0] && x[1] === c[1]);
  const toggle = (c: Col) => onChange(has(c) ? value.filter((x) => !(x[0] === c[0] && x[1] === c[1])) : [...value, c]);
  const needle = q.trim().toLowerCase();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick Columns</DialogTitle>
          <DialogDescription>Child table columns show one row per child record, like Desk.</DialogDescription>
        </DialogHeader>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fields" aria-label="Search fields" className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        <div className="max-h-[55vh] space-y-4 overflow-auto pr-1">
          {groups.map((g) => {
            const fs = g.fields.filter((f) => !needle || String(f.label ?? f.fieldname).toLowerCase().includes(needle) || f.fieldname.includes(needle));
            if (!fs.length) return null;
            return (
              <section key={g.doctype}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">{g.doctype}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {fs.map((f) => (
                    <label key={f.fieldname} className="flex cursor-pointer items-center gap-2 truncate rounded px-1 py-0.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <input type="checkbox" checked={has([f.fieldname, g.doctype])} disabled={f.fieldname === "name" && g.doctype === meta.name} onChange={() => toggle([f.fieldname, g.doctype])} />
                      <span className="truncate">{f.label || f.fieldname}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="h-8 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
