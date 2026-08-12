"use client";

import type { FieldControlProps } from "./index";

/**
 * Button field — Frappe renders these as buttons whose click handlers are
 * bound by client scripts. The script bridge can attach behavior via the
 * standard `frm` API; without a bound handler the button stays inert.
 */
export default function ButtonField({ field, disabled }: FieldControlProps) {
  return (
    <button
      type="button"
      id={field.fieldname}
      disabled={disabled}
      className={[
        "rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors",
        "hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
        disabled && "cursor-not-allowed opacity-50",
      ].join(" ")}
    >
      {field.label || field.fieldname}
    </button>
  );
}
