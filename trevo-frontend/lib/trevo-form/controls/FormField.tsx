"use client";

import { useId, useState } from "react";
import type { FieldControlProps } from "./index";
import { getDataFieldError } from "../validators";

/** Text-like fieldtypes that Frappe renders as multi-line text areas */
const TEXTAREA_TYPES = new Set(["Text", "Small Text", "Long Text"]);

/** Data fields whose `options` make Desk validate the typed value */
const VALIDATED_DATA_OPTIONS = new Set(["Email", "Phone", "URL", "Name"]);

/** Native input type for a Data field, following its `options` */
function dataInputType(option: string): string {
  switch (option) {
    case "Email":
      return "email";
    case "Phone":
      return "tel";
    case "URL":
      return "url";
    default:
      return "text";
  }
}

/**
 * Default text input — fallback for all field types without a specialized control.
 * Supports text, data, password, email, url, phone, etc.
 */
export default function FormField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const id = inputId ?? field.fieldname;
  const messageId = `${useId()}-${field.fieldname}-invalid`;
  const dataOption = field.fieldtype === "Data" && typeof field.options === "string" ? field.options : "";
  const validated = VALIDATED_DATA_OPTIONS.has(dataOption);
  // Desk keeps the typed value and marks it invalid. The message is tied to the exact value it was
  // computed for, so a value that changes from outside (or is edited again) never shows a stale message.
  const [checked, setChecked] = useState<{ value: string; message: string | null } | null>(null);
  const current = String(value ?? "");
  const invalidMessage = validated && checked && checked.value === current ? checked.message : null;
  const shownError = error ?? invalidMessage;

  const sharedClassName = [
    "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
    shownError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
      : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
    "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
    "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
    "focus:outline-none focus:ring-2",
    (disabled || !!field.read_only) && "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed",
  ].join(" ");

  const runCheck = (next: string) => {
    if (!validated) return;
    setChecked({ value: next, message: getDataFieldError(next, dataOption) });
  };

  if (TEXTAREA_TYPES.has(field.fieldtype)) {
    return (
      <textarea
        id={id}
        value={current}
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

  const inputType = field.fieldtype === "Password" ? "password" : dataInputType(dataOption);

  return (
    <>
      <input
        id={id}
        type={inputType}
        // Desk accepts several comma-separated addresses in an Email field
        multiple={dataOption === "Email" || undefined}
        value={current}
        onChange={(e) => {
          onChange(e.target.value || null);
          runCheck(e.target.value);
        }}
        onBlur={(e) => runCheck(e.target.value)}
        readOnly={!!field.read_only}
        disabled={disabled || !!field.read_only}
        placeholder={String(field.placeholder ?? "")}
        maxLength={field.length ? Number(field.length) : undefined}
        aria-invalid={validated ? !!invalidMessage : undefined}
        aria-describedby={invalidMessage ? messageId : undefined}
        className={sharedClassName}
      />
      {/* Field-level errors from the form are rendered by FieldControl; this covers Desk's option checks */}
      {invalidMessage && !error && (
        <span id={messageId} className="text-xs text-red-600 dark:text-red-400">
          {invalidMessage}
        </span>
      )}
    </>
  );
}
