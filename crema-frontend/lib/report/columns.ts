/** Query report helpers (Desk: frappe/public/js/frappe/views/reports/query_report.js). */
import { formatCell } from "@/lib/list/format";
import type { ChartResult } from "@/lib/hooks/useDashboardChart";

export interface ReportColumn {
  fieldname: string;
  label: string;
  fieldtype: string;
  options?: string;
  width?: number;
  hidden?: boolean;
  precision?: number;
  [key: string]: unknown;
}

export type ReportRow = Record<string, unknown> & { indent?: number };

const scrub = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
export const NUMERIC = new Set(["Currency", "Float", "Int", "Percent"]);

/** "Label:Fieldtype/Options:Width" or a column dict → ReportColumn (Desk: prepare_columns) */
export function normalizeColumns(raw: unknown[]): ReportColumn[] {
  return (raw ?? []).filter(Boolean).map((c) => {
    if (typeof c === "string") {
      const [label = "", type = "Data", width] = c.split(":");
      const [fieldtype, options] = type.split("/");
      return { label, fieldname: scrub(label), fieldtype: fieldtype || "Data", options, width: width ? Number(width) : undefined };
    }
    const col = c as Record<string, unknown>;
    const label = String(col.label ?? col.fieldname ?? "");
    return {
      ...col,
      label,
      fieldname: String(col.fieldname ?? scrub(label)),
      fieldtype: String(col.fieldtype ?? "Data"),
      options: col.options == null ? undefined : String(col.options),
      width: col.width ? Number(col.width) : undefined,
      hidden: !!col.hidden,
    };
  });
}

/** Rows may arrive as arrays (old-style script reports) → objects keyed by fieldname */
export function normalizeRows(raw: unknown[], columns: ReportColumn[]): ReportRow[] {
  return (raw ?? []).filter((r) => r != null).map((r) => {
    if (!Array.isArray(r)) return r as ReportRow;
    const o: ReportRow = {};
    columns.forEach((c, i) => (o[c.fieldname] = r[i]));
    return o;
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** Desk default_formatter → HTML (Link columns become form links) */
export function defaultFormatter(value: unknown, column: ReportColumn, data: ReportRow | undefined, ctx: { currency?: string; dateFormat?: string }) {
  if (value == null || value === "") return "";
  // ERPNext summary rows ('Opening', 'Total') — its financial formatter unquotes and bolds them
  if (typeof value === "string" && /^'.+'$/.test(value)) return `<b>${esc(value.slice(1, -1))}</b>`;
  if (column.fieldtype === "Link" && column.options) {
    const v = String(value);
    return `<a href="/desk/doctype/${encodeURIComponent(column.options)}/${encodeURIComponent(v)}">${esc(v)}</a>`;
  }
  if (column.fieldtype === "Dynamic Link" && column.options && data?.[column.options]) {
    const v = String(value);
    return `<a href="/desk/doctype/${encodeURIComponent(String(data[column.options]))}/${encodeURIComponent(v)}">${esc(v)}</a>`;
  }
  if (column.fieldtype === "Currency" && column.options && data && !data[column.options] && !/^[A-Z]{3}$/.test(column.options)) {
    // options names a currency field missing on this row → company currency
    return esc(formatCell(value, { ...column, options: "" }, data ?? {}, ctx));
  }
  if (column.fieldtype === "HTML") return String(value);
  return esc(formatCell(value, column as never, data ?? {}, ctx));
}

/** Formatter output comes from site JS; keep markup, drop anything executable */
export function sanitizeHtml(html: string): string {
  if (!/[<&]/.test(html)) return html;
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]+>/g, "");
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta,form").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name) || (/^(href|src|xlink:href|action)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
    }
  });
  return doc.body.firstElementChild?.innerHTML ?? "";
}

/** Report chart ({ data: { labels, datasets }, type, fieldtype }) → DeskChart input */
export function toChartResult(chart: unknown, name: string): ChartResult | null {
  const c = chart as { data?: { labels?: unknown[]; datasets?: Array<{ name?: string; values?: unknown[] }> }; type?: string; fieldtype?: string } | null;
  if (!c?.data?.labels?.length || !c.data.datasets?.length) return null;
  const type = c.type === "axis-mixed" ? "bar" : String(c.type ?? "bar");
  return {
    name,
    type,
    chart_type: "Report",
    labels: c.data.labels.map(String),
    datasets: c.data.datasets.map((d, i) => ({ name: d.name ?? `Series ${i + 1}`, values: (d.values ?? []).map((v) => Number(v) || 0) })),
    fieldtype: c.fieldtype,
  };
}

export function toCsv(rows: ReportRow[], columns: ReportColumn[]): string {
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(r[c.fieldname])).join(","))].join("\n");
}
