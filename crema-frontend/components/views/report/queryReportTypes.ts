/**
 * Shared types and pure helpers for the query / script report page
 * (Desk: frappe/public/js/frappe/views/reports/query_report.js).
 */
import { evalDependsOn } from "@/lib/crema-form/dependsOn";
import { formatCell } from "@/lib/list/format";
import type { ChartResult } from "@/lib/hooks/useDashboardChart";
import type { LinkFormatters, ReportColumn, ReportRow } from "@/lib/report/columns";

export interface ReportFilter {
  fieldname: string;
  label?: string;
  fieldtype: string;
  options?: unknown;
  default?: unknown;
  reqd?: unknown;
  hidden?: unknown;
  depends_on?: string;
  on_change?: (report: unknown) => void;
  get_query?: () => unknown;
  get_data?: (txt: string) => unknown;
}

export type Settings = Record<string, unknown> & {
  filters?: ReportFilter[];
  formatter?: (value: unknown, row: unknown, column: unknown, data: unknown, default_formatter: unknown) => string;
  onload?: (report: unknown) => void;
  get_chart_data?: (columns: unknown, result: unknown) => unknown;
  tree?: boolean;
  initial_depth?: number;
  __report?: unknown;
  /** runs a formatter's link_onclick in the report's runtime */
  __eval?: (code: string) => unknown;
  /** frappe.form.link_formatters registered by the app's helpers */
  __linkFormatters?: LinkFormatters;
};

export interface SummaryItem {
  label: string;
  value: unknown;
  datatype?: string;
  indicator?: string;
  color?: string;
  currency?: string;
  type?: string;
}

export interface RunResult {
  columns: ReportColumn[];
  rows: ReportRow[];
  chart: ChartResult | null;
  summary: SummaryItem[];
  message?: string;
  totals: ReportRow | null;
}

export interface InnerButton {
  label: string;
  group?: string;
  action: () => void;
}

export interface PreparedState {
  status?: string;
  name?: string;
}

export interface ReportDocInfo {
  report_type?: string;
  ref_doctype?: string;
  reference_report?: string;
  is_standard?: string;
}

export type FilterValues = Record<string, unknown>;

export const enc = encodeURIComponent;
export const PAGE = 500;
export const SKIP = new Set(["Section Break", "Column Break", "Break", "Tab Break", "HTML", "Button"]);
export const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && (!v.length || v.every((x) => !x)));

/** Desk get_filter_values: drop empties, MultiSelect lists stay arrays */
export function cleanFilters(v: FilterValues) {
  const out: FilterValues = {};
  for (const [k, x] of Object.entries(v)) if (!isEmpty(x) || x === 0) out[k] = x;
  return out;
}

export function selectOptions(options: unknown): Array<{ value: string; label: string }> {
  const list = Array.isArray(options) ? options : String(options ?? "").split("\n");
  return list.map((o) => (typeof o === "object" && o ? { value: String((o as { value?: unknown }).value ?? ""), label: String((o as { label?: unknown }).label ?? (o as { value?: unknown }).value ?? "") } : { value: String(o), label: String(o) }));
}

/** a filter is in play unless its depends_on evaluates false */
export const filterActive = (f: ReportFilter, values: FilterValues) => !f.depends_on || evalDependsOn(f.depends_on, values);

/** utils.js build_summary_item: frappe.format(value, { fieldtype: datatype, options: "currency" }, …, { currency }) */
export function summaryValue(s: SummaryItem, currency: string | undefined, dateFormat: string): string {
  if (s.value == null || s.value === "") return "";
  if (!s.datatype) return String(s.value);
  const df = { fieldtype: s.datatype, options: s.datatype === "Currency" ? "currency" : undefined };
  return formatCell(s.value, df as never, { currency: s.currency ?? currency }, { currency, dateFormat });
}

/** Desk names the PDF after the report and its filter values (capped at 200 chars) */
export function pdfFileName(name: string, applied: FilterValues) {
  const parts: string[] = [];
  let len = 0;
  for (const v of Object.values(applied)) {
    len += String(v).length;
    if (len > 200) break;
    parts.push(String(v));
  }
  return `${name}${parts.length ? `_${parts.join("_")}` : ""}.pdf`;
}

/** query_report.js set_route_filters: ?field=value from frappe.route_options; "[…]" is a multi-select list */
export function routeFilterValue(raw: string, f: ReportFilter): unknown {
  let v: unknown = raw;
  if (raw.startsWith("[")) {
    try {
      v = JSON.parse(raw);
    } catch {
      /* keep the text */
    }
  }
  return f.fieldtype === "MultiSelectList" && !Array.isArray(v) ? [v] : v;
}

/** initial filter values: defaults, then the route's ?field=value */
export function initialFilterValues(filters: ReportFilter[], search: string): FilterValues {
  const init: FilterValues = {};
  for (const f of filters) {
    if (f.default != null && f.default !== "" && typeof f.default !== "function") init[f.fieldname] = f.default;
    else if (f.fieldtype === "Check") init[f.fieldname] = 0;
  }
  const route = new URLSearchParams(search);
  for (const f of filters) {
    const raw = route.get(f.fieldname);
    if (raw != null) init[f.fieldname] = routeFilterValue(raw, f);
  }
  return init;
}

/** indices of rows that have children (a tree report's parent rows) */
export function parentIndices(rows: ReportRow[], minIndent = -Infinity): Set<number> {
  const out = new Set<number>();
  rows.forEach((r, i) => {
    const ind = r.indent ?? 0;
    if (ind >= minIndent && (rows[i + 1]?.indent ?? 0) > ind) out.add(i);
  });
  return out;
}
