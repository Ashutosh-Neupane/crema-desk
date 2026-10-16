"use client";

import type { FieldControlProps } from "./index";

export default function CurrencyField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
      <input
        id={inputId ?? field.fieldname}
        type="number"
        value={typeof value === "number" ? value : Number(value ?? 0)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        readOnly={!!field.read_only}
        disabled={disabled || !!field.read_only}
        step="any"
        placeholder={String(field.placeholder ?? "0.00")}
        className={[
          "w-full rounded-lg border pl-7 pr-3 py-2 text-sm transition-colors",
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
            : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
          "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
          "focus:outline-none focus:ring-2",
          (disabled || !!field.read_only) && "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed",
        ].join(" ")}
      />
    </div>
  );
}
