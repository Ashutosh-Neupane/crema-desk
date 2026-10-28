/**
 * New document defaults — port of Desk's frappe.model.get_new_doc /
 * set_default_values / get_default_value (frappe/public/js/frappe/model/create_new.js),
 * minus the user-permission filtering (the server enforces permissions on save).
 */
import type { DocTypeMeta, DocField } from "@/lib/frappe/types";
import { newDocName } from "@/lib/frappe/form";

export interface NewDocContext {
  user: string;
  full_name?: string;
  /** boot.user.defaults — user + global defaults keyed by fieldname (company, currency, …) */
  defaults?: Record<string, unknown>;
}

const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Button", "Heading", "Image"]);
const pad = (n: number) => String(n).padStart(2, "0");

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function getDefaultValue(df: DocField, meta: DocTypeMeta, ctx: NewDocContext): unknown {
  if (df.fieldtype === "Table" || df.fieldtype === "Table MultiSelect") return [];
  let value: unknown = null;

  // user defaults for Link fields (not User links), e.g. company
  if (!df.read_only && df.fieldtype === "Link" && df.options !== "User") {
    value = ctx.defaults?.[df.fieldname] ?? null;
    if (Array.isArray(value)) value = value.length === 1 ? value[0] : null;
  }

  if (!value || df.default) {
    const dv = df.default == null ? "" : String(df.default);
    if (!dv) {
      if (df.fieldtype === "Time") value = nowTime();
    } else if (dv === "__user" || dv.toLowerCase() === "user") value = ctx.user;
    else if (dv === "user_fullname") value = ctx.full_name ?? ctx.user;
    else if (dv === "Today") value = today();
    else if (dv.toLowerCase() === "now") value = df.fieldtype === "Time" ? nowTime() : `${today()} ${nowTime()}`;
    else if (dv.startsWith(":")) value = null; // boot-doc defaults (":Company") need boot docs — leave to server
    else if (df.fieldname === meta.title_field) value = "";
    else value = df.default;
  }
  return value;
}

/** A fresh local doc: { doctype, name: "new-x-1", __islocal: 1, docstatus: 0, ...defaults } */
export function getNewDoc(meta: DocTypeMeta, ctx: NewDocContext): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    doctype: meta.name,
    name: newDocName(meta.name),
    __islocal: 1,
    __unsaved: 1,
    docstatus: 0,
    owner: ctx.user,
  };
  for (const df of meta.fields ?? []) {
    if (NO_VALUE.has(df.fieldtype)) continue;
    let v = getDefaultValue(df, meta, ctx);
    if (v !== null && v !== undefined && v !== "") {
      if (df.fieldtype === "Int" || df.fieldtype === "Check") v = parseInt(String(v), 10) || 0;
      else if (df.fieldtype === "Float" || df.fieldtype === "Currency" || df.fieldtype === "Percent") v = parseFloat(String(v)) || 0;
      doc[df.fieldname] = v;
    } else if (df.fieldtype === "Select" && typeof df.options === "string" && df.options && !["[Select]", "Loading..."].includes(df.options)) {
      doc[df.fieldname] = df.options.split("\n")[0];
    }
  }
  return doc;
}
