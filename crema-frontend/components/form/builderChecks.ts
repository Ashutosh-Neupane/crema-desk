/**
 * Live checks for the form builder (docs/PHASE2_DESIGN.md § 4.9), run before Save so problems show next to the
 * field instead of as a server error. Ported from Desk's form_builder/store.js `validate_fields` and the server's
 * core/doctype/doctype/doctype.py `validate_fields` (which stays the authority on Save).
 */

export interface BuilderRow {
  name: string;
  fieldtype: string;
  fieldname?: string;
  label?: string;
  options?: unknown;
}

export interface Problem {
  /** row name, to select the field */
  row: string;
  message: string;
}

const LAYOUT = new Set(["Tab Break", "Section Break", "Column Break"]);
// frappe/model/__init__.py default_fields + child_table_fields + optional_fields
const RESERVED = new Set(["doctype", "name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "parent", "parentfield", "parenttype", "_user_tags", "_assign", "_liked_by", "_seen", "_comments"]);
// fieldname characters Frappe accepts (doctype.py ILLEGAL_FIELDNAME_PATTERN rejects quotes, dots, slashes, …)
const FIELDNAME = /^[a-z_][a-z0-9_]*$/;
const NEEDS_OPTIONS: Record<string, string> = {
  Link: "Choose which DocType it links to",
  "Table": "Choose the child DocType for the rows",
  "Table MultiSelect": "Choose the child DocType for the rows",
  Select: "Add the choices, one per line",
  "Dynamic Link": "Choose the field that holds the DocType",
};

const nameOf = (r: BuilderRow) => r.label || r.fieldname || r.fieldtype;

/** problems that need no server call */
export function checkRows(rows: BuilderRow[]): Problem[] {
  const out: Problem[] = [];
  const seen = new Map<string, string>();
  for (const r of rows) {
    if (LAYOUT.has(r.fieldtype)) continue;
    const fn = String(r.fieldname ?? "");
    if (!fn) out.push({ row: r.name, message: `“${nameOf(r)}” needs a field name` });
    else if (!FIELDNAME.test(fn)) out.push({ row: r.name, message: `“${fn}”: use lower-case letters, numbers and _ (starting with a letter)` });
    else if (RESERVED.has(fn)) out.push({ row: r.name, message: `“${fn}” is used by Frappe itself; pick another field name` });
    else if (seen.has(fn)) out.push({ row: r.name, message: `“${fn}” is used twice (also by “${seen.get(fn)}”)` });
    if (fn) seen.set(fn, nameOf(r));
    const need = NEEDS_OPTIONS[r.fieldtype];
    if (need && !String(r.options ?? "").trim()) out.push({ row: r.name, message: `“${nameOf(r)}”: ${need.toLowerCase()}` });
  }
  return out;
}

/** DocTypes named in Link / Table options, to check they exist (and that Table targets are child DocTypes) */
export function linkTargets(rows: BuilderRow[]): string[] {
  return [...new Set(rows.filter((r) => ["Link", "Table", "Table MultiSelect"].includes(r.fieldtype)).map((r) => String(r.options ?? "").trim()).filter(Boolean))];
}

export function checkTargets(rows: BuilderRow[], found: Map<string, { istable: boolean }>): Problem[] {
  const out: Problem[] = [];
  for (const r of rows) {
    const target = String(r.options ?? "").trim();
    if (!target) continue;
    if (r.fieldtype === "Link" && !found.has(target)) out.push({ row: r.name, message: `“${nameOf(r)}” links to “${target}”, which doesn't exist` });
    if (r.fieldtype === "Table" || r.fieldtype === "Table MultiSelect") {
      const t = found.get(target);
      if (!t) out.push({ row: r.name, message: `“${nameOf(r)}”: there is no DocType “${target}”` });
      else if (!t.istable) out.push({ row: r.name, message: `“${nameOf(r)}”: “${target}” isn't a child DocType (rows inside another record)` });
    }
  }
  return out;
}

/** The palette: plain names first (Desk form_builder Sidebar), the raw type underneath */
export const PALETTE: Array<{ type: string; label: string; hint: string }> = [
  { type: "Data", label: "Text", hint: "A short line of text" },
  { type: "Small Text", label: "Long text", hint: "A few lines" },
  { type: "Int", label: "Number", hint: "Whole numbers" },
  { type: "Float", label: "Decimal", hint: "Numbers with decimals" },
  { type: "Currency", label: "Amount", hint: "Money, in the document's currency" },
  { type: "Date", label: "Date", hint: "A day" },
  { type: "Datetime", label: "Date & time", hint: "A day and a time" },
  { type: "Select", label: "Choose one", hint: "One of a fixed list" },
  { type: "Check", label: "Yes / no", hint: "A tick box" },
  { type: "Link", label: "Link", hint: "To another record: a Customer, an Item, …" },
  { type: "Table", label: "Table of rows", hint: "Lines, like order items" },
  { type: "Attach", label: "Attachment", hint: "A file" },
  { type: "Attach Image", label: "Image", hint: "A picture" },
  { type: "Text Editor", label: "Rich text", hint: "Formatted text" },
  { type: "Phone", label: "Phone", hint: "A phone number" },
  { type: "Section Break", label: "Section", hint: "A new block of fields" },
];

export const paletteLabel = (type: string) => PALETTE.find((p) => p.type === type)?.label ?? type;

/** a fresh, unused field name for a new field of this type */
export function freshFieldname(label: string, taken: Set<string | undefined>): string {
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1") || "field";
  let fn = base;
  for (let i = 2; taken.has(fn) || RESERVED.has(fn); i++) fn = `${base}_${i}`;
  return fn;
}
