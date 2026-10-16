/**
 * List data — the endpoints Desk's list view uses (frappe/public/js/frappe/list/base_list.js):
 *   frappe.desk.reportview.get          rows (compressed keys/values)
 *   frappe.desk.reportview.get_count    total
 *   frappe.desk.listview.get_group_by_count   sidebar counts
 *   frappe.desk.reportview.delete_items        bulk delete
 *   frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs
 */
import { deskCall } from "@/lib/frappe/form";

/** [doctype, fieldname, operator, value] — Frappe's filter tuple */
export type Filter = [string, string, string, unknown];

export interface ListQuery {
  doctype: string;
  fields: string[];
  filters: Filter[];
  orderBy: string;
  start: number;
  pageLength: number;
}

export type Row = Record<string, unknown> & { name: string };

const q = (doctype: string, field: string) => (field.includes("`") || field.includes("(") ? field : `\`tab${doctype}\`.\`${field}\``);

export async function fetchRows({ doctype, fields, filters, orderBy, start, pageLength }: ListQuery): Promise<Row[]> {
  const { env } = await deskCall("frappe.desk.reportview.get", {
    doctype,
    fields: JSON.stringify([...new Set(fields)].map((f) => q(doctype, f))),
    filters: JSON.stringify(filters),
    order_by: orderBy,
    start,
    page_length: pageLength,
    view: "List",
    with_comment_count: 1,
  });
  const msg = env.message as { keys?: string[]; values?: unknown[][] } | Row[] | undefined;
  if (Array.isArray(msg)) return msg;
  const keys = msg?.keys ?? [];
  return (msg?.values ?? []).map((vals) => Object.fromEntries(keys.map((k, i) => [k, vals[i]])) as Row);
}

export async function fetchCount(doctype: string, filters: Filter[]): Promise<number> {
  const { env } = await deskCall("frappe.desk.reportview.get_count", { doctype, filters: JSON.stringify(filters) });
  return Number(env.message ?? 0);
}

export async function fetchGroupByCount(doctype: string, filters: Filter[], field: string): Promise<Array<{ name: string | null; count: number; title?: string }>> {
  const { env } = await deskCall("frappe.desk.listview.get_group_by_count", {
    doctype,
    current_filters: JSON.stringify(filters),
    field,
  });
  return (env.message as Array<{ name: string | null; count: number; title?: string }>) ?? [];
}

export async function deleteRows(doctype: string, names: string[]): Promise<void> {
  await deskCall("frappe.desk.reportview.delete_items", { items: JSON.stringify(names), doctype });
}

export async function submitOrCancelRows(doctype: string, names: string[], action: "submit" | "cancel"): Promise<unknown> {
  const { env } = await deskCall("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", {
    doctype,
    action,
    docnames: JSON.stringify(names),
  });
  return env.message;
}
