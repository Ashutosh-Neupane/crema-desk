"use client";

import DatePicker from "@/components/form/DatePicker";
import type { FieldControlProps } from "./index";

/** Date — shadcn calendar popover; ISO value, site date format on screen */
export default function DateField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  return (
    <DatePicker
      id={inputId ?? field.fieldname}
      value={typeof value === "string" ? value : null}
      onChange={(v) => onChange(v)}
      disabled={disabled || !!field.read_only}
      error={!!error}
      ariaLabel={field.label ?? field.fieldname}
    />
  );
}
