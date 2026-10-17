/**
 * frappe.ui.form.MultiSelectDialog (Desk: frappe/public/js/frappe/form/multi_select_dialog.js) —
 * scripts create it; components/desk/MultiSelectHost renders it. Search goes through
 * frappe.desk.search.search_widget exactly like Desk (setters → filters, filter_fields).
 */
type Listener = () => void;

export interface MultiSelectOptions {
  doctype: string;
  target?: unknown;
  setters?: Record<string, unknown> | Array<{ fieldname: string; label?: string; fieldtype?: string; options?: string; default?: unknown }>;
  read_only_setters?: string[];
  date_field?: string;
  get_query?: () => { filters?: Record<string, unknown>; query?: string } | undefined;
  columns?: string[];
  primary_action_label?: string;
  data_fields?: Array<{ fieldname: string; label?: string; fieldtype?: string }>;
  action: (selections: string[], args: Record<string, unknown>) => void;
  [key: string]: unknown;
}

const listeners = new Set<Listener>();
let current: MultiSelectDialog | null = null;
const emit = () => listeners.forEach((l) => l());
const setCurrent = (d: MultiSelectDialog | null) => {
  current = d;
  emit();
};

export const multiSelectStore = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => current,
};

let seq = 0;

export class MultiSelectDialog {
  id = ++seq;
  opts: MultiSelectOptions;
  /** Desk scripts call d.dialog.hide() inside action */
  dialog: { hide: () => void; show: () => void; get_value: (f: string) => unknown };
  values: Record<string, unknown> = {};

  constructor(opts: MultiSelectOptions) {
    this.opts = opts;
    this.dialog = {
      hide: () => {
        if (current === this) setCurrent(null);
      },
      show: () => setCurrent(this),
      get_value: (f: string) => this.values[f],
    };
    setCurrent(this);
  }

  /** filter values at the time of the action (Desk: dialog.get_value) */
  setValues(v: Record<string, unknown>) {
    this.values = v;
  }
}
