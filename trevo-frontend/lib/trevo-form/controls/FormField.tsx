"use client";

import type { FieldControlProps } from "./index";

/** Text-like fieldtypes that Frappe renders as multi-line text areas */
const TEXTAREA_TYPES = new Set(["Text", "Small Text", "Long Text"]);

/**
 * Default text input — fallback for all field types without a specialized control.
 * Supports text, data, password, email, url, phone, etc.
 */
export default function FormField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const sharedClassName = [
    "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
    error
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
      : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
    "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
    "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
    "focus:outline-none focus:ring-2",
    (disabled || !!field.read_only) && "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed",
  ].join(" ");

  if (TEXTAREA_TYPES.has(field.fieldtype)) {
    return (
      <textarea
        id={inputId ?? field.fieldname}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value || null)}
        readOnly={!!field.read_only}
        disabled={disabled || !!field.read_only}
        placeholder={String(field.placeholder ?? "")}
        maxLength={field.length ? Number(field.length) : undefined}
        rows={field.fieldtype === "Small Text" ? 3 : 5}
        className={`${sharedClassName} resize-y`}
      />
    );
  }

  return (
    <input
      id={inputId ?? field.fieldname}
      type={field.fieldtype === "Password" ? "password" : "text"}
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value || null)}
      readOnly={!!field.read_only}
      disabled={disabled || !!field.read_only}
      placeholder={String(field.placeholder ?? "")}
      maxLength={field.length ? Number(field.length) : undefined}
      className={sharedClassName}
    />
  );
}
