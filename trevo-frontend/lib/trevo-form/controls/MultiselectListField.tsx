"use client";

import { useCallback } from "react";
import { FieldControlProps } from "@/lib/trevo-form/controls";

export default function MultiselectListField({ field, value, onChange, disabled }: FieldControlProps) {
  const options = (field.options ?? "").split("\n").filter(Boolean);
  const selected = Array.isArray(value) ? value : [];

  const toggle = useCallback(
    (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt];
      onChange(next.length ? next : "");
    },
    [selected, onChange],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {field.label && (
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {field.label}
          {field.reqd && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              disabled={disabled || !!field.read_only}
              className="rounded border-zinc-300"
            />
            <span className="text-zinc-700 dark:text-zinc-300">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
