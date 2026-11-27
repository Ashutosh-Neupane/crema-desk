/** Shared Desk filter model for list-like views: operators, field labels, URL ⇄ filter tuples. */
import type { Filter } from "@/lib/list/api";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

export const NO_VALUE = new Set([
  "Section Break",
  "Column Break",
  "Tab Break",
  "Fold",
  "HTML",
  "Button",
  "Heading",
  "Image",
  "Table",
  "Table MultiSelect",
  "Attach Image",
  "Signature",
  "Code",
  "Text Editor",
  "HTML Editor",
  "Markdown Editor",
  "Password",
  "JSON",
  "Geolocation",
]);
export const OPERATORS: Array<{ op: string; label: string }> = [
  { op: "=", label: "equals" },
  { op: "!=", label: "not equals" },
  { op: "like", label: "like" },
  { op: "not like", label: "not like" },
  { op: ">", label: ">" },
  { op: "<", label: "<" },
  { op: ">=", label: ">=" },
  { op: "<=", label: "<=" },
  { op: "is", label: "is" },
];
export const STD_FIELD_LABELS: Record<string, string> = {
  name: "ID",
  owner: "Created By",
  modified: "Last Updated On",
  creation: "Created On",
  docstatus: "Document Status",
  _assign: "Assigned To",
  modified_by: "Last Updated By",
};

export function filterableFields(meta: DocTypeMeta): DocField[] {
  return (meta.fields ?? []).filter((f) => !NO_VALUE.has(f.fieldtype) && !f.hidden);
}

export function fieldLabel(meta: DocTypeMeta, fieldname: string): string {
  return (
    STD_FIELD_LABELS[fieldname] ??
    meta.fields?.find((f) => f.fieldname === fieldname)?.label ??
    fieldname
  );
}

/** ?status=Draft&customer=X or ?filters=[[…]] → filter tuples */
export function filtersFromParams(doctype: string, params: URLSearchParams): Filter[] {
  // ?field=value pairs (simple equality) and ?filters=[…] (the rest) together — setFilters writes both
  const out: Filter[] = [];
  params.forEach((v, k) => {
    // view options, not filters; "_…" keys are route options such as Report view's _group_by
    if (["filters", "view", "sort", "q", "new"].includes(k) || k.startsWith("_")) return;
    out.push([doctype, k, "=", v]);
  });
  const raw = params.get("filters");
  if (raw) {
    try {
      const arr = JSON.parse(raw) as unknown[][];
      // accept [field, op, value] as well as [doctype, field, op, value]
      if (Array.isArray(arr))
        out.push(
          ...arr
            .filter(Array.isArray)
            .map((f) => (f.length === 3 ? [doctype, f[0], f[1], f[2]] : f) as Filter)
        );
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function describeValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v === null || v === undefined || v === "") return "empty";
  return String(v);
}
