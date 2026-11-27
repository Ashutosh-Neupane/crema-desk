/**
 * Data for the dynamic home's cards (docs/PHASE2_DESIGN.md § 4.1.5), from Frappe's own whitelisted methods, so
 * every list applies the user's permissions on the server:
 *
 * - Number Cards / Dashboard Charts: `frappe.client.get_list`; both DocTypes have permission query conditions
 *   (number_card.py / dashboard_chart.py: DocType read, allowed report, allowed module), and private ones only for
 *   their owner.
 * - Status counts ("Auto KPI"): `frappe.desk.listview.get_group_by_count` on the DocType's `status` field, the same
 *   call Desk's list sidebar makes.
 * - Today: `frappe.desk.doctype.event.event.get_events` (Desk's calendar source: own, shared and public events,
 *   repeats expanded) for today and the next 7 days.
 */
import { frappeMethod } from "@/lib/frappe/client";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import { doctypeUrl } from "@/lib/navigation/deskUrl";
import { localDay } from "./data";

type Row = Record<string, unknown>;

const list = (doctype: string, args: Row) => frappeMethod<Row[]>("frappe.client.get_list", { doctype, ...args }).then((r) => (Array.isArray(r) ? r : []));

export interface CardRef {
  name: string;
  label: string;
  doctype: string;
}

const visibleTo = (user: string) => [["is_public", "=", 1], ["owner", "=", user]];

/** Number Cards on the given DocTypes the user may see, in the DocTypes' order */
export async function fetchNumberCards(user: string, doctypes: string[]): Promise<CardRef[]> {
  if (!doctypes.length) return [];
  const rows = await list("Number Card", {
    fields: ["name", "label", "document_type"],
    filters: [["document_type", "in", doctypes]],
    or_filters: visibleTo(user),
    limit_page_length: 100,
  });
  return byDoctypeOrder(rows.map((r) => ({ name: String(r.name), label: String(r.label || r.name), doctype: String(r.document_type) })), doctypes);
}

/** Dashboard Charts on the given DocTypes the user may see, in the DocTypes' order */
export async function fetchCharts(user: string, doctypes: string[]): Promise<CardRef[]> {
  if (!doctypes.length) return [];
  const rows = await list("Dashboard Chart", {
    fields: ["name", "chart_name", "document_type"],
    filters: [["document_type", "in", doctypes]],
    or_filters: visibleTo(user),
    limit_page_length: 100,
  });
  return byDoctypeOrder(rows.map((r) => ({ name: String(r.name), label: String(r.chart_name || r.name), doctype: String(r.document_type) })), doctypes);
}

function byDoctypeOrder(cards: CardRef[], doctypes: string[]): CardRef[] {
  const rank = new Map(doctypes.map((d, i) => [d, i]));
  return cards.sort((a, b) => (rank.get(a.doctype) ?? 99) - (rank.get(b.doctype) ?? 99) || a.label.localeCompare(b.label));
}

export interface StatusCount {
  status: string;
  count: number;
  href: string;
}

/** Open documents per status, when the DocType has a `status` Select field; null when it has none */
export async function fetchStatusCounts(doctype: string): Promise<StatusCount[] | null> {
  const meta = await fetchDoctypeMetaClient(doctype);
  const field = meta.fields?.find((f) => f.fieldname === "status" && f.fieldtype === "Select");
  if (!field) return null;
  // cancelled documents aren't work; Desk's sidebar counts everything, the home counts what is still live
  const filters = meta.is_submittable ? [[doctype, "docstatus", "<", 2]] : [];
  const rows = await frappeMethod<Array<{ name: string; count: number }>>("frappe.desk.listview.get_group_by_count", {
    doctype,
    current_filters: JSON.stringify(filters),
    field: "status",
  });
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r.name && r.count > 0)
    .slice(0, 4)
    .map((r) => ({ status: String(r.name), count: Number(r.count), href: `${doctypeUrl(doctype)}?status=${encodeURIComponent(String(r.name))}` }));
}

export interface EventItem {
  name: string;
  subject: string;
  start: string;
  allDay: boolean;
}

export async function fetchEvents(days = 7): Promise<EventItem[]> {
  const rows = await frappeMethod<Row[]>("frappe.desk.doctype.event.event.get_events", { start: localDay(0), end: localDay(days) });
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({ name: String(r.name), subject: String(r.subject || r.name), start: String(r.starts_on ?? ""), allDay: !!Number(r.all_day) }))
    .filter((e) => e.start)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 8);
}
