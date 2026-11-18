/**
 * "Filtered by: …" line under a Link field's suggestions (Desk form/controls/link.js get_filter_description):
 * the set_query / link filters turned into words, e.g. `Filtered by: Customer Group equals "Retail" and is enabled.`
 */
import type { DocField, DocTypeMeta } from "./types";

type Filter = [string, string, string, unknown];

/** Desk filters come as {field: value | [op, value]} or [[field, op, value]] / [[doctype, field, op, value]] */
export function toFilterArray(doctype: string, filters: unknown): Filter[] {
  if (!filters) return [];
  if (Array.isArray(filters)) {
    return filters
      .filter((f): f is unknown[] => Array.isArray(f) && f.length >= 3)
      .map((f) => (f.length === 3 ? ([doctype, f[0], f[1], f[2]] as Filter) : ([f[0], f[1], f[2], f[3]] as Filter)));
  }
  if (typeof filters === "object") {
    return Object.entries(filters as Record<string, unknown>).map(([fieldname, v]) =>
      Array.isArray(v) ? ([doctype, fieldname, String(v[0]), v[1]] as Filter) : ([doctype, fieldname, "=", v] as Filter),
    );
  }
  return [];
}

/** frappe.model.unscrub */
const unscrub = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** frappe.utils.comma_and */
export const commaAnd = (parts: string[]) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);

function show(df: DocField | undefined, v: unknown): string {
  if (df?.fieldtype === "Check") return v == 1 || v === true ? "Yes" : "No";
  if (Array.isArray(v)) {
    const vals = v.filter((x) => x != null && x !== "");
    const out = vals.slice(0, 5).map((x) => (typeof x === "string" ? `"${x}"` : String(x)));
    if (vals.length > 5) out.push("...");
    return out.join(", ");
  }
  if (v == null || v === "") return "empty";
  return typeof v === "string" ? `"${v}"` : String(v);
}

function describe([, fieldname, operator, value]: Filter, meta?: DocTypeMeta): string {
  const df = meta?.fields?.find((f) => f.fieldname === fieldname);
  const label = df?.label || unscrub(fieldname);
  const check = df?.fieldtype === "Check";
  const timeLike = ["Date", "Datetime", "Time"].includes(df?.fieldtype ?? "");
  const v = show(df, value);
  const on = value == 1 || value === true;
  switch (operator) {
    case "=":
      if (check) {
        if (fieldname === "enabled") return on ? "is enabled" : "is disabled";
        if (fieldname === "disabled") return on ? "is disabled" : "is enabled";
        return on ? `${label} is enabled` : `${label} is disabled`;
      }
      return `${label} equals ${v}`;
    case "!=":
      if (check) {
        if (fieldname === "enabled") return on ? "is disabled" : "is enabled";
        if (fieldname === "disabled") return on ? "is enabled" : "is disabled";
        return on ? `${label} is disabled` : `${label} is enabled`;
      }
      return `${label} is not equal to ${v}`;
    case "in":
      return `${label} is one of ${v}`;
    case "not in":
      return `${label} is not one of ${v}`;
    case "like":
      return `${label} contains ${v}`;
    case "not like":
      return `${label} does not contain ${v}`;
    case ">":
      return timeLike ? `${label} is after ${v}` : `${label} is greater than ${v}`;
    case "<":
      return timeLike ? `${label} is before ${v}` : `${label} is less than ${v}`;
    case ">=":
      return timeLike ? `${label} is on or after ${v}` : `${label} is greater than or equal to ${v}`;
    case "<=":
      return timeLike ? `${label} is on or before ${v}` : `${label} is less than or equal to ${v}`;
    case "is":
      if (value === "set") return `${label} is set`;
      if (value === "not set") return `${label} is not set`;
      return `${label} is ${v}`;
    case "between":
      return Array.isArray(value) && value.length === 2 ? `${label} is between ${show(df, value[0])} and ${show(df, value[1])}` : `${label} is between ${v}`;
    case "descendants of":
      return `${label} is a descendant of ${v}`;
    case "ancestors of":
      return `${label} is an ancestor of ${v}`;
    case "not descendants of":
      return `${label} is not a descendant of ${v}`;
    case "not ancestors of":
      return `${label} is not an ancestor of ${v}`;
    case "timespan":
      return `${label} is within ${v}`;
    default:
      return [label, operator, v].join(" ");
  }
}

/** labels come from the linked DocType's meta (filters on other doctypes fall back to the unscrubbed fieldname) */
export function describeFilters(doctype: string, filters: unknown, meta?: DocTypeMeta): string | null {
  const arr = toFilterArray(doctype, filters);
  if (!arr.length) return null;
  return `Filtered by: ${commaAnd(arr.map((f) => describe(f, f[0] === doctype ? meta : undefined)))}.`;
}

/**
 * A Link field's `link_filters` (Customize Form → field → Filters, Desk link.js apply_link_field_filters):
 * JSON [[doctype, fieldname, operator, value]]; a value "eval:<expr>" is computed with doc / parent / frappe.
 * Merged over the set_query filters: a link filter replaces a set_query filter on the same field.
 */
export function applyLinkFilters(doctype: string, filters: unknown, linkFilters: unknown, doc?: Record<string, unknown>): unknown {
  if (!linkFilters || typeof linkFilters !== "string") return filters;
  let parsed: unknown;
  try {
    parsed = JSON.parse(linkFilters);
  } catch {
    console.error("Invalid link_filters JSON:", linkFilters);
    return filters;
  }
  if (!Array.isArray(parsed) || !parsed.length) return filters;
  const g = globalThis as unknown as { frappe?: unknown; cur_frm?: { doc?: unknown } };
  const lf: Record<string, [string, unknown]> = {};
  for (const f of parsed) {
    if (!Array.isArray(f)) continue;
    const [, fieldname, operator] = f as [unknown, string, string];
    let value: unknown = f[3];
    if (typeof value === "string" && value.startsWith("eval:")) {
      try {
        // site-defined expression, evaluated like Desk's frappe.utils.eval (same as depends_on in dependsOn.ts)
        // eslint-disable-next-line no-new-func
        value = new Function("doc", "parent", "frappe", `"use strict"; return (${value.slice(5)});`)(doc ?? {}, doc?.parenttype ? (g.cur_frm?.doc ?? null) : null, g.frappe);
      } catch (e) {
        console.error("link_filters eval failed:", value, e);
        value = undefined;
      }
    }
    lf[fieldname] = [operator, value];
  }
  if (Array.isArray(filters)) {
    const names = Object.keys(lf);
    return (filters as unknown[][])
      .filter((f) => {
        const [fdt, fn] = f.length >= 4 ? f : [doctype, f[0]];
        return fdt !== doctype || !names.includes(String(fn));
      })
      .concat(names.map((n) => [n, ...lf[n]]));
  }
  return { ...((filters as Record<string, unknown>) ?? {}), ...lf };
}
