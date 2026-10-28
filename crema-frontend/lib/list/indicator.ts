/**
 * Status indicator — port of Desk's frappe.get_indicator (model/indicator.js):
 * workflow state → Draft/Cancelled for submittables → listview_settings.get_indicator
 * (the app's own __list_js) → Submitted → status (guess_colour) → enabled/disabled.
 * Returns [label, color, filter "field,op,value|…"] like Desk.
 */
import type { DocTypeMeta } from "@/lib/frappe/types";
import { guessColour } from "@/lib/desk-runtime";

export type Indicator = [label: string, color: string, filter?: string];

export function getIndicator(
  doc: Record<string, unknown>,
  meta: DocTypeMeta,
  settings: Record<string, unknown> | undefined,
): Indicator | null {
  const has = (f: string) => (meta.fields ?? []).some((x) => x.fieldname === f);
  const submittable = !!meta.is_submittable;
  const ds = Number(doc.docstatus ?? 0);

  if (typeof doc.workflow_state === "string" && doc.workflow_state) return [doc.workflow_state, "gray", `workflow_state,=,${doc.workflow_state}`];
  if (submittable && ds === 0 && !settings?.has_indicator_for_draft) return ["Draft", "red", "docstatus,=,0"];
  if (submittable && ds === 2 && !settings?.has_indicator_for_cancelled) return ["Cancelled", "red", "docstatus,=,2"];

  const states = (meta as { states?: Array<{ title: string; color: string }> }).states;
  const state = typeof doc.status === "string" ? states?.find((s) => s.title === doc.status) : undefined;
  if (state) return [state.title, state.color.toLowerCase().replace(/\s+/g, "-"), `status,=,${state.title}`];

  if (typeof settings?.get_indicator === "function") {
    try {
      const ind = (settings.get_indicator as (d: unknown) => unknown)(doc);
      if (Array.isArray(ind) && ind.length >= 2) return [String(ind[0]), String(ind[1]), ind[2] ? String(ind[2]) : undefined];
    } catch {
      /* app indicator failed — fall back to defaults */
    }
  }
  if (submittable && ds === 1) return ["Submitted", "blue", "docstatus,=,1"];
  if (typeof doc.status === "string" && doc.status) return [doc.status, guessColour(doc.status), `status,=,${doc.status}`];
  if (has("enabled")) return doc.enabled ? ["Enabled", "blue", "enabled,=,1"] : ["Disabled", "gray", "enabled,=,0"];
  if (has("disabled")) return doc.disabled ? ["Disabled", "gray", "disabled,=,1"] : ["Enabled", "blue", "disabled,=,0"];
  return null;
}

/** Desk indicator colors → pill classes (light + dark) */
export const INDICATOR_PILL: Record<string, string> = {
  red: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  yellow: "bg-yellow-50 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300",
  green: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  "light-blue": "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  cyan: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  pink: "bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
  gray: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  darkgrey: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
  black: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
};

/** Parse Desk's indicator filter "a,=,1|b,<,100" into filter tuples */
export function indicatorFilters(doctype: string, f?: string): Array<[string, string, string, unknown]> {
  if (!f) return [];
  return f.split("|").map((part) => {
    const [field, op, ...rest] = part.split(",");
    return [doctype, field, op, rest.join(",")];
  });
}
