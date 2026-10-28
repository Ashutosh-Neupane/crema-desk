"use client";

import { useMemo } from "react";
import type { FieldControlProps } from "./index";
import { getFieldOptions } from "@/lib/crema-form/meta/parseDoctypeMeta";

export default function TableMultiSelectField({ field, value, onChange, disabled }: FieldControlProps) {
  const options = useMemo(() => getFieldOptions(field as Parameters<typeof getFieldOptions>[0]), [field]);
  const selected = useMemo(() => {
    if (!value) return [] as string[];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }, [value]);
  const selectedSet = new Set<unknown>(selected);

  const toggle = (opt: string) => {
    const next = selectedSet.has(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onChange(next);
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((opt) => (
        <label
          key={opt}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${
            selectedSet.has(opt)
              ? "border-zinc-900 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-800"
              : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
          } ${disabled || field.read_only ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="checkbox"
            checked={selectedSet.has(opt)}
            onChange={() => !disabled && !field.read_only && toggle(opt)}
            disabled={disabled || !!field.read_only}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
          />
          <span className="text-zinc-700 dark:text-zinc-300">{opt}</span>
        </label>
      ))}
    </div>
  );
}
