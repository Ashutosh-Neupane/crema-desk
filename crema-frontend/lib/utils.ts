import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class merge helper (shadcn standard). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Frappe value coercion (0/1 -> boolean, etc.)
// ---------------------------------------------------------------------------

export function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true" || v === "True";
}

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

export function titleCase(s: string): string {
  if (!s) return "";
  // Handle snake/kebab + preserve known acronyms lightly
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

export function truncate(s: string, n = 40): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Dates (date-fns)
// ---------------------------------------------------------------------------

import { format, formatDistanceToNow, parseISO } from "date-fns";

export function fmtDate(value?: string | null, pattern = "dd MMM yyyy"): string {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? parseISO(value) : value;
    if (isNaN(d.getTime())) return String(value);
    return format(d, pattern);
  } catch {
    return String(value);
  }
}

export function fmtDateTime(value?: string | null): string {
  return fmtDate(value, "dd MMM yyyy HH:mm");
}

export function fmtTime(value?: string | null): string {
  if (!value) return "";
  // value may be "HH:mm:ss" or "HH:mm"
  const parts = String(value).split(":");
  if (parts.length < 2) return String(value);
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return String(value);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return format(date, "HH:mm");
}

export function fmtRelative(value?: string | null): string {
  if (!value) return "";
  try {
    const d = parseISO(value);
    if (isNaN(d.getTime())) return String(value);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return String(value);
  }
}

/** Convert an ISO/Date to the value an <input type="datetime-local"> expects: yyyy-MM-ddTHH:mm */
export function toDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  try {
    const d = parseISO(value);
    if (isNaN(d.getTime())) return "";
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

export function toDateInput(value?: string | null): string {
  if (!value) return "";
  try {
    const d = parseISO(value);
    if (isNaN(d.getTime())) return "";
    return format(d, "yyyy-MM-dd");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Numbers / currency
// ---------------------------------------------------------------------------

export function formatNumber(value: unknown, precision?: number): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(n)) return String(value);
  const p = precision ?? (Number.isInteger(n) ? 0 : 2);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: p,
    maximumFractionDigits: p,
  });
}

export function formatCurrency(value: unknown, symbol = "", precision = 2): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  if (isNaN(n)) return String(value ?? "");
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  return symbol ? `${symbol} ${formatted}` : formatted;
}

// ---------------------------------------------------------------------------
// Frappe helpers
// ---------------------------------------------------------------------------

/** Frappe stores many booleans as 0/1. Convert to a checkbox value. */
export function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

/** Frappe Select `options` is newline-separated. Split + trim + drop empties. */
export function parseSelectOptions(options?: string | null): string[] {
  if (!options) return [];
  return options
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
}

export const DOC_STATUS = {
  0: { label: "Draft", tone: "blue" as const },
  1: { label: "Submitted", tone: "green" as const },
  2: { label: "Cancelled", tone: "red" as const },
};

export function docStatusLabel(docstatus: number): string {
  return DOC_STATUS[docstatus as 0 | 1 | 2]?.label ?? String(docstatus);
}

/** Encode Frappe filter array for the REST querystring. */
export function encodeFilters(filters?: unknown[]): string | undefined {
  if (!filters || filters.length === 0) return undefined;
  return JSON.stringify(filters);
}

/** Safely parse Frappe `_server_messages` (a JSON string of JSON strings). */
export function parseServerMessages(serverMessages?: string | null): string[] {
  if (!serverMessages) return [];
  try {
    const arr = JSON.parse(serverMessages);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((m) => {
        try {
          const obj = typeof m === "string" ? JSON.parse(m) : m;
          return obj?.message ?? obj?.indicator ?? null;
        } catch {
          return String(m);
        }
      })
      .filter(Boolean) as string[];
  } catch {
    return [];
  }
}

/** Debounce helper for search inputs. */
export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 300) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
