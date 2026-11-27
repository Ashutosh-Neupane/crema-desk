/**
 * Pure helpers behind the Desk list view (frappe/public/js/frappe/list/list_view.js): which columns and fields a
 * list shows and fetches, which views it offers, where a row links to, and how filters live in the URL.
 */
import type { Filter } from "@/lib/list/api";
import type { ListColumnSetting } from "@/lib/list/useListViewSettings";
import type { UserSettings } from "@/lib/list/useUserListState";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { NO_VALUE } from "@/components/list/filterModel";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

export type Sort = { field: string; order: "asc" | "desc" };
export type ListSettings = Record<string, unknown> | undefined;

const enc = encodeURIComponent;
export const NUMERIC_TYPES = new Set(["Currency", "Float", "Int", "Percent"]);
const SORTABLE_TYPES = new Set([
  "Date",
  "Datetime",
  "Int",
  "Float",
  "Currency",
  "Percent",
  "Data",
  "Link",
  "Select",
]);
const STANDARD_FILTER_TYPES = new Set(["Link", "Select", "Data", "Date", "Check"]);
const RESERVED_PARAMS = new Set(["filters", "view", "sort", "q"]);
const STD_FIELDS = new Set([
  "name",
  "owner",
  "creation",
  "modified",
  "modified_by",
  "docstatus",
  "idx",
  "_assign",
  "_user_tags",
  "_comments",
  "_liked_by",
]);
const STD_COLUMNS: Record<string, Partial<DocField>> = {
  owner: { fieldtype: "Link", options: "User", label: "Created By" },
  modified_by: { fieldtype: "Link", options: "User", label: "Last Updated By" },
  creation: { fieldtype: "Datetime", label: "Created On" },
  modified: { fieldtype: "Datetime", label: "Last Updated On" },
  idx: { fieldtype: "Int", label: "Index" },
  docstatus: { fieldtype: "Int", label: "Document Status" },
};

export const toOrder = (v: unknown): Sort["order"] =>
  String(v).toLowerCase() === "asc" ? "asc" : "desc";
export const defaultSortOf = (meta: DocTypeMeta | undefined): Sort => ({
  field: String(meta?.sort_field || "modified"),
  order: toOrder(meta?.sort_order || "desc"),
});
export const titleFieldOf = (meta: DocTypeMeta | undefined) =>
  typeof meta?.title_field === "string" ? meta.title_field : "";
export const docHref = (doctype: string, name: string) => `${doctypeUrl(doctype)}/${enc(name)}`;
export const newDocHref = (doctype: string) => `${doctypeUrl(doctype)}/new`;

/** the list URL for a set of filters: simple equality filters read nicely (?status=Draft), others go in ?filters= */
export function listUrl(pathname: string, next: Filter[], search: string, view: string | null) {
  const sp = new URLSearchParams();
  const complex: Filter[] = [];
  for (const f of next) {
    if (
      f[2] === "=" &&
      (typeof f[3] === "string" || typeof f[3] === "number") &&
      !sp.has(f[1]) &&
      !RESERVED_PARAMS.has(f[1])
    )
      sp.set(f[1], String(f[3]));
    else complex.push(f);
  }
  if (complex.length) sp.set("filters", JSON.stringify(complex));
  if (search.trim()) sp.set("q", search.trim());
  // keep ?view=list: without it a tree DocType's list goes back to Tree view
  if (view) sp.set("view", view);
  return `${pathname}${sp.toString() ? `?${sp}` : ""}`;
}

/**
 * list_view.js setup_defaults: the filters to restore when the URL has none — the user's saved List filters
 * (fields that still exist), else the app's listview_settings.filters ([field, op, value] or 4-tuples).
 */
