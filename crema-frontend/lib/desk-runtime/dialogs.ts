/**
 * frappe.ui.Dialog / frappe.prompt / frappe.confirm for app scripts, rendered
 * by <DialogHost/> (components/desk/DialogHost.tsx). Scripts get the same API
 * Desk exposes: new frappe.ui.Dialog({ title, fields, primary_action }) →
 * show / hide / get_values / set_value / set_values / fields_dict / get_field.
 */
import type { DocField } from "@/lib/frappe/types";
import { evalDependsOn } from "@/lib/crema-form/dependsOn";
import { makeLenientJQuery } from "./jquery";

export interface DialogField extends Omit<Partial<DocField>, "default"> {
  fieldname?: string;
  fieldtype: string;
  label?: string;
  default?: unknown;
  onchange?: (this: unknown) => unknown;
  click?: () => unknown;
  /** Table fields: the live rows array (`fields_dict.<f>.df.data`) */
  data?: DialogRow[];
  /** Table fields: child field defs; other fields: unused */
  fields?: DialogField[];
  /** Table fields: initial rows when `data` is not given (grid.js get_data) */
  get_data?: () => DialogRow[];
  cannot_add_rows?: boolean | number;
  cannot_delete_rows?: boolean | number;
  in_place_edit?: boolean | number;
  /** Link fields (and Table child fields): set_query result */
  get_query?: (this: unknown, doc?: unknown) => { filters?: unknown; query?: string } | undefined;
  /** Table fields: called after grid.add_new_row() (grid.js) */
  on_add_row?: (idx: number) => unknown;
}

/** a row of a dialog Table field (grid.js: `{ idx, __islocal, ...defaults }`) */
export interface DialogRow {
  idx?: number;
  name?: string;
  __islocal?: boolean;
  __checked?: boolean;
  [k: string]: unknown;
}

export interface DialogGrid {
  df: DialogField;
  docfields: DialogField[];
  get_data: () => DialogRow[];
  refresh: () => void;
  add_new_row: () => DialogRow | undefined;
  delete_rows: () => void;
  get_selected_children: () => DialogRow[];
  get_field: (child: string) => { df: DialogField | undefined; get_query: DialogField["get_query"] };
  update_docfield_property: (child: string, prop: string, value: unknown) => void;
  toggle_enable: (child: string, enable: boolean) => void;
  toggle_reqd: (child: string, reqd: boolean) => void;
  toggle_display: (child: string, show: boolean) => void;
}

export interface DialogControl {
  df: DialogField;
  get_value: () => unknown;
  set_value: (v: unknown) => Promise<void>;
  refresh: () => void;
  toggle: (show: boolean) => void;
  get_query: DialogField["get_query"];
  set_query: (fn: NonNullable<DialogField["get_query"]>) => void;
  grid?: DialogGrid;
  readonly $wrapper: unknown;
  readonly wrapper: unknown;
}

export interface DialogOptions {
  title?: string;
  fields?: DialogField[];
  primary_action_label?: string;
  primary_action?: (values: Record<string, unknown>) => unknown;
  secondary_action_label?: string;
  secondary_action?: () => unknown;
  size?: "small" | "large" | "extra-large";
  static?: boolean;
  /** confirm-style dialogs */
  message?: string;
  /** Desk `indicator` option: a colour name ("orange") shown as a dot before the title */
  indicator?: string | { label?: string; color?: string };
}

/** field types that hold no value (frappe.model.layout_fields) */
const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Heading", "Button", "Fold", "Table", "Table MultiSelect"]);
export const isGridChildField = (f: DialogField) => !!f.fieldname && !["Section Break", "Column Break", "Tab Break", "Heading", "Button", "HTML", "Fold"].includes(f.fieldtype) && !f.hidden;

type Listener = () => void;
const listeners = new Set<Listener>();
let open: DeskDialog[] = [];
let snapshot: DeskDialog[] = [];

