"use client";

import type { FieldControlProps } from "./index";

/**
 * Button field — a click fires the form event named after the field (Desk: frm.script_manager.trigger(fieldname)),
 * which app scripts handle, e.g. User.generate_keys.
 */
export default function ButtonField({ field, inputId, disabled, onClick }: FieldControlProps) {
  return (
    <button
      type="button"
      id={inputId ?? field.fieldname}
      disabled={disabled}
      onClick={onClick}
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
