"use client";

/**
 * Desk's list group-by counts, shared by the filter-bar dropdowns (ListSidebar) and the wide-screen filters pane
 * (ListFacetsPane). Transcribed from frappe/public/js/frappe/list/base_list.js and list_sidebar_group_by.js:
 *   frappe.desk.listview.get_group_by_count   counts per value, following the list's current filters
 *   frappe.desk.reportview.get_sidebar_stats  tag counts (`_user_tags`)
 *   frappe.model.utils.user_settings.get/save `group_by_fields` ("Customize Quick Filters")
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { deskCall } from "@/lib/frappe/form";
import { fetchGroupByCount, type Filter } from "@/lib/list/api";
import type { DocTypeMeta } from "@/lib/frappe/types";

type Count = { name: string | null; count: number; title?: string };
export type GroupItem = { key: string; label: string; count: number };

export const STANDARD = [
  { fieldname: "assigned_to", label: "Assigned To" },
  { fieldname: "owner", label: "Created By" },
  { fieldname: "tags", label: "Tags" },
];
export const FIELD_TYPES = ["Select", "Link", "Data", "Int", "Check"];
export const filterField = (f: string) =>
  f === "assigned_to" ? "_assign" : f === "tags" ? "_user_tags" : f;

async function loadGroupByFields(doctype: string): Promise<string[]> {
  const { env } = await deskCall(
    "frappe.model.utils.user_settings.get",
    { doctype },
    { get: true }
  );
  try {
    const s = typeof env.message === "string" ? JSON.parse(env.message) : (env.message ?? {});
    return Array.isArray(s?.group_by_fields) ? (s.group_by_fields as string[]) : [];
  } catch {
    return [];
  }
}

/** Assigned To / Created By / Tags plus the user's saved group-by fields */
export function useGroupByFields(meta: DocTypeMeta) {
  const doctype = meta.name;
  const { data: saved = [] } = useQuery({
    queryKey: ["list-group-by-fields", doctype],
    queryFn: () => loadGroupByFields(doctype),
    staleTime: 60_000,
  });
  const fields = useMemo(() => {
    const out = [...STANDARD];
    const byName = new Map((meta.fields ?? []).map((f) => [f.fieldname, f]));
    const seen = new Set(out.map((o) => o.fieldname));
    for (const fn of saved) {
      const df = byName.get(fn);
      if (df && !seen.has(fn)) {
        seen.add(fn);
        out.push({ fieldname: fn, label: df.label ?? fn });
      }
    }
    return out;
  }, [saved, meta]);
  const fieldtypeOf = (fn: string) => meta.fields?.find((f) => f.fieldname === fn)?.fieldtype;
  return { fields, saved, fieldtypeOf };
}

/** Desk apply_filter: remove the field's filter, then add the value unless it was the one applied */
export function toggleGroupFilter(
  doctype: string,
  filters: Filter[],
  fieldname: string,
  value: string | null,
  selected: boolean
): Filter[] {
  const ff = filterField(fieldname);
  const rest = filters.filter((f) => f[1] !== ff);
  if (selected) return rest;
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
  return [...rest, [doctype, ff, op, v] as Filter];
}

function labelOf(r: Count, user: string, fieldtype?: string): string {
  if (r.name == null) return "Not Set";
  if (r.name === user) return "Me";
  if (fieldtype === "Check") return String(r.name) === "0" ? "No" : "Yes";
  return fieldtype === "Link" && r.title ? r.title : String(r.name);
}

async function loadCounts(
  doctype: string,
  fieldname: string,
  fieldtype: string | undefined,
  countFilters: Filter[],
  user: string
): Promise<GroupItem[]> {
  if (fieldname === "tags") {
    const { env } = await deskCall(
      "frappe.desk.reportview.get_sidebar_stats",
      { stats: ["_user_tags"], doctype, filters: countFilters },
      { get: true }
    );
    const stats = ((env.message as { stats?: Record<string, Array<[string, number]>> })?.stats
      ?._user_tags ?? []) as Array<[string, number]>;
    return stats.map(([name, count]) => ({ key: name, label: name, count }));
  }
  let rows: Count[] = (await fetchGroupByCount(doctype, countFilters, fieldname)).filter(
    (r) => r.count !== 0
  );
  const me = rows.find((r) => r.name === user);
  rows = rows.filter((r) => !["Guest", "Administrator", user].includes(String(r.name)));
  if (me) rows.unshift(me);
  return rows.map((r) => ({
    key: r.name == null ? "" : String(r.name),
    count: r.count,
    label: labelOf(r, user, fieldtype),
  }));
}

/** counts per value of one field, and which value is applied */
export function useGroupCounts({
  doctype,
  fieldname,
  fieldtype,
  filters,
  user,
  enabled,
}: {
  doctype: string;
  fieldname: string;
  fieldtype?: string;
  filters: Filter[];
  user: string;
  enabled: boolean;
}) {
  const ff = filterField(fieldname);
  const applied = filters.find((f) => f[1] === ff);
  // Desk removes the field's own filter so every value keeps its count; tags keep all filters
  const countFilters = useMemo(
    () => (fieldname === "tags" ? filters : filters.filter((f) => f[1] !== ff)),
    [filters, fieldname, ff]
  );
  const { data, isLoading } = useQuery<GroupItem[]>({
    queryKey: ["list-sidebar", doctype, fieldname, countFilters],
    enabled,
    staleTime: 0,
    queryFn: () => loadCounts(doctype, fieldname, fieldtype, countFilters, user),
  });
  const isApplied = (key: string) => {
    if (!applied) return false;
    const v = String(applied[3] ?? "");
    if (fieldname === "assigned_to") return v === `%${key}%`;
    if (fieldname === "tags") return key === "No Tags" ? applied[2] === "is" : v === key;
    return key === "" ? applied[2] === "is" : v === key;
  };
  return { data, isLoading, applied, isApplied };
}
