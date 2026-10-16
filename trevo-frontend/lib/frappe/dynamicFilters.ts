/**
 * Dashboard Chart / Number Card `dynamic_filters_json` — Desk evals these JS
 * snippets in the browser (e.g. `frappe.defaults.get_user_default("Company")`).
 * We don't execute stored code; instead the known expression shapes are
 * interpreted against the desk boot. Unknown expressions resolve to
 * `undefined` and the filter is dropped (same outcome as an empty default).
 */
import type { DeskBoot } from "./deskBoot";

export interface DynamicContext {
  defaults: Record<string, unknown>;
  /** [name, start, end] from boot.current_fiscal_year */
  fiscalYear?: [string, string, string] | null;
  today: string;
}

export function dynamicContextFromBoot(boot: DeskBoot | null): DynamicContext {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const user = (boot?.user ?? {}) as { defaults?: Record<string, unknown> };
  const fy = boot?.current_fiscal_year as unknown;
  return {
    defaults: user.defaults ?? {},
    fiscalYear: Array.isArray(fy) && fy.length >= 3 ? (fy.map(String) as [string, string, string]) : null,
    today: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  };
}

function shift(date: string, months: number, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  if (months) d.setMonth(d.getMonth() + months);
  if (days) d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TODAY = String.raw`frappe\.datetime\.(?:nowdate|now_date|get_today)\(\)`;

export function resolveDynamicValue(expr: unknown, ctx: DynamicContext): unknown {
  if (typeof expr === "number") return expr;
  const e = String(expr ?? "").trim();
  if (!e) return undefined;
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);

  const userDefault = e.match(/^frappe\.defaults\.get_(?:user_)?default\(\s*["'`]([^"'`]+)["'`]\s*\)$/);
  if (userDefault) {
    const key = userDefault[1];
    const hit = Object.entries(ctx.defaults).find(([k]) => k.toLowerCase() === key.toLowerCase());
    const v = hit?.[1];
    return Array.isArray(v) ? v[0] : v ?? undefined;
  }
  if (new RegExp(`^${TODAY}$`).test(e)) return ctx.today;
  const addMonths = e.match(new RegExp(`^frappe\\.datetime\\.add_months\\(\\s*${TODAY}\\s*,\\s*(-?\\d+)\\s*\\)$`));
  if (addMonths) return shift(ctx.today, Number(addMonths[1]), 0);
  const addDays = e.match(new RegExp(`^frappe\\.datetime\\.add_days\\(\\s*${TODAY}\\s*,\\s*(-?\\d+)\\s*\\)$`));
  if (addDays) return shift(ctx.today, 0, Number(addDays[1]));
  if (/^(erpnext\.utils\.get_fiscal_year\(\)|frappe\.sys_defaults\.fiscal_year)$/.test(e)) {
    return ctx.fiscalYear?.[0] ?? ctx.defaults.fiscal_year ?? undefined;
  }
  // (frappe.boot.current_fiscal_year || [...]).slice(1) → [start, end]
  if (e.includes("current_fiscal_year") && e.endsWith(".slice(1)")) {
    if (ctx.fiscalYear) return [ctx.fiscalYear[1], ctx.fiscalYear[2]];
    const y = ctx.today.slice(0, 4);
    return [`${y}-01-01`, `${y}-12-31`];
  }
  return undefined;
}

/**
 * Merge resolved dynamic filters into static filters. Handles both shapes Frappe
 * uses: dict (report charts: { company: "…" }) and list ([[dt, field, op, value]]).
 */
export function applyDynamicFilters(
  staticFilters: unknown,
  dynamicJson: unknown,
  ctx: DynamicContext,
): Record<string, unknown> | unknown[] {
  let dyn: unknown = dynamicJson;
  if (typeof dyn === "string") {
    try {
      dyn = dyn ? JSON.parse(dyn) : null;
    } catch {
      dyn = null;
    }
  }
  if (Array.isArray(staticFilters) || Array.isArray(dyn)) {
    const out = Array.isArray(staticFilters) ? [...staticFilters] : [];
    for (const f of Array.isArray(dyn) ? dyn : []) {
      if (!Array.isArray(f) || f.length < 4) continue;
      const v = resolveDynamicValue(f[3], ctx);
      if (v !== undefined && v !== null && v !== "") out.push([f[0], f[1], f[2], v]);
    }
    return out;
  }
  const out: Record<string, unknown> = { ...((staticFilters as Record<string, unknown>) ?? {}) };
  for (const [k, expr] of Object.entries((dyn as Record<string, unknown>) ?? {})) {
    const v = resolveDynamicValue(expr, ctx);
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}
