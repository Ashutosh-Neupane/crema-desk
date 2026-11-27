"use client";

/** One grid cell per child field type (Desk grid_row.js make_column / grid_row_form): inline editors and read-only text */
import { useState } from "react";
import type { FormController, Row } from "@/lib/form/FormController";
import type { DocField } from "@/lib/frappe/types";
import LinkField from "@/lib/crema-form/controls/LinkField";
import DatePicker from "@/components/form/DatePicker";
import TimePicker from "@/components/form/TimePicker";
import { formatCell } from "@/lib/list/format";
import { currencyFor } from "@/lib/crema-form/controls/NumberField";
import { NUMERIC } from "@/components/form/gridData";

interface CellProps {
  df: DocField;
  row: Row;
  table: string;
  ctl: FormController;
  readOnly: boolean;
  error?: string;
}

export default function Cell({ df, row, ctl, readOnly, table, error }: CellProps) {
  const value = row[df.fieldname];
  const set = (v: unknown) => void ctl.editChild(row.doctype, row.name, df.fieldname, v);
  if (df.fieldtype === "Check") return <CheckCell df={df} value={value} readOnly={readOnly} onChange={set} />;
  const parent = ctl.getDoc();
  const display = formatCell(value, df, { ...row, currency: parent.currency }, { currency: currencyFor(df, { ...parent, ...row }) });
  if (readOnly) {
    return <div className={`truncate px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 ${NUMERIC.has(df.fieldtype) ? "text-right tabular-nums" : ""}`}>{display}</div>;
  }
  return <EditCell df={df} row={row} table={table} ctl={ctl} error={error} value={value} display={display} onChange={set} />;
}

function CheckCell({ df, value, readOnly, onChange }: { df: DocField; value: unknown; readOnly: boolean; onChange: (v: unknown) => void }) {
  return (
    <div className="flex h-8 items-center justify-center">
      {readOnly ? (
        Number(value) ? <span className="text-zinc-700 dark:text-zinc-200">✓</span> : null
      ) : (
        <input type="checkbox" checked={!!Number(value)} onChange={(e) => onChange(e.target.checked ? 1 : 0)} aria-label={df.label ?? df.fieldname} className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100" />
      )}
    </div>
  );
}

function EditCell({
  df,
  row,
  table,
  ctl,
  error,
  value,
  display,
  onChange,
}: Omit<CellProps, "readOnly"> & { value: unknown; display: string; onChange: (v: unknown) => void }) {
  const label = df.label ?? df.fieldname;
  const base = `h-8 w-full rounded-md border bg-transparent px-2 text-sm text-zinc-900 focus:bg-white focus:outline-none dark:text-zinc-100 dark:focus:bg-zinc-900 ${error ? "border-red-400" : "border-transparent hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700"}`;
  const text = typeof value === "string" ? value : null;
  switch (df.fieldtype) {
    case "Link":
      // full Link control: suggestions on focus (set_query filters), "Create a new …", validation
      return <LinkField field={df} value={value} onChange={onChange} compact error={error} getQuery={() => ctl.getQuery(df.fieldname, table)?.(ctl.getDoc(), row.doctype, row.name)} />;
    case "Select":
      return (
        <select aria-label={label} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={base}>
          {[...new Set(String(df.options ?? "").split("\n"))].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "Date":
      return <DatePicker value={text} onChange={onChange} compact error={!!error} ariaLabel={label} />;
    case "Time":
      return <TimePicker value={text} onChange={onChange} compact error={!!error} ariaLabel={label} />;
    default:
      if (NUMERIC.has(df.fieldtype)) return <NumberCell label={label} value={value} display={display} onCommit={onChange} className={base} />;
      return <TextCell value={String(value ?? "")} onCommit={onChange} className={base} label={label} />;
  }
}

function NumberCell({ label, value, display, onCommit, className }: { label: string; value: unknown; display: string; onCommit: (v: unknown) => void; className: string }) {
  // `typed` only once the user edits: a value set while the cell has focus (paste, scripts) isn't overwritten on blur
  const [editing, setEditing] = useState<{ text: string; typed: boolean } | null>(null);
  const num = value == null || value === "" ? null : Number(value);
  const plain = num == null ? "" : String(num);
  const commit = () => {
    if (!editing?.typed) return setEditing(null);
    const raw = editing.text.replace(/,/g, "").trim();
    setEditing(null);
    const next = raw === "" ? null : Number(raw);
    if (next !== num && !(next !== null && Number.isNaN(next))) onCommit(next);
  };
  return (
    <input
      inputMode="decimal"
      value={editing?.typed ? editing.text : editing ? plain : display}
      aria-label={label}
      onFocus={() => setEditing({ text: plain, typed: false })}
      onChange={(e) => setEditing({ text: e.target.value, typed: true })}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`${className} text-right tabular-nums`}
    />
  );
}

function TextCell({ value, onCommit, className, label }: { value: string; onCommit: (v: unknown) => void; className: string; label: string }) {
  // null until the user types, so a value set while focused (paste, scripts) isn't overwritten on blur
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      value={text ?? value}
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
