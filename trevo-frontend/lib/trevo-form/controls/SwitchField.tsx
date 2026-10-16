"use client";

import type { FieldControlProps } from "@/lib/trevo-form/controls";

export default function SwitchField({ field, value, onChange, disabled }: FieldControlProps) {
  const checked = value === true || value === 1 || value === "1";

  return (
    <div className="flex flex-col gap-1.5">
      {field.label && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {field.label}
          {field.reqd && <span aria-hidden="true" className="ml-1 text-red-500">*</span>}
        </span>
      )}
      <button aria-label={field.label || field.fieldname}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(checked ? 0 : 1)}
        disabled={disabled || !!field.read_only}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-zinc-900/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
