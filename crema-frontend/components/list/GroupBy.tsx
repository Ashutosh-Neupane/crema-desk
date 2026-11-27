"use client";

/** Group-by counts for list-like views (frappe.desk.listview.get_group_by_count). */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGroupByCount, type Filter } from "@/lib/list/api";
import type { DocTypeMeta } from "@/lib/frappe/types";

export default function GroupBy({
  meta,
  filters,
  onPick,
}: {
  meta: DocTypeMeta;
  filters: Filter[];
  onPick: (f: Filter) => void;
}) {
  const candidates = useMemo(
    () => [
      { fieldname: "assigned_to", label: "Assigned To" },
      { fieldname: "owner", label: "Created By" },
      ...(meta.fields ?? [])
        .filter(
          (f) =>
            ["Select", "Link"].includes(f.fieldtype) && !f.hidden && f.fieldname !== "naming_series"
        )
        .map((f) => ({ fieldname: f.fieldname, label: f.label ?? f.fieldname })),
    ],
    [meta]
  );
  const [field, setField] = useState(
    () =>
      candidates.find((c) => c.fieldname === "status")?.fieldname ??
      candidates[2]?.fieldname ??
      "owner"
  );
  const { data, isLoading } = useQuery({
    queryKey: ["group-by", meta.name, field, filters],
    queryFn: () => fetchGroupByCount(meta.name, filters, field),
  });
  return (
    <div className="space-y-2">
      <select
        aria-label="Group by field"
        value={field}
        onChange={(e) => setField(e.target.value)}
        className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {candidates.map((c) => (
          <option key={c.fieldname} value={c.fieldname}>
            {c.label}
          </option>
        ))}
      </select>
      <ul className="max-h-72 overflow-auto">
        {isLoading && <li className="px-2 py-1.5 text-sm text-zinc-400">Loading…</li>}
        {data?.map((g) => (
          <li key={String(g.name)}>
            <button
              type="button"
              onClick={() =>
                onPick(
                  field === "assigned_to"
                    ? [meta.name, "_assign", "like", `%${g.name}%`]
                    : [meta.name, field, g.name == null ? "is" : "=", g.name ?? "not set"]
                )
              }
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">
                {g.title || g.name || "Not set"}
              </span>
              <span className="rounded-full bg-zinc-100 px-1.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {g.count}
              </span>
            </button>
          </li>
        ))}
        {data && !data.length && <li className="px-2 py-1.5 text-sm text-zinc-400">No values</li>}
      </ul>
    </div>
  );
}
