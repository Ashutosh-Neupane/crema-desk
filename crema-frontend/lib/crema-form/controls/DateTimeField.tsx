"use client";

/**
 * Datetime — Frappe stores "yyyy-mm-dd HH:mm:ss" in the system time zone; Desk's control shows it in the
 * user's time zone (User.time_zone) and converts back on input (frappe.datetime.convert_to_user_tz /
 * convert_to_system_tz).
 */
import DatePicker from "@/components/form/DatePicker";
import { convertToSystemTz, convertToUserTz } from "@/lib/frappe/format";
import type { FieldControlProps } from "./index";

export default function DateTimeField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const s = typeof value === "string" && value.length > 10 ? convertToUserTz(value) : typeof value === "string" ? value : "";
  const date = s.slice(0, 10);
  const time = s.length > 10 ? s.slice(11, 16) : "";
  const isDisabled = disabled || !!field.read_only;
  const emit = (d: string | null, t: string) => onChange(d ? convertToSystemTz(`${d} ${t || "00:00"}:00`) : null);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
      <DatePicker id={inputId ?? field.fieldname} value={date || null} onChange={(d) => emit(d, time)} disabled={isDisabled} error={!!error} ariaLabel={field.label ?? field.fieldname} />
      <input
        type="time"
        value={time}
        disabled={isDisabled || !date}
        aria-label={`${field.label ?? field.fieldname} time`}
        onChange={(e) => emit(date, e.target.value)}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-800"
      />
    </div>
  );
}