function emit() {
  snapshot = [...open];
  listeners.forEach((l) => l());
}
export const dialogStore = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => snapshot,
};

let seq = 0;

export class DeskDialog {
  id = ++seq;
  opts: DialogOptions;
  values: Record<string, unknown> = {};
  errors: Record<string, string> = {};
  version = 0;
  fields_dict: Record<string, DialogControl> = {};
  primaryDisabled = false;
  customActions: Array<{ label: string; action?: (this: DeskDialog) => unknown; css?: string }> = [];
  private htmlEls = new Map<string, HTMLDivElement>();
  private rowSeq = 0;

  constructor(opts: DialogOptions) {
    this.opts = { ...opts, fields: opts.fields ?? [] };
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    for (const f of this.flatFields()) {
      if (!f.fieldname) continue;
      if (f.fieldtype === "Table") this.values[f.fieldname] = this.tableData(f);
      else if (f.default !== undefined) this.values[f.fieldname] = f.default;
      else if (f.fieldtype === "Check") this.values[f.fieldname] = 0;
      const ctl: DialogControl = {
        df: f,
        get_value: () => (f.fieldtype === "Table" ? this.tableData(f) : this.values[f.fieldname!]),
        set_value: (v) => this.set_value(f.fieldname!, v),
        refresh: () => this.touch(),
        toggle: (show) => this.set_df_property(f.fieldname!, "hidden", show ? 0 : 1),
        get get_query() {
          return f.get_query;
        },
        set get_query(fn) {
          f.get_query = fn;
        },
        set_query: (fn) => {
          f.get_query = fn;
        },
        // HTML fields get a real DOM node (rendered by HtmlHost) so scripts' markup shows up; others an empty jQuery set
        get $wrapper() {
          const $ = self.jq();
          return f.fieldtype === "HTML" && self.htmlWrapper(f.fieldname!) ? $(self.htmlWrapper(f.fieldname!)) : $();
        },
        get wrapper() {
          return f.fieldtype === "HTML" ? (self.htmlWrapper(f.fieldname!) ?? {}) : self.jq()();
        },
      };
      if (f.fieldtype === "Table") ctl.grid = this.makeGrid(f);
      this.fields_dict[f.fieldname] = ctl;
    }
  }

  private jq() {
    return makeLenientJQuery(() => () => ({}), () => undefined) as (el?: unknown) => unknown;
  }
  /** The DOM node behind an HTML field, mounted into the dialog by HtmlHost (same contract as FormController.htmlWrapper) */
  htmlWrapper(fieldname: string): HTMLDivElement | null {
    if (typeof document === "undefined") return null;
    let el = this.htmlEls.get(fieldname);
    if (!el) {
      el = document.createElement("div");
      el.className = "frappe-control";
      el.dataset.fieldname = fieldname;
      this.htmlEls.set(fieldname, el);
    }
    return el;
  }

