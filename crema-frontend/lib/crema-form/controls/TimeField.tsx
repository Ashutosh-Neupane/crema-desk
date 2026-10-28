"use client";

import TimePicker from "@/components/form/TimePicker";
import type { FieldControlProps } from "./index";

/** Time: Frappe stores "HH:mm:ss[.ffffff]"; TimePicker shows the site's time_format and emits "HH:mm:ss" */
export default function TimeField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  return (
    <TimePicker
      id={inputId ?? field.fieldname}
      value={typeof value === "string" ? value : null}
      onChange={onChange}
      disabled={disabled || !!field.read_only}
      error={!!error}
      ariaLabel={field.label || field.fieldname}
    />
  );
}
