/**
 * Saved list layouts (Desk v16: frappe/public/js/frappe/list/list_filter/list_filter_api.js, list_filter_menu.js;
 * server: frappe/desk/doctype/list_filter/list_filter.py). A List Filter holds a name, filters (4-tuples), columns
 * ({ fieldname, label, width }), sort and a route signature; global (for_user empty, System Manager) or personal;
 * standard ones ship with an app (developer mode only). The active layout is remembered in the user's settings
 * (List.active_layout_name) and found again from the URL's filters by signature.
 */
import { deskCall } from "@/lib/frappe/form";
import type { Filter } from "@/lib/list/api";
import type { ListColumnSetting } from "@/lib/list/useListViewSettings";

export const DEFAULT_LAYOUT = "default_layout";

export interface ListLayout {
  name: string;
  filter_name: string;
  for_user?: string | null;
  is_standard?: number;
  filters?: string | null;
  columns?: string | null;
  sort_field?: string | null;
  sort_order?: string | null;
  route_signature?: string | null;
}

const parse = <T>(s: string | null | undefined): T[] => {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};
export const layoutFilters = (l: ListLayout | null | undefined) => parse<Filter>(l?.filters).filter((f) => Array.isArray(f) && f.length >= 4).map((f) => f.slice(0, 4) as Filter);
export const layoutColumns = (l: ListLayout | null | undefined) => parse<ListColumnSetting>(l?.columns).filter((c) => c && typeof c.fieldname === "string");

/** list_filter_api.js get_list_filters: the DocType's global layouts and mine, standard first */
export async function fetchLayouts(doctype: string, user: string): Promise<ListLayout[]> {
  const { env } = await deskCall(
    "frappe.client.get_list",
    {
      doctype: "List Filter",
      fields: JSON.stringify(["name", "filter_name", "for_user", "is_standard", "filters", "columns", "sort_field", "sort_order", "route_signature"]),
      filters: JSON.stringify({ reference_doctype: doctype }),
      or_filters: JSON.stringify([
        ["for_user", "=", user],
        ["for_user", "=", ""],
      ]),
      order_by: "is_standard desc, layout_order asc, filter_name asc",
      limit_page_length: 200,
    },
    { get: true },
  );
  return (env.message as ListLayout[] | undefined) ?? [];
}

export const layoutLabel = (l: ListLayout) => l.filter_name;

/** list_filter_api.js can_edit_layout */
export function canEditLayout(l: ListLayout | null | undefined, ctx: { user: string; roles: string[]; developerMode: boolean }): boolean {
  if (!l) return false;
  if (l.is_standard && !ctx.developerMode) return false;
  if (!l.for_user) return canAddGlobal(ctx);
  return l.for_user === ctx.user;
}
export const canAddGlobal = (ctx: { user: string; roles: string[] }) => ctx.user === "Administrator" || ctx.roles.includes("System Manager") || ctx.roles.includes("Administrator");

/** list_filter_menu.js normalize_filter_value */
function normalizeValue(op: string, v: unknown): unknown {
  if (v == null) return v;
  if (op === "like" && typeof v === "string") {
    const s = v.replace(/^%+|%+$/g, "");
    return s ? `%${s}%` : v;
  }
  if (op === "=" && typeof v === "string") return v.replace(/^%+|%+$/g, "");
  return v;
}

/** list_filter_menu.js get_route_signature_from_filters (= list_filter.py compute_route_signature): sorted key=value */
export function routeSignature(doctype: string, filters: Filter[]): string {
  const params: Array<[string, string]> = filters.map(([dt, field, op, value]) => {
    const key = dt === doctype ? field : `${dt}.${field}`;
    const v = normalizeValue(op, value);
    return [key, op === "=" ? String(v ?? "") : JSON.stringify([op, v])];
  });
  params.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return params.map(([k, v]) => `${k}=${v}`).join("&");
}

/** the layout whose saved filters are the list's current filters */
export function findBySignature(layouts: ListLayout[], doctype: string, filters: Filter[]): ListLayout | null {
  if (!filters.length) return null;
  const sig = routeSignature(doctype, filters);
  return layouts.find((l) => (l.route_signature || routeSignature(doctype, layoutFilters(l))) === sig) ?? null;
}

export interface LayoutInput {
  filter_name: string;
  is_global: boolean;
  is_standard?: boolean;
  module?: string;
  filters: Filter[];
  columns: ListColumnSetting[];
  sort_field: string;
  sort_order: string;
}

/** create_layout_from_dialog */
export async function createLayout(doctype: string, user: string, v: LayoutInput): Promise<ListLayout> {
  const { env } = await deskCall("frappe.client.insert", {
    doc: JSON.stringify({
      doctype: "List Filter",
      reference_doctype: doctype,
      filter_name: v.filter_name,
      for_user: v.is_global || v.is_standard ? "" : user,
      is_standard: v.is_standard ? 1 : 0,
      module: v.is_standard ? v.module : "",
      filters: JSON.stringify(v.filters),
      columns: JSON.stringify(v.columns),
      sort_field: v.sort_field,
      sort_order: v.sort_order,
      route_signature: routeSignature(doctype, v.filters),
    }),
  });
  return env.message as ListLayout;
}

/** update_layout_from_dialog → list_filter.update_list_filter (permission-checked on the server) */
export async function updateLayout(doctype: string, layout: ListLayout, user: string, v: LayoutInput, mayChangeScope: boolean): Promise<ListLayout> {
  const { env } = await deskCall("frappe.desk.doctype.list_filter.list_filter.update_list_filter", {
    name: layout.name,
    filter_name: v.filter_name,
    filters: JSON.stringify(v.filters),
    columns: JSON.stringify(v.columns),
    sort_field: v.sort_field,
    sort_order: v.sort_order,
    ...(mayChangeScope ? { for_user: v.is_global ? "" : user } : {}),
  });
  return env.message as ListLayout;
}

export async function deleteLayout(name: string): Promise<void> {
  await deskCall("frappe.desk.doctype.list_filter.list_filter.delete_list_filter", { name });
}
