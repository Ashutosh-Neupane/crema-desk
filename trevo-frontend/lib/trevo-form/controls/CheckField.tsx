"use client";

import type { FieldControlProps } from "./index";

/** Frappe Check: stored as 0/1 (sometimes "1"/true from scripts). Rendered as a checkbox with its label, like Desk. */
export default function CheckField({ field, value, onChange, disabled }: FieldControlProps) {
  const checked = value === true || value === "1" || Number(value) === 1;
  const isDisabled = disabled || !!field.read_only;

  return (
    <label className={`flex items-center gap-2 py-1 ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        disabled={isDisabled}
        className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
      />
      <span className="text-sm text-zinc-700 dark:text-zinc-300">
        {field.label || field.fieldname}
        {!!field.reqd && <span aria-hidden="true" className="ml-1 text-red-500">*</span>}
      </span>
    </label>
  );
}
