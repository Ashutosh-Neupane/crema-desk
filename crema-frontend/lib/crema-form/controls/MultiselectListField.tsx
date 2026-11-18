"use client";

/**
 * MultiSelect List (Desk: form/controls/multiselect_list.js): a dropdown showing the placeholder, the one picked label
 * or "N values selected"; inside, a search box (passed to `get_data(txt)`), the options with a tick, Select All and
 * Clear All. The value is an array of values.
 */
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { FieldControlProps } from "./index";
import { useMultiOptions } from "./multiOptions";
import { multiValues } from "./MultiselectField";

export default function MultiselectListField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const selected = multiValues(value);
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const options = useMultiOptions(field, txt);
  const box = useRef<HTMLDivElement>(null);
  const readOnly = disabled || !!field.read_only;
  const label = field.label || field.fieldname;
  // with get_data the search is the server's; otherwise filter here
  const hasGetData = typeof (field as { get_data?: unknown }).get_data === "function";
  const shown = hasGetData || !txt ? options : options.filter((o) => `${o.label}${o.value}`.toLowerCase().includes(txt.toLowerCase()));
  const status = selected.length === 0 ? "" : selected.length === 1 ? (options.find((o) => o.value === selected[0])?.label ?? selected[0]) : `${selected.length} values selected`;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const picked = new Set(selected);
  const set = (vals: string[]) => onChange(vals);
  const toggle = (v: string) => set(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  return (
    <div ref={box} className="relative" data-fieldname={field.fieldname}>
      <button
        id={inputId ?? field.fieldname}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"} ${readOnly ? "bg-zinc-100 dark:bg-zinc-800/70" : "bg-white dark:bg-zinc-900"}`}
      >
        <span data-status className={`truncate ${status ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>{status || String(field.placeholder ?? "")}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="p-2">
            <input
              type="text"
              aria-label={`Search ${label}`}
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <ul role="listbox" aria-multiselectable="true" aria-label={`${label} options`} className="max-h-56 overflow-y-auto">
            {shown.map((o) => {
              const on = picked.has(o.value);
              return (
                <li key={o.value} role="option" aria-selected={on}>
                  <button type="button" onClick={() => toggle(o.value)} className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{o.label}</span>
                      {o.description && <span className="block text-xs text-zinc-500">{o.description}</span>}
                    </span>
                    {on && <Check className="h-4 w-4 text-zinc-700 dark:text-zinc-200" />}
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="px-3 py-2 text-sm text-zinc-500">No values to show</li>}
          </ul>
          <div className="flex justify-end gap-2 border-t border-zinc-100 p-2 dark:border-zinc-800">
            <button type="button" onClick={() => set([...new Set([...selected, ...shown.map((o) => o.value)])])} className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs dark:border-zinc-700">
              Select All
            </button>
            <button type="button" onClick={() => set([])} className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
