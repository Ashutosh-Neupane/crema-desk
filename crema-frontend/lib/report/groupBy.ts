/**
 * Report view "Group By" (Desk: frappe/public/js/frappe/ui/group_by/group_by.js, used by views/reports/report_view.js).
 * A group is a field of the DocType or of one of its child tables, with count / sum / avg — sum and avg over a
 * numeric field of the DocType or of a child table. Settings are stored the way Desk stores them (user settings
 * Report.group_by and a saved Report's json.group_by): { group_by: "`tabX`.`field`", aggregate_function,
 * aggregate_on: "`tabY`.`field`" }; plain field names (older Crema settings, route options) are accepted too.
 */
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

export type AggregateFn = "count" | "sum" | "avg";

export interface GroupBy {
  field: string;
  doctype: string;
  fn: AggregateFn;
  aggField?: string;
  aggDoctype?: string;
}

/** what Desk saves (get_settings) */
export interface GroupBySettings {
  group_by: string;
  aggregate_function: AggregateFn;
  aggregate_on?: string | null;
}

const NUMERIC = new Set(["Currency", "Float", "Int", "Percent"]);
const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Table", "Table MultiSelect", "Button", "Image", "Fold", "Heading"]);
const GROUPABLE = new Set(["Select", "Link", "Data", "Int", "Check", "Dynamic Link", "Autocomplete", "Date"]);

/** frappe.model.std_fields that can be grouped on (group_by.js get_group_by_fields: not _liked_by, idx, name) */
export const STD_GROUP_FIELDS: DocField[] = [
  { fieldname: "owner", fieldtype: "Link", label: "Created By", options: "User" },
  { fieldname: "modified_by", fieldtype: "Link", label: "Last Updated By", options: "User" },
  { fieldname: "_user_tags", fieldtype: "Data", label: "Tags" },
  { fieldname: "docstatus", fieldtype: "Int", label: "Document Status" },
] as DocField[];

const byLabel = (a: DocField, b: DocField) => String(a.label ?? a.fieldname).localeCompare(String(b.label ?? b.fieldname));

/** get_group_by_fields: the DocType's groupable fields + standard ones; every reportable field of each child table */
export function groupableFields(meta: DocTypeMeta, children: DocTypeMeta[]): Array<{ doctype: string; fields: DocField[] }> {
  const own = [...(meta.fields ?? []), ...STD_GROUP_FIELDS].filter((f) => GROUPABLE.has(f.fieldtype) && !f.is_virtual).sort(byLabel);
  const tables = new Set((meta.fields ?? []).filter((f) => (f.fieldtype === "Table" || f.fieldtype === "Table MultiSelect") && !f.hidden).map((f) => String(f.options)));
  return [
    { doctype: meta.name, fields: own },
    ...children
      .filter((c) => tables.has(c.name))
      .map((c) => ({ doctype: c.name, fields: (c.fields ?? []).filter((f) => !NO_VALUE.has(f.fieldtype) && !f.report_hide && !f.is_virtual).sort(byLabel) })),
  ];
}

/** toggle_aggregate_on_field: numeric fields of the DocType and of its child tables */
export function aggregateFields(meta: DocTypeMeta, children: DocTypeMeta[]): Array<{ doctype: string; fields: DocField[] }> {
  return groupableFields(meta, children).map((g) => ({
    doctype: g.doctype,
    fields: ((g.doctype === meta.name ? meta.fields : children.find((c) => c.name === g.doctype)?.fields) ?? []).filter((f) => NUMERIC.has(f.fieldtype)),
  })).filter((g) => g.fields.length);
}

