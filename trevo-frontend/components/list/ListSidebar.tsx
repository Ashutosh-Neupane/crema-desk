"use client";

/**
 * List sidebar group-by counts — Desk's "Assigned To" / "Created By" / "Tags" / configured-field dropdowns.
 * Transcribed from frappe/public/js/frappe/list/base_list.js (render_non_standard_fields_filter,
 * get_group_by_count, get_stats, apply_filter) and list_sidebar_group_by.js:
 *   frappe.desk.listview.get_group_by_count   counts per value, following the list's current filters
 *   frappe.desk.reportview.get_sidebar_stats  tag counts (`_user_tags`)
 *   frappe.model.utils.user_settings.get/save `group_by_fields` ("Customize Quick Filters")
 * Clicking a value toggles a filter: assigned_to → `_assign like %user%`, tags → `_user_tags like tag`
 * ("No Tags" → is not set), others → `field = value` (empty → is not set).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import { fetchGroupByCount, type Filter } from "@/lib/list/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import type { DocTypeMeta } from "@/lib/frappe/types";

type Count = { name: string | null; count: number; title?: string };
type Item = { key: string; label: string; count: number };

const STANDARD = [
  { fieldname: "assigned_to", label: "Assigned To" },
  { fieldname: "owner", label: "Created By" },
  { fieldname: "tags", label: "Tags" },
];
const FIELD_TYPES = ["Select", "Link", "Data", "Int", "Check"];
const filterField = (f: string) => (f === "assigned_to" ? "_assign" : f === "tags" ? "_user_tags" : f);

async function loadGroupByFields(doctype: string): Promise<string[]> {
  const { env } = await deskCall("frappe.model.utils.user_settings.get", { doctype }, { get: true });
  try {
    const s = typeof env.message === "string" ? JSON.parse(env.message) : (env.message ?? {});
    return Array.isArray(s?.group_by_fields) ? (s.group_by_fields as string[]) : [];
  } catch {
    return [];
  }
}

export default function ListSidebar({
  meta,
  filters,
  setFilters,
  user,
}: {
  meta: DocTypeMeta;
  filters: Filter[];
  setFilters: (f: Filter[]) => void;
  user: string;
}) {
  const qc = useQueryClient();
  const doctype = meta.name;
  const { data: saved = [] } = useQuery({ queryKey: ["list-group-by-fields", doctype], queryFn: () => loadGroupByFields(doctype), staleTime: 60_000 });
  const fields = useMemo(() => {
    const out = [...STANDARD];
    for (const fn of saved) {
      const df = meta.fields?.find((f) => f.fieldname === fn);
      if (df && !out.some((o) => o.fieldname === fn)) out.push({ fieldname: fn, label: df.label ?? fn });
    }
    return out;
  }, [saved, meta]);
  const fieldtypeOf = (fn: string) => meta.fields?.find((f) => f.fieldname === fn)?.fieldtype;

  const apply = (fieldname: string, value: string | null, selected: boolean) => {
    const ff = filterField(fieldname);
    // Desk: filter_area.remove(fieldname), then add unless the value was already applied
    const rest = filters.filter((f) => f[1] !== ff);
    if (selected) return setFilters(rest);
    let op = "=";
    let v: unknown = value ?? "";
    if (v === "" || (ff === "_user_tags" && value === "No Tags")) {
      op = "is";
      v = "not set";
    } else if (ff === "_assign") {
      op = "like";
      v = `%${value}%`;
    } else if (ff === "_user_tags") {
      op = "like";
    }
    setFilters([...rest, [doctype, ff, op, v]]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="List sidebar">
      {fields.map((f) => (
        <GroupByDropdown key={f.fieldname} doctype={doctype} fieldname={f.fieldname} label={f.label} fieldtype={fieldtypeOf(f.fieldname)} filters={filters} user={user} onPick={apply} />
      ))}
      <Customize meta={meta} saved={saved} onSaved={() => qc.invalidateQueries({ queryKey: ["list-group-by-fields", doctype] })} />
    </div>
  );
}

function GroupByDropdown({
  doctype,
  fieldname,
  label,
  fieldtype,
  filters,
  user,
  onPick,
}: {
  doctype: string;
  fieldname: string;
  label: string;
  fieldtype?: string;
  filters: Filter[];
  user: string;
  onPick: (fieldname: string, value: string | null, selected: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ff = filterField(fieldname);
  const applied = filters.find((f) => f[1] === ff);
  // Desk removes the field's own filter so every value keeps its count; tags keep all filters
  const countFilters = useMemo(() => (fieldname === "tags" ? filters : filters.filter((f) => f[1] !== ff)), [filters, fieldname, ff]);

  const { data, isLoading } = useQuery<Item[]>({
    queryKey: ["list-sidebar", doctype, fieldname, countFilters],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      if (fieldname === "tags") {
        const { env } = await deskCall("frappe.desk.reportview.get_sidebar_stats", { stats: ["_user_tags"], doctype, filters: countFilters }, { get: true });
        const stats = ((env.message as { stats?: Record<string, Array<[string, number]>> })?.stats?._user_tags ?? []) as Array<[string, number]>;
        return stats.map(([name, count]) => ({ key: name, label: name, count }));
      }
      let rows: Count[] = (await fetchGroupByCount(doctype, countFilters, fieldname)).filter((r) => r.count !== 0);
      const me = rows.find((r) => r.name === user);
      rows = rows.filter((r) => !["Guest", "Administrator", user].includes(String(r.name)));
      if (me) rows.unshift(me);
      return rows.map((r) => ({
        key: r.name == null ? "" : String(r.name),
        count: r.count,
        label: r.name == null ? "Not Set" : r.name === user ? "Me" : fieldtype === "Check" ? (String(r.name) === "0" ? "No" : "Yes") : fieldtype === "Link" && r.title ? r.title : String(r.name),
      }));
    },
  });

  const isApplied = (key: string) => {
    if (!applied) return false;
    const v = String(applied[3] ?? "");
    if (fieldname === "assigned_to") return v === `%${key}%`;
    if (fieldname === "tags") return key === "No Tags" ? applied[2] === "is" : v === key;
    return key === "" ? applied[2] === "is" : v === key;
  };
  const items = (data ?? []).filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  // applied value first, like Desk's "has-selected" dropdown
  items.sort((a, b) => Number(isApplied(b.key)) - Number(isApplied(a.key)));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <PopoverTrigger
        aria-label={`${label} group by`}
        data-active={applied ? "true" : undefined}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${applied ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100" : "border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"}`}
      >
        {label}
        <ChevronsUpDown className="h-3 w-3 text-zinc-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          aria-label={`Search ${label}`}
          className="mb-1 h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <ul aria-label={`${label} values`} className="max-h-72 overflow-auto">
          {isLoading && <li className="px-2 py-1.5 text-sm text-zinc-400">Loading…</li>}
          {items.map((i) => {
            const sel = isApplied(i.key);
            return (
              <li key={i.key || "__none"}>
                <button
                  type="button"
                  aria-pressed={sel}
                  onClick={() => {
                    onPick(fieldname, i.key, sel);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="w-3.5 shrink-0">{sel && <Check className="h-3.5 w-3.5" />}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{i.label}</span>
                  <span className="rounded-full bg-zinc-100 px-1.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{i.count}</span>
                </button>
              </li>
            );
          })}
          {data && !items.length && <li className="px-2 py-1.5 text-sm text-zinc-400">{fieldname === "tags" ? "No records tagged." : "No filters found"}</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// Desk's "Customize Quick Filters": pick the fields shown as group-by dropdowns (saved in user settings)
function Customize({ meta, saved, onSaved }: { meta: DocTypeMeta; saved: string[]; onSaved: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => (meta.fields ?? []).filter((f) => FIELD_TYPES.includes(f.fieldtype) && !f.hidden && f.fieldname !== "naming_series"), [meta]);
  const save = useMutation({
    mutationFn: async (next: string[]) => {
      await deskCall("frappe.model.utils.user_settings.save", { doctype: meta.name, user_settings: JSON.stringify({ group_by_fields: next.length ? next : null }) });
    },
    // optimistic: the checkbox and the dropdown appear at once; the refetch confirms
    onSettled: onSaved,
  });
  const toggle = (fn: string) => {
    const next = saved.includes(fn) ? saved.filter((x) => x !== fn) : [...saved, fn];
    void qc.cancelQueries({ queryKey: ["list-group-by-fields", meta.name] });
    qc.setQueryData(["list-group-by-fields", meta.name], next);
    save.mutate(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Customize sidebar filters" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
        <Settings2 className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="px-1 pb-1 text-xs font-medium text-zinc-500">Select Filters</p>
        <ul className="max-h-72 overflow-auto">
          {options.map((f) => (
            <li key={f.fieldname}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <input type="checkbox" checked={saved.includes(f.fieldname)} onChange={() => toggle(f.fieldname)} />
                <span className="truncate text-zinc-700 dark:text-zinc-200">{f.label ?? f.fieldname}</span>
              </label>
            </li>
          ))}
          {!options.length && <li className="px-2 py-1.5 text-sm text-zinc-400">No fields</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
