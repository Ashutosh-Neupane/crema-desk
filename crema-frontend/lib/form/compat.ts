/**
 * Globals that app form JS expects from Desk's bundles, so ERPNext-style
 * scripts load instead of throwing on their first line:
 *  - frappe.ui.form.Controller and the ERPNext controller bases
 *    (TransactionController, SellingController, BuyingController, StockController)
 *    — bases: Crema provides most behaviour natively (see lib/erpnext); TransactionController carries
 *    transaction.js's payment helpers (make_payment_entry → get_payment_entry → a pre-filled Payment Entry)
 *  - extend_cscript(cscript, controller) — copies controller methods onto frm.cscript
 *  - frappe.model.open_mapped_doc — "Create → Delivery Note" style mapping via
 *    the app's whitelisted make_* method, opened as a new unsaved form
 */
import { lenient, type Runtime } from "@/lib/desk-runtime";
import { deskCall } from "@/lib/frappe/form";
import { PREFILL_KEY } from "@/lib/form/prefill";
import { MultiSelectDialog, type MultiSelectOptions } from "@/lib/desk-runtime/multiSelect";
import { installShims } from "./shims";

/** A fresh copy of a filters / query object per call, like JSON.parse(JSON.stringify(x)) did: undefined and functions
 * are dropped and Dates become strings, so a script mutating the returned filters never changes the original */
function plainClone<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => (x === undefined || typeof x === "function" ? null : plainClone(x))) as T;
  if (v instanceof Date) return v.toJSON() as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined && typeof x !== "function") out[k] = plainClone(x);
    return out as T;
  }
  return v;
}