  /** grid.js get_data(): df.data, seeded from df.get_data() once; rows get idx / name like grid rows */
  tableData(df: DialogField): DialogRow[] {
    if (!Array.isArray(df.data)) df.data = df.get_data ? [...(df.get_data() ?? [])] : [];
    df.data.forEach((r, i) => {
      if (r && typeof r === "object") {
        if (r.idx === undefined) r.idx = i + 1;
        if (!r.name) r.name = `row ${++this.rowSeq}`;
      }
    });
    return df.data;
  }
  private makeGrid(df: DialogField): DialogGrid {
    const docfields = () => (df.fields ?? []).filter((c) => !!c && typeof c === "object");
    const child = (name: string) => docfields().find((c) => c.fieldname === name);
    const grid: DialogGrid = {
      df,
      get docfields() {
        return docfields();
      },
      get_data: () => this.tableData(df),
      refresh: () => {
        this.tableData(df);
        this.touch();
      },
      // grid.js add_new_row (no frm): push { idx, __islocal, ...defaults }
      add_new_row: () => {
        if (df.cannot_add_rows) return undefined;
        const data = this.tableData(df);
        const defaults: DialogRow = {};
        for (const c of docfields()) if (c.fieldname && c.default !== undefined) defaults[c.fieldname] = c.default;
        const row: DialogRow = { idx: data.length + 1, __islocal: true, ...defaults };
        data.push(row);
        this.tableData(df);
        df.on_add_row?.(row.idx as number);
        this.touch();
        return row;
      },
      get_selected_children: () => this.tableData(df).filter((r) => r.__checked),
      // grid.js delete_rows (no frm): drop selected rows, renumber idx
      delete_rows: () => {
        if (df.cannot_delete_rows) return;
        const keep = this.tableData(df).filter((r) => !r.__checked);
        df.data = keep;
        keep.forEach((r, i) => (r.idx = i + 1));
        this.values = { ...this.values, [df.fieldname!]: keep };
        this.touch();
      },
      get_field: (name) => ({
        get df() {
          return child(name);
        },
        get get_query() {
          return child(name)?.get_query;
        },
        set get_query(fn) {
          const c = child(name);
          if (c) c.get_query = fn;
        },
      }),
      update_docfield_property: (name, prop, value) => {
        const c = child(name);
        if (c) (c as Record<string, unknown>)[prop] = value;
        this.touch();
      },
      toggle_enable: (name, enable) => grid.update_docfield_property(name, "read_only", enable ? 0 : 1),
      toggle_reqd: (name, reqd) => grid.update_docfield_property(name, "reqd", reqd ? 1 : 0),
      toggle_display: (name, show) => grid.update_docfield_property(name, "hidden", show ? 0 : 1),
    };
    return grid;
  }
  /** a cell edit: set the row value, re-render, then run the child field's onchange (control.doc = the row) */
  async set_row_value(table: string, row: DialogRow, child: string, v: unknown) {
    row[child] = v;
    this.touch();
    const cdf = this.fields_dict[table]?.df.fields?.find((c) => c.fieldname === child);
    if (!cdf?.onchange) return;
    const ctl = {
      df: cdf,
      doc: row,
      grid: this.fields_dict[table].grid,
      grid_row: { doc: row },
      get_value: () => row[child],
      set_value: async (nv: unknown) => this.set_row_value(table, row, child, nv),
    };
    try {
      await cdf.onchange.call(ctl);
    } catch (err) {
      console.warn("[dialog] child onchange failed", err);
    }
  }

  flatFields(): DialogField[] {
    return (this.opts.fields ?? []).filter((f) => !!f && typeof f === "object");
  }

  private touch() {
    this.version++;
    emit();
  }

