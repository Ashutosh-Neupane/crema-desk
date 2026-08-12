"use client";

import type { FieldControlProps } from "./index";

/**
 * Percent input — numeric field rendered with a trailing % sign,
 * matching Frappe's Percent fieldtype behavior.
 */
export default function PercentField({ field, value, onChange, disabled, error }: FieldControlProps) {
  const readOnly = disabled || !!field.read_only;
  return (
    <div className="relative">
      <input
        id={field.fieldname}
        type="number"
        value={typeof value === "number" ? value : String(value ?? "")}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        readOnly={!!field.read_only}
        disabled={disabled || !!field.read_only}
        step="any"
        placeholder={String(field.placeholder ?? "")}
        className={[
          "w-full rounded-lg border px-3 py-2 pr-8 text-sm transition-colors",
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
            : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
          "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
          "focus:outline-none focus:ring-2",
          readOnly && "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed",
        ].join(" ")}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
        %
      </span>
    </div>
  );
}
