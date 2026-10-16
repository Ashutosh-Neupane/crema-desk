/** Cell formatting for list/report views (Desk: frappe.format with doc context). */
import type { DocField } from "@/lib/frappe/types";

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDate(v: unknown, dateFormat = "yyyy-mm-dd"): string {
  if (!v) return "";
  const s = String(v);
  const [y, m, d] = s.slice(0, 10).split("-");
  if (!y || !m || !d) return s;
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

export function formatCell(
  value: unknown,
  df: Pick<DocField, "fieldtype" | "options" | "precision">,
  doc: Record<string, unknown>,
  ctx: { currency?: string; dateFormat?: string } = {},
): string {
  if (value === null || value === undefined || value === "") return "";
  switch (df.fieldtype) {
    case "Currency": {
      const opt = typeof df.options === "string" ? df.options : "";
      const cur = (opt && (typeof doc[opt] === "string" ? (doc[opt] as string) : opt.includes(":") ? "" : undefined)) || (doc.currency as string) || ctx.currency;
      const n = Number(value);
      try {
        return cur ? new Intl.NumberFormat("en", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n) : n.toLocaleString("en", { maximumFractionDigits: 2 });
      } catch {
        return `${cur ?? ""} ${n.toLocaleString("en", { maximumFractionDigits: 2 })}`.trim();
      }
    }
    case "Float":
      return Number(value).toLocaleString("en", { maximumFractionDigits: typeof df.precision === "number" ? df.precision : 3 });
    case "Int":
      return Number(value).toLocaleString("en", { maximumFractionDigits: 0 });
    case "Percent":
      return `${Number(value).toLocaleString("en", { maximumFractionDigits: 1 })}%`;
    case "Check":
      return Number(value) ? "✓" : "";
    case "Date":
      return formatDate(value, ctx.dateFormat);
    case "Datetime": {
      const s = String(value);
      return `${formatDate(s, ctx.dateFormat)} ${s.slice(11, 16)}`.trim();
    }
    case "Time":
      return String(value).slice(0, 5);
    case "Rating":
      return "★".repeat(Math.round(Number(value) * 5));
    case "Text Editor":
    case "HTML Editor":
    case "Small Text":
    case "Text":
    case "Long Text":
      return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    default:
      return String(value);
  }
}

export { pad };