export function filtersToRestore(
  doctype: string,
  meta: DocTypeMeta,
  settings: Record<string, unknown>,
  saved: UserSettings,
  urlFilters: Filter[]
): Filter[] | null {
  if (urlFilters.length) return null;
  const cur = saved.List ?? {};
  if (Array.isArray(cur.filters)) {
    if (!cur.filters.length) return null;
    const fields = new Set((meta.fields ?? []).map((x) => x.fieldname));
    const valid = (cur.filters as Filter[]).filter(
      (f) =>
        Array.isArray(f) &&
        f.length === 4 &&
        (f[0] !== doctype || STD_FIELDS.has(f[1]) || fields.has(f[1]))
    );
    return valid.length ? valid : null;
  }
  if (Array.isArray(settings.filters) && settings.filters.length)
    return (settings.filters as unknown[][])
      .filter(Array.isArray)
      .map((f) => (f.length === 3 ? [doctype, ...f] : f.slice(0, 4)) as Filter);
  return null;
}

export const savedSortOf = (saved: UserSettings): Sort | null => {
  const cur = saved.List ?? {};
  return cur.sort_by ? { field: String(cur.sort_by), order: toOrder(cur.sort_order) } : null;
};

/** list_view.js build_columns: the List View Settings / layout columns in order, else the in_list_view fields */
export function buildListFields(
  meta: DocTypeMeta | undefined,
  colSettings: ListColumnSetting[],
  titleField: string
): DocField[] {
  if (!meta) return [];
  if (!colSettings.length)
    return (meta.fields ?? [])
      .filter(
        (f) =>
          f.in_list_view &&
          !NO_VALUE.has(f.fieldtype) &&
          f.fieldname !== titleField &&
          f.fieldname !== "status"
      )
      .slice(0, 6);
  const subject = new Set(["name", titleField, colSettings[0]?.fieldname]);
  const byName = new Map((meta.fields ?? []).map((f) => [f.fieldname, f]));
  const hasStatusColumn = colSettings.some((x) => x.fieldname === "status_field");
  const out: DocField[] = [];
  for (const c of colSettings) {
    // the Status indicator column already shows the `status` field
    if (
      c.fieldname === "status_field" ||
      subject.has(c.fieldname) ||
      (c.fieldname === "status" && hasStatusColumn)
    )
      continue;
    const std = STD_COLUMNS[c.fieldname];
    const df =
      byName.get(c.fieldname) ??
      (std ? ({ fieldname: c.fieldname, ...std } as DocField) : undefined);
    if (df && !NO_VALUE.has(df.fieldtype)) out.push(df);
  }
  return out;
}

/** list_view.js set_fields: what the list query asks for */
export function buildFetchFields(
  meta: DocTypeMeta | undefined,
  titleField: string,
  listFields: DocField[],
  settings: ListSettings
): string[] {
  if (!meta) return [];
  const has = new Set((meta.fields ?? []).map((f) => f.fieldname));
  const fs = new Set<string>(["name", "docstatus", "modified", "owner", "_assign", "_liked_by"]);
  // _seen when the DocType tracks who opened each record
  if (meta.track_seen) fs.add("_seen");
  if (titleField) fs.add(titleField);
  if (has.has("status")) fs.add("status");
  if (has.has("workflow_state")) fs.add("workflow_state");
  for (const f of listFields) {
    fs.add(f.fieldname);
    if (f.fieldtype === "Currency" && typeof f.options === "string" && has.has(f.options))
      fs.add(f.options);
  }
  for (const f of (settings?.add_fields as string[] | undefined) ?? [])
    if (f === "name" || has.has(f)) fs.add(f);
  for (const f of ["enabled", "disabled", "currency"]) if (has.has(f)) fs.add(f);
  return [...fs];
}

/** whether the DocType has a status indicator at all (model/indicator.js) */
export function indicatorCapable(meta: DocTypeMeta, settings: ListSettings) {
  return (
    !!meta.is_submittable ||
    typeof settings?.get_indicator === "function" ||
    !!meta.fields?.some(
      (f) => f.fieldname === "status" || f.fieldname === "enabled" || f.fieldname === "disabled"
    )
  );
}

export const standardFiltersOf = (meta: DocTypeMeta | undefined) =>
  (meta?.fields ?? [])
    .filter((f) => f.in_standard_filter && STANDARD_FILTER_TYPES.has(f.fieldtype))
    .slice(0, 4);

