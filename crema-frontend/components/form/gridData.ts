/**
 * Child table grid data helpers (Desk: frappe/public/js/frappe/form/grid.js, grid_row.js, controls/table.js):
 * field type groups, CSV / clipboard parsing, row copies.
 */
import type { Row } from "@/lib/form/FormController";
import { userToStr } from "@/lib/frappe/format";

export const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Button", "Heading", "Image", "Table", "Table MultiSelect"]);
export const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);
/** Desk set_arrow_keys ignore_fieldtypes: ↑/↓ stay in the text unless Alt is held */
export const TEXTY = new Set(["Text", "Small Text", "Code", "Text Editor", "HTML Editor", "Long Text"]);
/** fields that hold no data (CSV download / upload skip them) */
export const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Heading", "Fold", "Table", "Table MultiSelect", "Image"]);
export const FOCUSABLE = "input:not([disabled]),select:not([disabled])";
/** Desk grid_pagination: 50 rows per page */
export const PAGE_SIZE = 50;

export const isEmpty = (v: unknown) => v == null || v === "" || v === 0;

/** a new row nobody filled in (Desk __unedited: added and not touched since; defaults don't count as edits) */
export const isBlankRow = (row: Row | undefined, cols: Array<{ fieldname: string }>) =>
  !!row?.__islocal && (!!row.__unedited || cols.every((c) => isEmpty(row[c.fieldname])));

/** Desk table.js value_formatter_map: pasted text → the field's value */
export function pastedValue(v: string, fieldtype: string): unknown {
  const t = v.trim();
  if (fieldtype === "Int" || fieldtype === "Check") return Math.trunc(Number(t.replace(/,/g, "")) || 0);
  if (fieldtype === "Float" || fieldtype === "Currency" || fieldtype === "Percent") return Number(t.replace(/,/g, "")) || 0;
  if (fieldtype === "Date") return !t || /^\d{4}-\d{2}-\d{2}/.test(t) ? t : userToStr(t);
  return v;
}

export const csvCell = (v: unknown) => {
  const t = v == null ? "" : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Minimal RFC 4180 parser (quoted fields, escaped quotes, CRLF); `sep` "\t" reads spreadsheet clipboard text */
export function parseCsv(text: string, sep = ","): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

const ROW_ONLY = new Set(["name", "idx", "__islocal", "creation", "modified", "owner", "modified_by"]);
/** a row's values for a duplicate (Desk grid_row.insert(…, duplicate)) */
export const copyOf = (r: Row) => Object.fromEntries(Object.entries(r).filter(([k]) => !ROW_ONLY.has(k)));
