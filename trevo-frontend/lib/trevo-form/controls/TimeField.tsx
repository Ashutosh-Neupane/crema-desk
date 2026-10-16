"use client";

import type { FieldControlProps } from "./index";

/**
 * Time input — Frappe stores Time fields as "HH:mm:ss[.ffffff]".
 * The native time input uses "HH:mm[:ss]", so we trim fractional seconds
 * on the way in and keep the stored value Frappe-compatible.
 */
export default function TimeField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  // "14:30:00.000000" → "14:30:00"; "14:30" → "14:30:00" (native input with step=1 needs seconds)
  const raw = String(value ?? "");
  let normalized = "";
  if (/^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)) {
    normalized = raw.replace(/\.\d+$/, "");
  } else if (/^\d{2}:\d{2}$/.test(raw)) {
    normalized = `${raw}:00`;
  }

  return (
    <input
      id={inputId ?? field.fieldname}
      type="time"
      step={1}
      value={normalized}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) {
          onChange(null);
        } else {
          // Pad "HH:mm" → "HH:mm:00" to match Frappe's Time format
          onChange(v.length === 5 ? `${v}:00` : v);
        }
      }}
      readOnly={!!field.read_only}
      disabled={disabled || !!field.read_only}
      placeholder={String(field.placeholder ?? "")}
      className={[
        "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
        error
          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
          : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
        "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
        "focus:outline-none focus:ring-2",
        (disabled || !!field.read_only) && "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed",
      ].join(" ")}
    />
  );
}
