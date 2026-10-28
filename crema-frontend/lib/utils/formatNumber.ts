/** Number formatting for charts, cards and lists (Desk: frappe.format / shorten_number). */

const cache = new Map<string, Intl.NumberFormat>();
/** Intl.NumberFormat is expensive to build — share one instance per option set */
export function numberFormat(options: Intl.NumberFormatOptions = {}, locale = "en"): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "–";
  return numberFormat({ notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatValue(n: number, fieldtype?: string, currency?: string | null): string {
  if (!Number.isFinite(n)) return "–";
  if (fieldtype === "Currency" && currency) {
    try {
      return numberFormat({ style: "currency", currency, maximumFractionDigits: 2 }).format(n);
    } catch {
      /* unknown ISO code — fall through */
    }
  }
  if (fieldtype === "Percent") return `${numberFormat({ maximumFractionDigits: 1 }).format(n)}%`;
  if (fieldtype === "Int") return numberFormat({ maximumFractionDigits: 0 }).format(n);
  return numberFormat({ maximumFractionDigits: 2 }).format(n);
}

/** Locale-stable date/time text for client-rendered lists (no server/client drift) */
export function formatDateTime(value: unknown, withTime = true): string {
  if (!value) return "";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (x: number) => String(x).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}
