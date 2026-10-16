"use client";

import { useCallback, useState, useMemo } from "react";
import { X } from "lucide-react";
import type { FieldControlProps } from "@/lib/trevo-form/controls";

export default function MultiselectField({ field, value, onChange, disabled }: FieldControlProps) {
  const [open, setOpen] = useState(false);
  const options = (field.options ?? "").split("\n").filter(Boolean);
  const selected = useMemo(() => Array.isArray(value) ? value : [], [value]);
  const selectedSet = new Set<unknown>(selected);

  const toggle = useCallback(
    (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt];
      onChange(next.length ? next : "");
    },
    [selected, onChange],
  );

  const remove = useCallback(
    (opt: string) => {
      onChange(selected.filter((v) => v !== opt));
    },
    [selected, onChange],
  );

  return (
    <div className="flex flex-col gap-1.5 relative">
      {field.label && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {field.label}
          {field.reqd && <span aria-hidden="true" className="ml-1 text-red-500">*</span>}
        </span>
      )}
      <div
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        onClick={() => !disabled && !field.read_only && setOpen((o) => !o)}
      >
        <div className="flex flex-wrap gap-1">
          {selected.length === 0 && (
            <span className="text-sm text-zinc-400">{String(field.placeholder || "Select options...")}</span>
          )}
          {selected.map((opt) => (
            <span
              key={opt}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
            >
              {String(opt)}
              <button aria-label={`Remove ${String(opt)}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(opt);
                }}
                disabled={disabled || !!field.read_only}
                className="hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(opt)}
                onChange={() => toggle(opt)}
                disabled={disabled || !!field.read_only}
                className="rounded border-zinc-300"
              />
              <span className="text-zinc-700 dark:text-zinc-300">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