export function sortableFields(meta: DocTypeMeta) {
  const out = [
    { fieldname: "modified", label: "Last Updated On" },
    { fieldname: "creation", label: "Created On" },
    { fieldname: "name", label: "ID" },
    ...(meta.fields ?? [])
      .filter(
        (f) => SORTABLE_TYPES.has(f.fieldtype) && (f.in_list_view || f.in_standard_filter || f.bold)
      )
      .map((f) => ({ fieldname: f.fieldname, label: f.label ?? f.fieldname })),
  ];
  const seen = new Set<string>();
  return out.filter((s) => !seen.has(s.fieldname) && !!seen.add(s.fieldname));
}

/** only the views that make sense for the DocType */
/**
 * The views Desk's view switcher offers (frappe/list/list_view_select.js get_views): List, Report when the user may
 * report on the DocType, Calendar / Gantt with calendar settings, Image with an image field, Tree for tree DocTypes.
 * Kanban is listed by board in ViewMenu (Desk's Kanban submenu: the boards that exist, then "New Kanban Board").
 */
export function listViews(
  meta: DocTypeMeta | undefined,
  doctype: string,
  opts: { canReport?: boolean } = {}
): Array<{ id: string; label: string; href: string }> {
  if (!meta) return [];
  const base = `${doctypeUrl(doctype)}`;
  const v = [{ id: "list", label: doctype === "File" ? "File" : "List", href: `${base}${meta.is_tree ? "?view=list" : ""}` }];
  if (opts.canReport !== false) v.push({ id: "report", label: "Report", href: `${base}/view/report` });
  // Desk: File has a folder view (/app/file/view/home)
  if (doctype === "File") v.push({ id: "home", label: "Home", href: "/desk/files" });
  // Calendar and Gantt when the DocType ships calendar settings (frappe.views.calendar) or is_calendar_and_gantt
  const calJs = String((meta as { __calendar_js?: string }).__calendar_js ?? "");
  const calendar = !!calJs || !!(meta as { is_calendar_and_gantt?: number }).is_calendar_and_gantt;
  if (calendar) v.push({ id: "calendar", label: "Calendar", href: `${base}/view/calendar` });
  if (calendar && (/\bgantt\s*:\s*(true|\{)/.test(calJs) || (meta as { is_calendar_and_gantt?: number }).is_calendar_and_gantt))
    v.push({ id: "gantt", label: "Gantt", href: `${base}/view/gantt` });
  if (meta.image_field) v.push({ id: "image", label: "Image", href: `${base}/view/image` });
  if (meta.is_tree) v.push({ id: "tree", label: "Tree", href: `${base}/view/tree` });
  return v;
}

/**
 * list_view.js get_form_link: listview_settings.get_form_link may send a row elsewhere (Workflow Action → the
 * document waiting on you); its Desk path (/desk/<slug>/<name>) is resolved by the /desk/[slug] route
 */
export function rowHref(
  settings: ListSettings,
  doctype: string,
  r: Record<string, unknown> & { name: string }
) {
  const fn = settings?.get_form_link;
  if (typeof fn === "function") {
    try {
      const p = fn.call(settings, r);
      if (typeof p === "string" && p.startsWith("/")) return p.replace(/^\/app\//, "/desk/");
    } catch {
      /* a broken app script falls back to the record's own form */
    }
  }
  return docHref(doctype, r.name);
}

/** listview_settings.formatters[fieldname], when the app defines one */
export function formatterFor(settings: ListSettings, fieldname: string) {
  const fn = (settings?.formatters as Record<string, unknown> | undefined)?.[fieldname];
  return typeof fn === "function"
    ? (fn as (v: unknown, df: unknown, doc: unknown) => unknown)
    : null;
}

/** an app's menu / button callback must not take the list down */
export function runItem(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    console.warn("listview_settings:", e);
  }
}

export function toggled(set: Set<string>, name: string) {
  const next = new Set(set);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  return next;
}
