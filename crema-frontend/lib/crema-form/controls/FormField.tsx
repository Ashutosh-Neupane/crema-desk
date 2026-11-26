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

function fieldClass(shownError: unknown, locked: boolean) {
  return [
    "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
    shownError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
      : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
    "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
    "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
    "focus:outline-none focus:ring-2",
    locked && "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed",
  ].join(" ");
}

const maxLengthOf = (field: FieldControlProps["field"]) => (field.length ? Number(field.length) : undefined);

/**
 * Text / Small Text / Long Text (text.js): Text and Long Text 300px, Small Text 150px, both capped by df.max_height;
 * read-only shows the text in a box that keeps line breaks and indentation, also capped by max_height.
 */
function TextAreaField({ field, id, current, locked, compact, onChange, className }: {
  field: FieldControlProps["field"];
  id: string;
  current: string;
  locked: boolean;
  compact?: boolean;
  onChange: FieldControlProps["onChange"];
  className: string;
}) {
  const maxHeight = (field as { max_height?: string }).max_height || undefined;
  if (locked) {
    return (
      <div
        id={id}
        data-text-display
        role="document"
        aria-label={field.label || field.fieldname}
        style={{ maxHeight }}
        className={`whitespace-pre-wrap break-words rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 ${maxHeight ? "overflow-auto" : ""}`}
      >
        {current}
      </div>
    );
  }
  return (
    <textarea
      id={id}
      value={current}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={String(field.placeholder ?? "")}
      maxLength={maxLengthOf(field)}
      rows={compact ? 3 : undefined}
      style={compact ? undefined : { height: field.fieldtype === "Small Text" ? 150 : 300, maxHeight }}
      className={`${className} resize-y`}
    />
  );
}

/**
 * Desk's option checks for Data fields (Email, Phone, URL, Name). Desk keeps the typed value and marks it invalid.
 * The message is tied to the exact value it was computed for, so a value that changes from outside (or is edited
 * again) never shows a stale message.
 */
function useDataCheck(dataOption: string, current: string) {
  const validated = VALIDATED_DATA_OPTIONS.has(dataOption);
  const [checked, setChecked] = useState<{ value: string; message: string | null } | null>(null);
  const invalidMessage = validated && checked && checked.value === current ? checked.message : null;
  const runCheck = (next: string) => {
    if (validated) setChecked({ value: next, message: getDataFieldError(next, dataOption) });
  };
  return { validated, invalidMessage, runCheck };
}

/**
 * Default text input — fallback for all field types without a specialized control.
 * Supports text, data, password, email, url, phone, etc.
 */
export default function FormField({ field, inputId, value, onChange, disabled, error, compact }: FieldControlProps) {
  const id = inputId ?? field.fieldname;
  const messageId = `${useId()}-${field.fieldname}-invalid`;
  const dataOption = field.fieldtype === "Data" && typeof field.options === "string" ? field.options : "";
  const current = String(value ?? "");
  const { validated, invalidMessage, runCheck } = useDataCheck(dataOption, current);
  const locked = !!disabled || !!field.read_only;
  const className = fieldClass(error ?? invalidMessage, locked);

  if (TEXTAREA_TYPES.has(field.fieldtype)) {
    return <TextAreaField field={field} id={id} current={current} locked={locked} compact={compact} onChange={onChange} className={className} />;
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
        disabled={locked}
        placeholder={String(field.placeholder ?? "")}
        maxLength={maxLengthOf(field)}
        aria-invalid={validated ? !!invalidMessage : undefined}
        aria-describedby={invalidMessage ? messageId : undefined}
        className={className}
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
