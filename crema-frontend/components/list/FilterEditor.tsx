"use client";

/** Desk filter editor: field · operator · value → one filter tuple (frappe/public/js/frappe/ui/filters/filter.js). */
import { useMemo, useState } from "react";
import type { Filter } from "@/lib/list/api";
import LinkInput from "@/components/list/LinkInput";
import { OPERATORS, filterableFields } from "@/components/list/filterModel";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

const selectCls = "h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);

/** the typed value as the filter tuple stores it (like → %v%, is → set / not set, Check → 1 / 0) */
function toFilterValue(op: string, value: string, df: DocField | undefined): unknown {
  if (df?.fieldtype === "Check") return value === "1" ? 1 : 0;
  if (op === "is") return value || "set";
  if (op === "like" || op === "not like") return value.includes("%") ? value : `%${value}%`;
  return value;
}

function inputType(fieldtype: string | undefined) {
  if (fieldtype === "Date") return "date";
  return NUMERIC.has(fieldtype ?? "") ? "number" : "text";
}

function FilterValueInput({ op, df, value, setValue, onEnter }: { op: string; df: DocField | undefined; value: string; setValue: (v: string) => void; onEnter: () => void }) {
  if (op === "is") {
    return (
      <select aria-label="Filter value" value={value || "set"} onChange={(e) => setValue(e.target.value)} className={selectCls}>
        <option value="set">set</option>
        <option value="not set">not set</option>
      </select>
    );
  }
  if (df?.fieldtype === "Link") return <LinkInput doctype={String(df.options)} value={value} onChange={setValue} autoFocus />;
  if (df?.fieldtype === "Select") {
    return (
      <select aria-label="Filter value" value={value} onChange={(e) => setValue(e.target.value)} className={selectCls}>
        {String(df.options ?? "")
          .split("\n")
          .map((o) => (
            <option key={o} value={o}>
              {o || "(empty)"}
            </option>
          ))}
      </select>
    );
  }
  if (df?.fieldtype === "Check") {
    return (
      <select aria-label="Filter value" value={value || "1"} onChange={(e) => setValue(e.target.value)} className={selectCls}>
        <option value="1">Yes</option>
        <option value="0">No</option>
      </select>
    );
  }
  return (
    <input
      type={inputType(df?.fieldtype)}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      placeholder="Value"
      className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    />
  );
}

export default function FilterEditor({ meta, onAdd }: { meta: DocTypeMeta; onAdd: (f: Filter) => void }) {
  const fields = useMemo(() => [{ fieldname: "name", label: "ID", fieldtype: "Data" } as DocField, ...filterableFields(meta), { fieldname: "owner", label: "Created By", fieldtype: "Link", options: "User" } as DocField, { fieldname: "modified", label: "Last Updated On", fieldtype: "Datetime" } as DocField], [meta]);
  const [fieldname, setFieldname] = useState(() => fields[1]?.fieldname ?? "name");
  const [op, setOp] = useState("=");
  const [value, setValue] = useState("");
  const df = fields.find((f) => f.fieldname === fieldname);

  const add = () => {
    onAdd([meta.name, fieldname, op, toFilterValue(op, value, df)]);
    setValue("");
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select
          aria-label="Filter field"
          value={fieldname}
          onChange={(e) => {
            setFieldname(e.target.value);
            setValue("");
          }}
          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {fields.map((f) => (
            <option key={f.fieldname} value={f.fieldname}>
              {f.label || f.fieldname}
            </option>
          ))}
        </select>
        <select aria-label="Filter operator" value={op} onChange={(e) => setOp(e.target.value)} className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          {OPERATORS.map((o) => (
            <option key={o.op} value={o.op}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <FilterValueInput op={op} df={df} value={value} setValue={setValue} onEnter={add} />
      <button type="button" onClick={add} className="w-full rounded-md bg-zinc-900 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
        Add filter
      </button>
    </div>
  );
}