  show() {
    if (!open.includes(this)) open = [...open, this];
    this.touch();
  }
  hide() {
    open = open.filter((d) => d !== this);
    emit();
  }
  get $wrapper() {
    return { find: () => ({ length: 0 }), modal: () => {}, on: () => {} };
  }
  get_field(f: string) {
    return this.fields_dict[f];
  }
  get_value(f: string) {
    return this.values[f];
  }
  async set_value(f: string, v: unknown) {
    const tdf = this.fields_dict[f]?.df;
    if (tdf?.fieldtype === "Table") {
      tdf.data = Array.isArray(v) ? (v as DialogRow[]) : [];
      v = this.tableData(tdf);
    }
    this.values = { ...this.values, [f]: v };
    delete this.errors[f];
    this.touch();
    const df = this.fields_dict[f]?.df;
    try {
      await df?.onchange?.call(this.fields_dict[f]);
    } catch (err) {
      console.warn("[dialog] onchange failed", err);
    }
  }
  async set_values(vals: Record<string, unknown>) {
    // in order: each set_value may run that field's onchange
    // react-doctor-disable-next-line async-await-in-loop
    for (const [k, v] of Object.entries(vals ?? {})) await this.set_value(k, v);
  }
  set_title(t: string) {
    this.opts.title = t;
    this.touch();
  }
  set_primary_action(label: string, action: (values: Record<string, unknown>) => unknown) {
    this.opts.primary_action_label = label;
    this.opts.primary_action = action;
    this.touch();
  }
  set_df_property(f: string, prop: string, v: unknown) {
    const field = this.fields_dict[f];
    if (field) (field.df as Record<string, unknown>)[prop] = v;
    this.touch();
  }
  /** Desk: a coloured message strip above the fields */
  show_message(message: string) {
    this.opts.message = message;
    this.touch();
  }
  clear_message() {
    this.opts.message = undefined;
    this.touch();
  }
  /** Desk: coloured dot + label in the header (the `indicator` option / frappe.ui.Dialog.set_indicator) */
  set_indicator(label: string, color?: string) {
    this.opts.indicator = { label, color };
    this.touch();
  }
  set_secondary_action(fn: () => unknown) {
    this.opts.secondary_action = fn;
    this.touch();
  }
  set_secondary_action_label(label: string) {
    this.opts.secondary_action_label = label;
    this.touch();
  }
  /** footer button left of the standard actions (Session Defaults' "Configure") */
  add_custom_action(label: string, action?: (this: DeskDialog) => unknown, css?: string) {
    this.customActions = [...this.customActions, { label, action, css }];
    this.touch();
  }
  disable_primary_action() {
    this.primaryDisabled = true;
    this.touch();
  }
  enable_primary_action() {
    this.primaryDisabled = false;
    this.touch();
  }
  /** Desk returns null (and highlights fields) when mandatory values are missing */
  get_values(ignoreErrors = false): Record<string, unknown> | null {
    const errors: Record<string, string> = {};
    const out: Record<string, unknown> = { ...this.values };
    for (const f of this.flatFields()) {
      if (f.fieldtype === "Table" && f.fieldname) out[f.fieldname] = this.tableData(f);
    }
    for (const f of this.flatFields()) {
      if (!f.fieldname) continue;
      // field_group.js: hidden fields (hidden / depends_on false) are not validated
      if (f.hidden || (f.depends_on && !evalDependsOn(String(f.depends_on), out))) continue;
      const reqd = !!f.reqd || (!!f.mandatory_depends_on && evalDependsOn(String(f.mandatory_depends_on), out));
      if (!reqd || (LAYOUT.has(f.fieldtype) && f.fieldtype !== "Table")) continue;
      const v = out[f.fieldname];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) errors[f.fieldname] = "Required";
    }
    this.errors = errors;
    this.touch();
    if (Object.keys(errors).length && !ignoreErrors) return null;
    return out;
  }
  clear() {
    this.values = {};
    this.touch();
  }
  async runPrimary() {
    if (this.primaryDisabled) return;
    const values = this.get_values();
    if (!values) return;
    await this.opts.primary_action?.call(this, values);
  }
}

/** frappe.prompt(fields, callback, title, primary_label) */
export function prompt(fields: DialogField[] | DialogField, callback: (values: Record<string, unknown>) => unknown, title?: string, primaryLabel?: string) {
  const list = Array.isArray(fields) ? fields : [fields];
  const d = new DeskDialog({
    title: title ?? "Enter Value",
    fields: list,
    primary_action_label: primaryLabel ?? "Submit",
    primary_action(values) {
      d.hide();
      return callback(values);
    },
  });
  d.show();
  return d;
}

/** frappe.confirm(message, ifYes, ifNo) */
export function confirm(message: string, ifYes?: () => unknown, ifNo?: () => unknown) {
  const d = new DeskDialog({
    title: "Confirm",
    message,
    fields: [],
    primary_action_label: "Yes",
    primary_action() {
      d.hide();
      return ifYes?.();
    },
    secondary_action_label: "No",
    secondary_action() {
      d.hide();
      return ifNo?.();
    },
  });
  d.show();
  return d;
}
