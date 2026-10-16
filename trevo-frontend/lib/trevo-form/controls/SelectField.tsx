"use client";

import type { FieldControlProps } from "./index";

export default function SelectField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const options = String(field.options ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const selected = typeof value === "string" ? value : "";

  return (
    <select
      id={inputId ?? field.fieldname}
      value={selected}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || !!field.read_only}
      className={[
        "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
        error
          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
          : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
        "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
        "focus:outline-none focus:ring-2",
        (disabled || !!field.read_only) && "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed",
      ].join(" ")}
    >
      <option value="">{field.reqd ? "Select..." : "--"}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