const tick = (doctype: string, field: string) => `\`tab${doctype}\`.\`${field}\``;
const fieldOf = (s: string) => s.split(".")[1]?.replace(/`/g, "") ?? s.replace(/`/g, "");
const doctypeOf = (s: string) => s.split(".")[0].replace(/`/g, "").replace(/^tab/, "");

/** apply_settings: "`tabX`.`f`" or "f" → GroupBy */
export function parseGroupBy(s: Partial<GroupBySettings> | null | undefined, meta: DocTypeMeta, children: DocTypeMeta[]): GroupBy | null {
  if (!s?.group_by || !s.aggregate_function) return null;
  const qualified = s.group_by.includes("`.`") || s.group_by.startsWith("`tab");
  const g: GroupBy = { field: fieldOf(s.group_by), doctype: qualified ? doctypeOf(s.group_by) : meta.name, fn: s.aggregate_function };
  if (g.fn !== "count" && s.aggregate_on) {
    g.aggField = fieldOf(s.aggregate_on);
    if (s.aggregate_on.includes("`.`")) g.aggDoctype = doctypeOf(s.aggregate_on);
    else {
      // get_aggregate_on_doctype: the DocType itself if it has the field, else the first child table that does
      const has = (m: DocTypeMeta) => !!m.fields?.some((f) => f.fieldname === g.aggField);
      g.aggDoctype = has(meta) ? meta.name : (children.find(has)?.name ?? meta.name);
    }
  }
  return g.fn === "count" || g.aggField ? g : null;
}

/** get_settings */
export function toSettings(g: GroupBy | null): GroupBySettings | null {
  if (!g) return null;
  return { group_by: tick(g.doctype, g.field), aggregate_function: g.fn, aggregate_on: g.fn === "count" || !g.aggField ? null : tick(g.aggDoctype ?? g.doctype, g.aggField) };
}

/** apply_group_by: grouping a parent field over a child's numbers, or one child over another, is refused */
export function groupingError(g: GroupBy, doctype: string): string | null {
  if (g.fn !== "count" && g.aggDoctype && g.aggDoctype !== doctype && g.doctype !== g.aggDoctype) return "Parent-to-child or child-to-different-child grouping is not allowed.";
  return null;
}

/** set_args: what frappe.desk.reportview.get needs for a grouped view */
export function groupQueryArgs(g: GroupBy, doctype: string) {
  const col = tick(g.doctype, g.field);
  return {
    fields: JSON.stringify([g.doctype === doctype ? col : `${col} as '${g.doctype}:${g.field}'`]),
    group_by: col,
    aggregate_on_field: g.fn === "count" ? "name" : (g.aggField ?? "name"),
    aggregate_on_doctype: g.fn === "count" ? doctype : (g.aggDoctype ?? doctype),
    aggregate_function: g.fn,
    order_by: "_aggregate_column desc",
    with_comment_count: 0,
  };
}

/** get_group_by_docfield: the aggregate column — Count (Int), or Sum / Average of <field> keeping its type */
export function aggregateDocfield(g: GroupBy, aggDf: DocField | undefined): DocField {
  if (g.fn === "count") return { fieldname: "_aggregate_column", fieldtype: "Int", label: "Count" } as DocField;
  const df = { ...(aggDf ?? ({ fieldname: g.aggField, fieldtype: "Float", label: g.aggField } as DocField)) } as DocField;
  const label = String(df.label ?? g.aggField);
  df.label = g.fn === "sum" ? `Sum of ${label}` : `Average of ${label}`;
  if (g.fn === "avg" && df.fieldtype === "Int") df.fieldtype = "Float";
  // a Currency whose currency comes from a field of each row has no single currency once grouped
  if (df.fieldtype === "Currency" && typeof df.options === "string" && df.options && !df.options.includes(":") && df.options !== g.field) {
    df.fieldtype = "Float";
    df.options = undefined;
  }
  df.fieldname = "_aggregate_column";
  return df;
}

/** report_view.js get_search_params / parse_filters_from_route_options: ?_group_by=[group_by, aggregate_on, fn] */
export function groupFromParam(raw: string | null): Partial<GroupBySettings> | null {
  if (!raw) return null;
  try {
    const [group_by, aggregate_on, aggregate_function] = JSON.parse(raw) as [string, string | null, AggregateFn];
    return { group_by, aggregate_on, aggregate_function };
  } catch {
    return null;
  }
}
export const groupToParam = (s: GroupBySettings | null) => (s ? JSON.stringify([s.group_by, s.aggregate_on ?? null, s.aggregate_function]) : "");
