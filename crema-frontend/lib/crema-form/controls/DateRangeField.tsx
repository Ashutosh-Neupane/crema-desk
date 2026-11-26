"use client";

/**
 * Date Range (Desk: form/controls/date_range.js): the value is [from, to] in system format (YYYY-MM-DD); a stored
 * "from,to" string is read too (parse), as is Crema's old { from, to }. Set once both dates are picked; clearing
 * both clears it.
 */
import { useState } from "react";
import DatePicker from "@/components/form/DatePicker";
import type { FieldControlProps } from "./index";

function parseDateRange(value: unknown): [string, string] {
  let v: unknown = value;
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        v = JSON.parse(t);
      } catch {
        v = t;
      }
    }
  }
  if (Array.isArray(v)) return [String(v[0] ?? ""), String(v[1] ?? v[0] ?? "")];
  if (typeof v === "string" && v) {
    const [a, b] = v.split(",").map((s) => s.trim());
    return [a, b ?? a];
  }
  if (v && typeof v === "object") {
    const r = v as Record<string, unknown>;
    return [String(r.from ?? ""), String(r.to ?? "")];
  }
  return ["", ""];
}

export default function DateRangeField({ field, value, onChange, disabled }: FieldControlProps) {
  const stored = parseDateRange(value);
  const [draft, setDraft] = useState<[string, string] | null>(null);
  const [from, to] = draft ?? stored;
  const readOnly = disabled || !!field.read_only;
  const label = field.label || field.fieldname;

  const set = (next: [string, string]) => {
    if (next[0] && next[1]) {
      setDraft(null);
      const ordered: [string, string] = next[0] <= next[1] ? next : [next[1], next[0]];
      if (ordered[0] !== stored[0] || ordered[1] !== stored[1]) onChange(ordered);
    } else if (!next[0] && !next[1]) {
      setDraft(null);
      if (stored[0] || stored[1]) onChange(null);
    } else setDraft(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-fieldname={field.fieldname}>
      <div className="w-40">
        <DatePicker ariaLabel={`${label} from`} value={from || null} onChange={(v) => set([v ?? "", to])} disabled={readOnly} />
      </div>
      <span className="text-xs text-zinc-500">to</span>
      <div className="w-40">
        <DatePicker ariaLabel={`${label} to`} value={to || null} onChange={(v) => set([from, v ?? ""])} disabled={readOnly} />
      </div>
    </div>
  );
}
