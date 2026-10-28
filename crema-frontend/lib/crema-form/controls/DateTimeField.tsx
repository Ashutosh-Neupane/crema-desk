"use client";

/**
 * Datetime — Frappe stores "yyyy-mm-dd HH:mm:ss" in the system time zone; Desk's control shows it in the
 * user's time zone (User.time_zone) and converts back on input (frappe.datetime.convert_to_user_tz /
 * convert_to_system_tz).
 */
import DatePicker from "@/components/form/DatePicker";
import TimePicker from "@/components/form/TimePicker";
import { convertToSystemTz, convertToUserTz } from "@/lib/frappe/format";
import type { FieldControlProps } from "./index";

export default function DateTimeField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const s = typeof value === "string" && value.length > 10 ? convertToUserTz(value) : typeof value === "string" ? value : "";
  const date = s.slice(0, 10);
  const time = s.length > 10 ? s.slice(11, 19) : "";
  const isDisabled = disabled || !!field.read_only;
  const emit = (d: string | null, t: string) => onChange(d ? convertToSystemTz(`${d} ${t || "00:00:00"}`) : null);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,8rem)] gap-2">
      <DatePicker id={inputId ?? field.fieldname} value={date || null} onChange={(d) => emit(d, time)} disabled={isDisabled} error={!!error} ariaLabel={field.label ?? field.fieldname} />
      <TimePicker value={time || null} onChange={(t) => emit(date, t ?? "")} disabled={isDisabled || !date} error={!!error} ariaLabel={`${field.label ?? field.fieldname} time`} />
    </div>
  );
}
