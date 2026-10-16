"use client";

/**
 * Int / Float / Currency / Percent — Desk shows the formatted value
 * ("NPR 6,400.00") and edits the raw number; the value commits on blur /
 * Enter so totals don't recalculate on every keystroke. Currency comes from
 * the document (field `options` names the currency field, e.g. "currency").
 */
import { useState } from "react";
import type { FieldControlProps } from "./index";
import { formatCell } from "@/lib/list/format";

export function currencyFor(field: FieldControlProps["field"], doc?: Record<string, unknown>): string | undefined {
  const opt = typeof field.options === "string" ? field.options : "";
  if (opt && doc && typeof doc[opt] === "string") return doc[opt] as string;
  if (opt.includes(":")) return (doc?.company_currency as string) || (doc?.currency as string) || undefined;
  return (doc?.currency as string) || undefined;
}

export default function NumberField({ field, inputId, value, onChange, disabled, error, doc }: FieldControlProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const isDisabled = disabled || !!field.read_only;
  const num = value === null || value === undefined || value === "" ? null : Number(value);
  const display = num == null ? "" : formatCell(num, field, doc ?? {}, { currency: currencyFor(field, doc) });

  const commit = () => {
    if (editing === null) return;
    const raw = editing.trim().replace(/,/g, "");
    setEditing(null);
    const next = raw === "" ? null : field.fieldtype === "Int" ? Math.trunc(Number(raw)) : Number(raw);
    if (next !== num && !(next !== null && Number.isNaN(next))) onChange(next);
  };

  if (isDisabled) {
    return (
      <div className="flex min-h-[38px] items-center justify-end rounded-lg bg-zinc-100 px-3 py-2 text-sm tabular-nums text-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-200">
        {display || <span className="text-zinc-400">—</span>}
      </div>
    );
  }

  return (
    <input
      id={inputId ?? field.fieldname}
      inputMode="decimal"
      value={editing ?? display}
      onFocus={() => setEditing(num == null ? "" : String(num))}
      onChange={(e) => setEditing(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(null);
      }}
      placeholder={String(field.placeholder ?? "")}
      aria-label={field.label || field.fieldname}
      aria-invalid={!!error}
      className={[
        "w-full rounded-lg border bg-white px-3 py-2 text-right text-sm tabular-nums text-zinc-900 transition-colors focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100",
        error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700",
      ].join(" ")}
    />
  );
}
