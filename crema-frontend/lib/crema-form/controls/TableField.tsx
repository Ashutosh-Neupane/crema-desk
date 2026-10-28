"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import type { FieldControlProps } from "./index";
import FormControl from "./FormControl";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import type { DocTypeMeta, DocField } from "@/lib/frappe/types";
import { Plus, Trash2 } from "lucide-react";

export default function TableField({ field, value, onChange, disabled }: FieldControlProps) {
  const rows = useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);
  const childDoctype = typeof field.options === "string" ? field.options : "";

  const [meta, setMeta] = useState<DocTypeMeta | null>(null);

  useEffect(() => {
    if (!childDoctype) return;
    let cancelled = false;
    fetchDoctypeMetaClient(childDoctype)
      .then((m) => { if (!cancelled) setMeta(m); })
      .catch(() => { if (!cancelled) setMeta(null); });
    return () => { cancelled = true; };
  }, [childDoctype]);

  const childFields = useMemo(() => {
    if (!meta?.fields) return [];
    return meta.fields.filter(
      (f: DocField) =>
        !["Section Break", "Column Break", "Tab Break", "Heading", "Table", "Read Only", "Button", "HTML"].includes(f.fieldtype) &&
        !f.hidden,
    );
  }, [meta]);

  const addRow = useCallback(() => {
    const newRow: Record<string, unknown> = { idx: rows.length };
    onChange([...rows, newRow]);
  }, [rows, onChange]);

  const removeRow = useCallback((index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  }, [rows, onChange]);

  const updateRow = useCallback((index: number, key: string, val: unknown) => {
    const updated = rows.map((r, i) => (i === index ? { ...r, [key]: val } : r));
    onChange(updated);
  }, [rows, onChange]);

  if (!childDoctype) {
    return (
      <div className="text-sm text-zinc-500">
        No child DocType configured. Set the Options field to a valid DocType.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="w-10 px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">#</th>
              {childFields.map((f) => (
                <th key={f.fieldname} className="px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {f.label || f.fieldname}
                </th>
              ))}
              {!disabled && (
                <th className="w-20 px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={childFields.length + (disabled ? 1 : 2)} className="px-3 py-8 text-center text-sm text-zinc-500">
                  No rows. Click Add Row to add one.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={String(row.name) || i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-3 py-2 text-sm text-zinc-500">{i + 1}</td>
                  {childFields.map((f) => (
                    <td key={f.fieldname} className="px-3 py-2">
                      <FormControl
                        field={f}
                        value={row[f.fieldname]}
                        onChange={(val) => updateRow(i, f.fieldname, val)}
                        disabled={!!disabled}
                      />
                    </td>
                  ))}
                  {!disabled && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-zinc-400 hover:text-red-600"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!disabled && (
        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
        </div>
      )}
    </div>
  );
}