export function installFormCompat(rt: Runtime, opts: { frm: Record<string, unknown>; navigate?: (href: string) => void }) {
  const g = rt.globals;
  const frappe = rt.frappe as unknown as Record<string, Record<string, unknown>>;

  class Controller {
    frm?: Record<string, unknown>;
    constructor(o: Record<string, unknown> = {}) {
      Object.assign(this, o);
      if (!this.frm) this.frm = opts.frm;
    }
    setup() {}
    onload() {}
    refresh() {}
  }
  // Controllers extending frappe.ui.form.Controller (ERPNext's StockController, TransactionController, app classes)
  // call base helpers from bundles Crema doesn't load (setup_posting_date_time_check, show_stock_ledger,
  // super.onload_post_render, …); Crema implements their effects natively, so missing ones resolve to no-ops.
  const lenientBase = new Proxy(Object.prototype, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol" || prop in target || prop === "then") return Reflect.get(target, prop, receiver);
      return () => undefined;
    },
  });
  Object.setPrototypeOf(Controller.prototype, lenientBase);
  (frappe.ui.form as Record<string, unknown>).Controller = Controller;

  const provide = rt.frappe.provide as (ns: string) => Record<string, unknown>;
  const erpnext = provide("erpnext");
  provide("erpnext.utils");
  provide("erpnext.selling");
  provide("erpnext.buying");
  provide("erpnext.stock");
  provide("erpnext.accounts");
  provide("erpnext.taxes");
  class TransactionController extends Controller {
    /** erpnext/public/js/controllers/transaction.js onload_post_render: item rows get "Add Multiple" (item, qty) */
    onload_post_render() {
      const frm = this.frm as { doc?: { doctype?: string }; get_field?: (f: string) => { grid?: { set_multiple_add?: (l: string, q: string) => void } } } | undefined;
      const meta = rt.frappe.meta as { get_docfield: (dt: string, fn: string) => unknown };
      if (frm?.doc?.doctype && meta.get_docfield(`${frm.doc.doctype} Item`, "item_code")) frm.get_field?.("items")?.grid?.set_multiple_add?.("item_code", "qty");
    }

    // ── transaction.js: "Create → Payment" on invoices and orders ───────────────────────────────────────────
    private get txDoc() {
      return ((this.frm as { doc?: Record<string, unknown> } | undefined)?.doc ?? {}) as Record<string, unknown> & {
        __onload?: { make_payment_via_journal_entry?: unknown };
        payment_schedule?: Array<{ discount?: unknown }>;
      };
    }
    make_payment_entry() {
      const viaJournal = this.txDoc.__onload?.make_payment_via_journal_entry;
      if (this.has_discount_in_schedule() && !viaJournal) this.prompt_user_for_reference_date();
      else void this.make_mapped_payment_entry();
    }
    make_mapped_payment_entry(args?: Record<string, unknown>) {
      const doc = this.txDoc;
      const f = rt.frappe as unknown as {
        call: (o: { method: string; args: Record<string, unknown>; callback: (r: { message?: unknown; exc?: unknown }) => void }) => Promise<unknown>;
        model: { sync: (r: unknown) => Array<{ doctype: string; name: string }> };
        set_route: (...p: unknown[]) => unknown;
      };
      return f.call({
        method: this.get_method_for_payment(),
        args: args ?? { dt: doc.doctype, dn: doc.name },
        callback: (r) => {
          if (r.exc) return;
          const docs = f.model.sync(r.message);
          if (docs[0]) f.set_route("Form", docs[0].doctype, docs[0].name);
        },
      });
    }
    has_discount_in_schedule() {
      const doc = this.txDoc;
      if (!["Sales Order", "Sales Invoice", "Purchase Order", "Purchase Invoice"].includes(String(doc.doctype))) return false;
      return !!doc.payment_schedule?.length && doc.payment_schedule.some((row) => !!row.discount);
    }
    prompt_user_for_reference_date() {
      const doc = this.txDoc;
      const prompt = rt.frappe.prompt as (f: unknown, cb: (v: Record<string, unknown>) => void, title?: string, label?: string) => unknown;
      prompt(
        { label: "Cheque/Reference Date", fieldname: "reference_date", fieldtype: "Date", reqd: 1 },
        (values) => void this.make_mapped_payment_entry({ dt: doc.doctype, dn: doc.name, reference_date: values.reference_date }),
        "Reference Date for Early Payment Discount",
        "Continue",
      );
    }
    get_method_for_payment() {
      const doc = this.txDoc;
      if (doc.__onload?.make_payment_via_journal_entry) {
        return ["Sales Invoice", "Purchase Invoice"].includes(String(doc.doctype))
          ? "erpnext.accounts.doctype.journal_entry.journal_entry.get_payment_entry_against_invoice"
          : "erpnext.accounts.doctype.journal_entry.journal_entry.get_payment_entry_against_order";
      }
      return "erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry";
    }
  }
  erpnext.TransactionController = TransactionController;
  erpnext.taxes_and_totals = TransactionController;
  erpnext.payments = TransactionController;
  (erpnext.selling as Record<string, unknown>).SellingController = class extends TransactionController {};
  (erpnext.buying as Record<string, unknown>).BuyingController = class extends TransactionController {};
  (erpnext.stock as Record<string, unknown>).StockController = class extends Controller {};
  (erpnext.utils as Record<string, unknown>).get_fiscal_year = () => undefined;

  // Helpers from ERPNext's bundle we don't implement (erpnext.accounts.taxes.setup_tax_filters, …)
  // resolve to no-ops instead of aborting the whole DocType script.
  g.erpnext = lenient(erpnext);

  // copy own + prototype methods (except constructor) onto cscript
  g.extend_cscript = (cscript: Record<string, unknown>, obj: Record<string, unknown>) => {
    let proto: object | null = obj;
    const seen = new Set<string>();
    // stop at the lenient base: its own names are Object.prototype's (constructor, __proto__, …)
    while (proto && proto !== Object.prototype && proto !== lenientBase) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === "constructor" || seen.has(key)) continue;
        seen.add(key);
        const v = (obj as Record<string, unknown>)[key];
        cscript[key] = typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(obj) : v;
      }
      proto = Object.getPrototypeOf(proto);
    }
    return cscript;
  };
  g.cur_frm = opts.frm;

  frappe.model.open_mapped_doc = async (o: { method: string; frm?: { doc: Record<string, unknown> }; source_name?: string; args?: Record<string, unknown> }) => {
    const source = o.source_name ?? (o.frm ?? opts.frm as { doc: Record<string, unknown> }).doc?.name;
    const { env } = await deskCall("frappe.model.mapper.make_mapped_doc", {
      method: o.method,
      source_name: source,
      args: o.args ? JSON.stringify(o.args) : undefined,
      selected_children: undefined,
    });
    const doc = env.message as Record<string, unknown> | undefined;
    if (!doc?.doctype) return;
    sessionStorage.setItem(PREFILL_KEY(String(doc.doctype)), JSON.stringify(doc));
    opts.navigate?.(`/desk/doctype/${encodeURIComponent(String(doc.doctype))}/new`);
  };
  // erpnext.utils.map_current_doc — "Get Items From → Sales Order" etc. (ERPNext bundle: public/js/utils.js):
  // pick sources in MultiSelectDialog, then frappe.model.mapper.map_docs onto this unsaved doc
  const erpUtils = provide("erpnext.utils");
  erpUtils.map_current_doc = (o: {
    method: string;
    source_doctype?: string;
    source_name?: string | string[];
    target?: unknown;
    setters?: MultiSelectOptions["setters"];
    read_only_setters?: string[];
    date_field?: string;
    get_query?: MultiSelectOptions["get_query"];
    get_query_filters?: Record<string, unknown>;
    get_query_method?: string;
    args?: Record<string, unknown>;
  }) => {
    const frm = opts.frm as { doc: Record<string, unknown>; __sync?: (d: Record<string, unknown>) => void };
    const map = async () => {
      const doc = { ...frm.doc };
      // Desk drops a leading empty item row before mapping
      if (Array.isArray(doc.items) && doc.items.length && !(doc.items[0] as Record<string, unknown>).item_code) doc.items = (doc.items as unknown[]).slice(1);
      const names = Array.isArray(o.source_name) ? o.source_name : [o.source_name];
      const { env } = await deskCall("frappe.model.mapper.map_docs", {
        method: o.method,
        source_names: JSON.stringify(names),
        target_doc: JSON.stringify(doc),
        args: o.args ? JSON.stringify(o.args) : undefined,
      });
      if (env.message) frm.__sync?.(env.message as Record<string, unknown>);
    };
    if (o.source_name) return map();
    const q: { filters?: Record<string, unknown>; query?: string } = {};
    if (o.get_query_filters) q.filters = o.get_query_filters;
    if (o.get_query_method) q.query = o.get_query_method;
    const d = new MultiSelectDialog({
      doctype: String(o.source_doctype),
      target: o.target,
      setters: o.setters,
      read_only_setters: o.read_only_setters,
      date_field: o.date_field,
      get_query: o.get_query ?? (q.filters || q.query ? () => plainClone(q) : undefined),
      action: (selections, args) => {
        if (!selections.length) return;
        o.source_name = [...new Set(selections)];
        if (["Purchase Receipt", "Delivery Note", "Pick List"].includes(String(o.source_doctype))) o.args = args;
        d.dialog.hide();
        void map();
      },
    });
    return d;
  };

  // frappe.model.can_create(dt) etc. from the user's real boot permission lists
  const bootUser = (frappe.boot as Record<string, unknown>).user as Record<string, unknown>;
  for (const p of ["can_create", "can_delete", "can_read", "can_write", "can_submit", "can_cancel", "can_print", "can_email", "can_import", "can_export", "can_get_report"]) {
    frappe.model[p] = (dt: string) => {
      const list = bootUser?.[p];
      return Array.isArray(list) ? list.includes(dt) : true;
    };
  }
  frappe.model.can_set_user_permissions = () => false;
  (frappe.ui.form as Record<string, unknown>).make_quick_entry = (dt: string) => opts.navigate?.(`/desk/doctype/${encodeURIComponent(dt)}/new`);
  installShims(rt, opts);
}
