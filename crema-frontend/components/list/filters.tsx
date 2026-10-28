"use client";

/** Shared Desk filter model for list-like views: filter editor, group-by counts, URL ⇄ filter tuples. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGroupByCount, type Filter } from "@/lib/list/api";
import LinkInput from "@/components/list/LinkInput";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

export const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Button", "Heading", "Image", "Table", "Table MultiSelect", "Attach Image", "Signature", "Code", "Text Editor", "HTML Editor", "Markdown Editor", "Password", "JSON", "Geolocation"]);
export const OPERATORS: Array<{ op: string; label: string }> = [
  { op: "=", label: "equals" },
  { op: "!=", label: "not equals" },
  { op: "like", label: "like" },
  { op: "not like", label: "not like" },
  { op: ">", label: ">" },
  { op: "<", label: "<" },
  { op: ">=", label: ">=" },
  { op: "<=", label: "<=" },
  { op: "is", label: "is" },
];
export const STD_FIELD_LABELS: Record<string, string> = { name: "ID", owner: "Created By", modified: "Last Updated On", creation: "Created On", docstatus: "Document Status", _assign: "Assigned To", modified_by: "Last Updated By" };

export function filterableFields(meta: DocTypeMeta): DocField[] {
  return (meta.fields ?? []).filter((f) => !NO_VALUE.has(f.fieldtype) && !f.hidden);
}

export function fieldLabel(meta: DocTypeMeta, fieldname: string): string {
  return STD_FIELD_LABELS[fieldname] ?? meta.fields?.find((f) => f.fieldname === fieldname)?.label ?? fieldname;
}

/** ?status=Draft&customer=X or ?filters=[[…]] → filter tuples */
export function filtersFromParams(doctype: string, params: URLSearchParams): Filter[] {
  const raw = params.get("filters");
  if (raw) {
    try {
      const arr = JSON.parse(raw) as unknown[][];
      // accept [field, op, value] as well as [doctype, field, op, value]
      if (Array.isArray(arr)) return arr.map((f) => (f.length === 3 ? [doctype, f[0], f[1], f[2]] : f) as Filter);
    } catch {
      /* ignore */
    }
  }
  const out: Filter[] = [];
  params.forEach((v, k) => {
    if (["filters", "view", "sort", "q", "new"].includes(k)) return;
    out.push([doctype, k, "=", v]);
  });
  return out;
}

export function describeValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v === null || v === undefined || v === "") return "empty";
  return String(v);
}

// ── Filter editor ──────────────────────────────────────────────────────────
export function FilterEditor({ meta, onAdd }: { meta: DocTypeMeta; onAdd: (f: Filter) => void }) {
  const fields = useMemo(() => [{ fieldname: "name", label: "ID", fieldtype: "Data" } as DocField, ...filterableFields(meta), { fieldname: "owner", label: "Created By", fieldtype: "Link", options: "User" } as DocField, { fieldname: "modified", label: "Last Updated On", fieldtype: "Datetime" } as DocField], [meta]);
  const [fieldname, setFieldname] = useState(fields[1]?.fieldname ?? "name");
  const [op, setOp] = useState("=");
  const [value, setValue] = useState("");
  const df = fields.find((f) => f.fieldname === fieldname);
  const selectOptions = df?.fieldtype === "Select" ? String(df.options ?? "").split("\n") : null;

  const add = () => {
    let v: unknown = value;
    if (op === "like" || op === "not like") v = value.includes("%") ? value : `%${value}%`;
    if (op === "is") v = value || "set";
    if (df?.fieldtype === "Check") v = value === "1" ? 1 : 0;
    onAdd([meta.name, fieldname, op, v]);
    setValue("");
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select aria-label="Filter field" value={fieldname} onChange={(e) => { setFieldname(e.target.value); setValue(""); }} className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          {fields.map((f) => <option key={f.fieldname} value={f.fieldname}>{f.label || f.fieldname}</option>)}
        </select>
        <select aria-label="Filter operator" value={op} onChange={(e) => setOp(e.target.value)} className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          {OPERATORS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
        </select>
      </div>
      {op === "is" ? (
        <select aria-label="Filter value" value={value || "set"} onChange={(e) => setValue(e.target.value)} className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          <option value="set">set</option>
          <option value="not set">not set</option>
        </select>
      ) : df?.fieldtype === "Link" ? (
        <LinkInput doctype={String(df.options)} value={value} onChange={setValue} autoFocus />
      ) : selectOptions ? (
        <select aria-label="Filter value" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          {selectOptions.map((o) => <option key={o} value={o}>{o || "(empty)"}</option>)}
        </select>
      ) : df?.fieldtype === "Check" ? (
        <select aria-label="Filter value" value={value || "1"} onChange={(e) => setValue(e.target.value)} className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          <option value="1">Yes</option>
          <option value="0">No</option>
        </select>
      ) : (
        <input
          type={df?.fieldtype === "Date" ? "date" : ["Int", "Float", "Currency", "Percent"].includes(df?.fieldtype ?? "") ? "number" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Value"
          className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      )}
      <button type="button" onClick={add} className="w-full rounded-md bg-zinc-900 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
        Add filter
      </button>
    </div>
  );
}

// ── Group-by counts ────────────────────────────────────────────────────────
export function GroupBy({ meta, filters, onPick }: { meta: DocTypeMeta; filters: Filter[]; onPick: (f: Filter) => void }) {
  const candidates = useMemo(
    () => [
      { fieldname: "assigned_to", label: "Assigned To" },
      { fieldname: "owner", label: "Created By" },
      ...(meta.fields ?? []).filter((f) => ["Select", "Link"].includes(f.fieldtype) && !f.hidden && f.fieldname !== "naming_series").map((f) => ({ fieldname: f.fieldname, label: f.label ?? f.fieldname })),
    ],
    [meta],
  );
  const [field, setField] = useState(candidates.find((c) => c.fieldname === "status")?.fieldname ?? candidates[2]?.fieldname ?? "owner");
  const { data, isLoading } = useQuery({
    queryKey: ["group-by", meta.name, field, filters],
    queryFn: () => fetchGroupByCount(meta.name, filters, field),
  });
  return (
    <div className="space-y-2">
      <select aria-label="Group by field" value={field} onChange={(e) => setField(e.target.value)} className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
        {candidates.map((c) => <option key={c.fieldname} value={c.fieldname}>{c.label}</option>)}
      </select>
      <ul className="max-h-72 overflow-auto">
        {isLoading && <li className="px-2 py-1.5 text-sm text-zinc-400">Loading…</li>}
        {data?.map((g) => (
          <li key={String(g.name)}>
            <button
              type="button"
              onClick={() => onPick(field === "assigned_to" ? [meta.name, "_assign", "like", `%${g.name}%`] : [meta.name, field, g.name == null ? "is" : "=", g.name ?? "not set"])}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{g.title || g.name || "Not set"}</span>
              <span className="rounded-full bg-zinc-100 px-1.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{g.count}</span>
            </button>
          </li>
        ))}
        {data && !data.length && <li className="px-2 py-1.5 text-sm text-zinc-400">No values</li>}
      </ul>
    </div>
  );
}

