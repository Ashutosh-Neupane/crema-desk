"use client";

/** Inline cell editor of the report view (Desk: report_view.js get_editing_object → frappe.ui.form.make_control). */
import { useCallback, useState } from "react";
import LinkInput from "@/components/list/LinkInput";
import DatePicker from "@/components/form/DatePicker";
import TimePicker from "@/components/form/TimePicker";
import type { DocField } from "@/lib/frappe/types";
import { NUMERIC } from "./shared";

export default function CellEditor({ df, value, onCommit, onCancel }: { df: DocField; value: unknown; onCommit: (v: unknown) => void; onCancel: () => void }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  // the editor opens on the user's Enter / double-click, so it takes focus at once (like Desk's grid editor)
  const focusOnMount = useCallback((el: HTMLElement | null) => el?.focus(), []);
  const cls = "h-8 w-full bg-white px-2 text-sm outline-none dark:bg-zinc-900";
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
    if (e.key === "Enter") onCommit(NUMERIC.has(df.fieldtype) ? Number(v) || 0 : v);
  };
  switch (df.fieldtype) {
    case "Check":
      return (
        <label className="flex h-8 items-center justify-center">
          <input ref={focusOnMount} type="checkbox" aria-label={String(df.label)} defaultChecked={!!Number(value)} onChange={(e) => onCommit(e.target.checked ? 1 : 0)} onBlur={onCancel} onKeyDown={keys} />
        </label>
      );
    case "Select":
      return (
        <select ref={focusOnMount} aria-label={String(df.label)} value={v} className={cls} onChange={(e) => onCommit(e.target.value)} onBlur={onCancel} onKeyDown={keys}>
          {String(df.options ?? "").split("\n").map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "Link":
      return <LinkInput doctype={String(df.options)} value={v} autoFocus onChange={(nv) => onCommit(nv)} className="[&_input]:h-8 [&_input]:w-full [&_input]:rounded-none [&_input]:border-0" />;
    case "Date":
      return <DatePicker compact value={v} ariaLabel={String(df.label)} onChange={(nv) => onCommit(nv ?? "")} />;
    case "Time":
      return <TimePicker compact value={v} ariaLabel={String(df.label)} onChange={(nv) => onCommit(nv ?? "")} />;
    default:
      return (
        <input
          ref={focusOnMount}
          aria-label={String(df.label)}
          type={NUMERIC.has(df.fieldtype) ? "number" : "text"}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={keys}
          onBlur={() => onCommit(NUMERIC.has(df.fieldtype) ? Number(v) || 0 : v)}
          className={`${cls} ${NUMERIC.has(df.fieldtype) ? "text-right" : ""}`}
        />
      );
  }
}
