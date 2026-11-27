/**
 * The facts the New layout's form summary shows (components/form/SummaryCard.tsx; docs/PHASE2_DESIGN.md § 4.3), from the
 * meta with no per-DocType code: fields marked "In Preview" (the ones Desk's link preview shows, ui/link_preview.js),
 * else the list-view fields, bold ones first. Not the title or the status, which the form header shows.
 */
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

const MAX = 6;
const VALUE_TYPES = new Set(["Data", "Link", "Dynamic Link", "Select", "Date", "Datetime", "Time", "Currency", "Float", "Int", "Percent", "Phone", "Read Only", "Duration", "Rating"]);
const NOT_FACTS = new Set(["status", "workflow_state", "naming_series", "docstatus"]);
export const AMOUNT_TYPES = new Set(["Currency", "Float", "Int", "Percent"]);

export function summaryFields(meta: DocTypeMeta, visible: (df: DocField) => boolean = () => true): DocField[] {
  const usable = (meta.fields ?? []).filter((f) => VALUE_TYPES.has(f.fieldtype) && !f.hidden && f.fieldname !== meta.title_field && !NOT_FACTS.has(f.fieldname) && visible(f));
  const preview = usable.filter((f) => !!f.in_preview);
  if (preview.length) return preview.slice(0, MAX);
  const listed = usable.filter((f) => !!f.in_list_view);
  return [...listed.filter((f) => !!f.bold), ...listed.filter((f) => !f.bold)].slice(0, MAX);
}

/** a summary fact worth showing: has a value (an amount of 0 counts as none, a count of 0 doesn't) */
export function hasFact(df: DocField, v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  return !(AMOUNT_TYPES.has(df.fieldtype) && df.fieldtype !== "Int" && Number(v) === 0);
}
