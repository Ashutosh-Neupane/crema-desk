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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import type { Filter } from "@/lib/list/api";
import { FIELD_TYPES, toggleGroupFilter, useGroupByFields, useGroupCounts } from "./groupCounts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import type { DocTypeMeta } from "@/lib/frappe/types";

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
  const { fields, saved, fieldtypeOf } = useGroupByFields(meta);
  const apply = (fieldname: string, value: string | null, selected: boolean) =>
    setFilters(toggleGroupFilter(doctype, filters, fieldname, value, selected));

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="List sidebar">
      {fields.map((f) => (
        <GroupByDropdown
          key={f.fieldname}
          doctype={doctype}
          fieldname={f.fieldname}
          label={f.label}
          fieldtype={fieldtypeOf(f.fieldname)}
          filters={filters}
          user={user}
          onPick={apply}
        />
      ))}
      <Customize
        meta={meta}
        saved={saved}
        onSaved={() => qc.invalidateQueries({ queryKey: ["list-group-by-fields", doctype] })}
      />
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
  const { data, isLoading, applied, isApplied } = useGroupCounts({
    doctype,
    fieldname,
    fieldtype,
    filters,
    user,
    enabled: open,
  });
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
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">
                    {i.label}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-1.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {i.count}
                  </span>
                </button>
              </li>
            );
          })}
          {data && !items.length && (
            <li className="px-2 py-1.5 text-sm text-zinc-400">
              {fieldname === "tags" ? "No records tagged." : "No filters found"}
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// Desk's "Customize Quick Filters": pick the fields shown as group-by dropdowns (saved in user settings)
function Customize({
  meta,
  saved,
  onSaved,
}: {
  meta: DocTypeMeta;
  saved: string[];
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const savedSet = useMemo(() => new Set(saved), [saved]);
  const options = useMemo(
    () =>
      (meta.fields ?? []).filter(
        (f) => FIELD_TYPES.includes(f.fieldtype) && !f.hidden && f.fieldname !== "naming_series"
      ),
    [meta]
  );
  const save = useMutation({
    mutationFn: async (next: string[]) => {
      await deskCall("frappe.model.utils.user_settings.save", {
        doctype: meta.name,
        user_settings: JSON.stringify({ group_by_fields: next.length ? next : null }),
      });
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
      <PopoverTrigger
        aria-label="Customize sidebar filters"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="px-1 pb-1 text-xs font-medium text-zinc-500">Select Filters</p>
        <ul className="max-h-72 overflow-auto">
          {options.map((f) => (
            <li key={f.fieldname}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <input
                  type="checkbox"
                  checked={savedSet.has(f.fieldname)}
                  onChange={() => toggle(f.fieldname)}
                />
                <span className="truncate text-zinc-700 dark:text-zinc-200">
                  {f.label ?? f.fieldname}
                </span>
              </label>
            </li>
          ))}
          {!options.length && <li className="px-2 py-1.5 text-sm text-zinc-400">No fields</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
