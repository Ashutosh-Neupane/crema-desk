/** Number formatting for charts, cards and lists (Desk: frappe.format / shorten_number). */

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatValue(n: number, fieldtype?: string, currency?: string | null): string {
  if (!Number.isFinite(n)) return "–";
  if (fieldtype === "Currency" && currency) {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
    } catch {
      /* unknown ISO code — fall through */
    }
  }
  if (fieldtype === "Percent") return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n)}%`;
  if (fieldtype === "Int") return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(n);
}
