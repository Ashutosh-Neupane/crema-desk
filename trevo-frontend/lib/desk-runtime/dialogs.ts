/**
 * frappe.ui.Dialog / frappe.prompt / frappe.confirm for app scripts, rendered
 * by <DialogHost/> (components/desk/DialogHost.tsx). Scripts get the same API
 * Desk exposes: new frappe.ui.Dialog({ title, fields, primary_action }) →
 * show / hide / get_values / set_value / set_values / fields_dict / get_field.
 */
import type { DocField } from "@/lib/frappe/types";

export interface DialogField extends Omit<Partial<DocField>, "default"> {
  fieldname?: string;
  fieldtype: string;
  label?: string;
  default?: unknown;
  onchange?: (this: unknown) => unknown;
  click?: () => unknown;
  data?: unknown[];
  fields?: DialogField[];
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
}

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
  fields_dict: Record<string, { df: DialogField; get_value: () => unknown; set_value: (v: unknown) => Promise<void>; refresh: () => void; $wrapper: unknown }> = {};

  constructor(opts: DialogOptions) {
    this.opts = { ...opts, fields: opts.fields ?? [] };
    for (const f of this.flatFields()) {
      if (!f.fieldname) continue;
      if (f.default !== undefined) this.values[f.fieldname] = f.default;
      else if (f.fieldtype === "Check") this.values[f.fieldname] = 0;
      this.fields_dict[f.fieldname] = {
        df: f,
        get_value: () => this.values[f.fieldname!],
        set_value: (v) => this.set_value(f.fieldname!, v),
        refresh: () => this.touch(),
        $wrapper: { find: () => ({ length: 0 }), toggle: () => {}, hide: () => {}, show: () => {} },
      };
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
  disable_primary_action() {}
  enable_primary_action() {}
  /** Desk returns null (and highlights fields) when mandatory values are missing */
  get_values(ignoreErrors = false): Record<string, unknown> | null {
    const errors: Record<string, string> = {};
    for (const f of this.flatFields()) {
      if (!f.fieldname || !f.reqd) continue;
      const v = this.values[f.fieldname];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) errors[f.fieldname] = "Required";
    }
    this.errors = errors;
    this.touch();
    if (Object.keys(errors).length && !ignoreErrors) return null;
    return { ...this.values };
  }
  clear() {
    this.values = {};
    this.touch();
  }
  async runPrimary() {
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
