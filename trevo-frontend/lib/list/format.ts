/** Cell formatting for list/report views (Desk: frappe.format with doc context). */
import type { DocField } from "@/lib/frappe/types";
import { formatValue, strToUser } from "@/lib/frappe/format";

const pad = (n: number) => String(n).padStart(2, "0");

/** a yyyy-mm-dd value in the site's date format (`dateFormat` overrides it) */
export function formatDate(v: unknown, dateFormat?: string): string {
  if (!v) return "";
  if (!dateFormat) return strToUser(String(v).slice(0, 10), false, true);
  const [y, m, d] = String(v).slice(0, 10).split("-");
  if (!y || !m || !d) return String(v);
  return dateFormat.replace("yyyy", y).replace("mm", m).replace("dd", d);
}

export function timeAgo(v: unknown): string {
  if (!v) return "";
  const t = new Date(String(v).replace(" ", "T")).getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)} m`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))} mo`;
  return `${Math.floor(s / (86400 * 365))} y`;
}

/** Desk's frappe.format for list/report/grid cells, from the site's settings (lib/frappe/format.ts) */
export function formatCell(
  value: unknown,
  df: Pick<DocField, "fieldtype" | "options" | "precision">,
  doc: Record<string, unknown>,
  ctx: { currency?: string; dateFormat?: string } = {},
): string {
  if (value === null || value === undefined || value === "") return "";
  return formatValue(value, df, doc, { currency: ctx.currency });
}

export { pad };
