"use client";

/** One query report filter (Desk: query_report.js setup_filters → frappe.ui.form.make_control per fieldtype). */
import LinkInput from "@/components/list/LinkInput";
import DatePicker from "@/components/form/DatePicker";
import TimePicker from "@/components/form/TimePicker";
import MultiSelectFilter from "./MultiSelectFilter";
import { selectOptions, type FilterValues, type ReportFilter } from "./queryReportTypes";

interface ControlProps {
  id: string;
  f: ReportFilter;
  label: string;
  value: unknown;
  values: FilterValues;
  onChange: (v: unknown) => void;
}

const inputCls = "h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900";
const linkCls = "[&_input]:h-8 [&_input]:w-full";
const str = (v: unknown) => String(v ?? "");

/** the filter's get_query, guarded: a throwing report script just means no extra filters */
function filterQuery(f: ReportFilter) {
  if (!f.get_query) return undefined;
  return () => {
    try {
      return f.get_query?.() as { filters?: unknown; query?: string } | undefined;
    } catch {
      return undefined;
    }
  };
}

function LinkControl({ id, f, label, value, onChange }: ControlProps) {
  return (
    <div>
      <LinkInput id={id} doctype={str(f.options)} value={str(value)} onChange={(v) => onChange(v)} placeholder={label} getQuery={filterQuery(f)} className={linkCls} />
    </div>
  );
}

function DynamicLinkControl({ id, f, label, value, values, onChange }: ControlProps) {
  const dt = str(values[str(f.options)]);
  if (!dt) return <input id={id} disabled className={inputCls} placeholder={`Select ${f.options} first`} />;
  return <LinkInput id={id} doctype={dt} value={str(value)} onChange={(v) => onChange(v)} placeholder={label} className={linkCls} />;
}

function DateControl({ id, label, value, onChange }: ControlProps) {
  return <DatePicker id={id} compact value={(value as string) ?? ""} onChange={(v) => onChange(v ?? "")} ariaLabel={label} />;
}

function TimeControl({ id, label, value, onChange }: ControlProps) {
  return <TimePicker id={id} compact value={(value as string) ?? ""} onChange={(v) => onChange(v ?? "")} ariaLabel={label} />;
}

function DateRangeControl({ id, label, value, onChange }: ControlProps) {
  const [from = "", to = ""] = Array.isArray(value) ? (value as string[]) : ["", ""];
  return (
    <div className="flex gap-1">
      <DatePicker id={id} compact value={from} onChange={(v) => onChange([v ?? "", to])} ariaLabel={`${label} from`} />
      <DatePicker compact value={to} onChange={(v) => onChange([from, v ?? ""])} ariaLabel={`${label} to`} />
    </div>
  );
}

function SelectControl({ id, f, value, onChange }: ControlProps) {
  return (
    <select id={id} value={str(value)} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {selectOptions(f.options).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function AutocompleteControl({ id, f, label, value, onChange }: ControlProps) {
  return (
    <>
      <input id={id} list={`${id}-options`} value={str(value)} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={label} />
      <datalist id={`${id}-options`}>
        {selectOptions(f.options).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </datalist>
    </>
  );
}

function MultiSelectControl({ id, f, value, onChange }: ControlProps) {
  return <MultiSelectFilter id={id} f={f} value={value} onChange={onChange} />;
}

function NumberControl({ id, value, onChange }: ControlProps) {
  return <input id={id} type="number" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />;
}

function TextControl({ id, label, value, onChange }: ControlProps) {
  return <input id={id} value={str(value)} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={label} />;
}

const CONTROLS: Record<string, { Control: (p: ControlProps) => React.ReactNode; wide?: boolean }> = {
  Link: { Control: LinkControl },
  "Dynamic Link": { Control: DynamicLinkControl },
  Date: { Control: DateControl },
  Time: { Control: TimeControl },
  DateRange: { Control: DateRangeControl, wide: true },
  Select: { Control: SelectControl },
  Autocomplete: { Control: AutocompleteControl },
  MultiSelectList: { Control: MultiSelectControl, wide: true },
  MultiSelect: { Control: MultiSelectControl, wide: true },
  Int: { Control: NumberControl },
  Float: { Control: NumberControl },
  Currency: { Control: NumberControl },
  Percent: { Control: NumberControl },
};

export default function FilterControl({ f, value, values, onChange }: { f: ReportFilter; value: unknown; values: FilterValues; onChange: (v: unknown) => void }) {
  const label = String(f.label ?? f.fieldname);
  const id = `qr-filter-${f.fieldname}`;
  if (f.fieldtype === "Check") {
    return (
      <label className="flex h-8 items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={!!Number(value)} onChange={(e) => onChange(e.target.checked ? 1 : 0)} />
        {label}
      </label>
    );
  }
  const { Control, wide } = CONTROLS[f.fieldtype] ?? { Control: TextControl };
  return (
    <div className={wide ? "min-w-56" : "w-44"}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
        {f.reqd ? (
          <span className="text-red-500" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      <Control id={id} f={f} label={label} value={value} values={values} onChange={onChange} />
    </div>
  );
}
