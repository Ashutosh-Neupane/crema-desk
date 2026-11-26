"use client";

import { useMemo, useState } from "react";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { aggregateFields, groupableFields, groupingError, type AggregateFn, type GroupBy } from "@/lib/report/groupBy";

/** group_by.html: group field, aggregate function and (sum / avg) the field — applied as soon as it is complete */
export default function GroupByEditor({ meta, childMetas, value, onChange }: { meta: DocTypeMeta; childMetas: DocTypeMeta[]; value: GroupBy | null; onChange: (g: GroupBy | null) => void }) {
  const groups = useMemo(() => groupableFields(meta, childMetas), [meta, childMetas]);
  const aggs = useMemo(() => aggregateFields(meta, childMetas), [meta, childMetas]);
  // a choice not yet applied (sum / avg without a field, or refused); otherwise what is applied
  const [pending, setPending] = useState<GroupBy | null>(null);
  const draft = pending ?? value;
  const [error, setError] = useState("");
  const enc2 = (dt: string, f: string) => `${dt}::${f}`;
  const dec = (v: string) => v.split("::") as [string, string];
  const fn = draft?.fn ?? "count";
  const apply = (g: GroupBy) => {
    const err = g.field ? groupingError(g, meta.name) : null;
    setError(err ?? "");
    // apply_group_by: only once the group field and, for sum / avg, the field are chosen
    const complete = !err && !!g.field && (g.fn === "count" || !!g.aggField);
    setPending(complete ? null : g);
    if (complete) onChange(g);
  };
  const sel = "h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  const label = (dt: string, f: DocField) => `${f.label || f.fieldname}${dt === meta.name ? "" : ` (${dt})`}`;
  return (
    <div className="space-y-2">
      <select aria-label="Group by field" className={sel} value={draft?.field ? enc2(draft.doctype, draft.field) : ""} onChange={(e) => {
        const [doctype, field] = dec(e.target.value);
        apply({ ...(draft ?? { fn: "count" }), field, doctype });
      }}>
        <option value="" disabled>
          Select Group By...
        </option>
        {groups.map((g) => (
          <optgroup key={g.doctype} label={g.doctype}>
            {g.fields.map((f) => (
              <option key={f.fieldname} value={enc2(g.doctype, f.fieldname)}>
                {label(g.doctype, f)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="flex gap-2">
        <select aria-label="Aggregate function" className={sel} value={fn} onChange={(e) => {
          const next = e.target.value as AggregateFn;
          apply({ ...(draft ?? { field: "", doctype: meta.name }), fn: next, ...(next === "count" ? { aggField: undefined, aggDoctype: undefined } : {}) } as GroupBy);
        }}>
          <option value="count">Count</option>
          <option value="sum">Sum</option>
          <option value="avg">Average</option>
        </select>
        {fn !== "count" && (
          <select aria-label="Aggregate on" className={sel} value={draft?.aggField ? enc2(draft.aggDoctype ?? meta.name, draft.aggField) : ""} onChange={(e) => {
            const [aggDoctype, aggField] = dec(e.target.value);
            apply({ ...(draft as GroupBy), aggField, aggDoctype });
          }}>
            <option value="" disabled>
              Select Field...
            </option>
            {aggs.map((g) => (
              <optgroup key={g.doctype} label={g.doctype}>
                {g.fields.map((f) => (
                  <option key={f.fieldname} value={enc2(g.doctype, f.fieldname)}>
                    {label(g.doctype, f)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {value && (
        <button type="button" onClick={() => {
          setPending(null);
          setError("");
          onChange(null);
        }} className="w-full rounded-md border border-zinc-200 py-1.5 text-sm dark:border-zinc-700">
          Remove
        </button>
      )}
    </div>
  );
}
