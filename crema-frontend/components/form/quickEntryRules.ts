/** Which DocTypes open in the Quick Entry dialog (Desk: frappe/public/js/frappe/form/quick_entry.js) */
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Button", "Heading"]);

export function quickFields(meta: DocTypeMeta): DocField[] {
  return (meta.fields ?? []).filter(
    (f) => !LAYOUT.has(f.fieldtype) && !f.hidden && !f.read_only && (f.allow_in_quick_entry || (f.reqd && !f.default)),
  );
}

/** Desk's QuickEntryForm.is_quick_entry() */
export function canQuickEntry(meta: DocTypeMeta): boolean {
  if (!meta.quick_entry || meta.is_submittable || meta.issingle || meta.istable) return false;
  const fields = quickFields(meta);
  if (fields.some((f) => f.fieldtype === "Table" || f.fieldtype === "Table MultiSelect")) return false;
  if ((meta.fields ?? []).some((f) => f.reqd && (f.fieldtype === "Table" || f.fieldtype === "Table MultiSelect"))) return false;
  return fields.length > 0 && fields.length <= 7;
}

