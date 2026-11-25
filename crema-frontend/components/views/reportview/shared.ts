/** Shared types and constants for the report view (Desk: frappe/public/js/frappe/views/reports/report_view.js). */
import type { Filter } from "@/lib/list/api";
import type { DocField } from "@/lib/frappe/types";
import type { GroupBySettings } from "@/lib/report/groupBy";

/** [fieldname, doctype] — Desk's report view field tuple */
export type Col = [string, string];
export type Row = Record<string, unknown> & { name: string };
export interface ReportSettings {
  fields?: Col[];
  filters?: Filter[];
  order_by?: string;
  add_totals_row?: 0 | 1;
  page_length?: number;
  /** Desk's format ("`tabX`.`field`"); older Crema settings hold plain field names */
  group_by?: Partial<GroupBySettings> | null;
}
export interface ViewCol {
  col: Col;
  df: DocField;
  k: string;
}

export const enc = encodeURIComponent;
export const NUMERIC = new Set(["Currency", "Float", "Int", "Percent"]);
export const EDITABLE = new Set(["Data", "Int", "Float", "Currency", "Percent", "Select", "Link", "Date", "Check", "Small Text", "Text", "Long Text", "Phone", "Duration"]);
export const STD: Record<string, Partial<DocField>> = {
  name: { label: "ID", fieldtype: "Link" },
  owner: { label: "Created By", fieldtype: "Link", options: "User" },
  creation: { label: "Created On", fieldtype: "Datetime" },
  modified: { label: "Last Updated On", fieldtype: "Datetime" },
  modified_by: { label: "Last Updated By", fieldtype: "Link", options: "User" },
  docstatus: { label: "Document Status", fieldtype: "Int" },
  idx: { label: "Index", fieldtype: "Int" },
};
export const colKey = (c: Col, doctype: string) => (c[1] === doctype ? c[0] : `${c[1]}:${c[0]}`);
export const sqlCol = (c: Col) => `\`tab${c[1]}\`.\`${c[0]}\``;
export const sameCol = (a: Col, b: Col) => a[0] === b[0] && a[1] === b[1];
export const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
export const primaryBtn = "inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900";
