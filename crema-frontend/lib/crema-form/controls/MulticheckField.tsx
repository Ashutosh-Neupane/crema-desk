"use client";

/**
 * MultiCheck (Desk: form/controls/multicheck.js): checkboxes for options ({ label, value, checked } items, a JSON list,
 * lines, or `get_data()`), sorted by label unless `sort_options` is false, laid out by `columns` ("15rem", 3, or
 * "15rem 5"), Select All / Unselect All with `select_all`. The value is the array of checked values; options marked
 * `checked` start checked.
 */
import { useEffect, useRef } from "react";
import type { FieldControlProps } from "./index";
import { useMultiOptions } from "./multiOptions";
import { multiValues } from "./multiOptions";

function gridColumns(columns: unknown): string | undefined {
  if (columns == null || columns === "") return undefined;
  const [a, b] = String(columns).trim().split(/\s+/);
  if (/^\d+$/.test(a)) return `repeat(${a}, minmax(0, 1fr))`;
  return b ? `repeat(auto-fill, minmax(max(${a}, calc(100% / ${b} - 1rem)), 1fr))` : `repeat(auto-fill, minmax(${a}, 1fr))`;
}

export default function MulticheckField({ field, value, onChange, disabled }: FieldControlProps) {
  const raw = useMultiOptions(field);
  const options = field.sort_options === 0 || (field as { sort_options?: unknown }).sort_options === false ? raw : [...raw].sort((a, b) => a.label.localeCompare(b.label));
  const readOnly = disabled || !!field.read_only;
  const selected = multiValues(value);
  // set_checked_options: options marked checked are the starting value
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || value != null || !raw.length) return;
    seeded.current = true;
    const start = raw.filter((o) => o.checked).map((o) => o.value);
    // Desk writes the checked options into the doc on load, so the parent must get them (not just render them)
    // react-doctor-disable-next-line no-pass-data-to-parent, no-pass-live-state-to-parent
    if (start.length) onChange(start);
  }, [raw, value, onChange]);

  const picked = new Set(selected);
  const toggle = (v: string, on: boolean) => onChange(on ? [...selected.filter((s) => s !== v), v] : selected.filter((s) => s !== v));
  const selectAll = (on: boolean) => onChange(on ? options.filter((o) => !o.disabled || picked.has(o.value)).map((o) => o.value) : options.filter((o) => o.disabled && picked.has(o.value)).map((o) => o.value));

  return (
    <div role="group" aria-label={field.label || field.fieldname} data-fieldname={field.fieldname} className="space-y-2">
      {!!field.select_all && !readOnly && (
        <div className="flex gap-2">
          <button type="button" onClick={() => selectAll(true)} className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs dark:border-zinc-700">
            Select All
          </button>
          <button type="button" onClick={() => selectAll(false)} className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs dark:border-zinc-700">
            Unselect All
          </button>
        </div>
      )}
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2" style={{ gridTemplateColumns: gridColumns(field.columns) }}>
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300" title={o.description}>
            <input type="checkbox" checked={picked.has(o.value)} disabled={readOnly || o.disabled} onChange={(e) => toggle(o.value, e.target.checked)} className="rounded border-zinc-300" />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
