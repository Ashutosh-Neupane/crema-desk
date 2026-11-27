/**
 * Globals that app form JS expects from Desk's bundles, so ERPNext-style
 * scripts load instead of throwing on their first line:
 *  - frappe.ui.form.Controller and the ERPNext controller bases
 *    (TransactionController, SellingController, BuyingController, StockController)
 *    — TransactionController ports what transaction.js does on refresh (hide_company, set_dynamic_labels: currency
 *    labels and which totals show) and its payment helpers (make_payment_entry → a pre-filled Payment Entry)
 *  - extend_cscript(cscript, controller) — copies controller methods onto frm.cscript
 *  - frappe.model.open_mapped_doc — "Create → Delivery Note" style mapping via
 *    the app's whitelisted make_* method, opened as a new unsaved form
 */
import { lenient, type Runtime } from "@/lib/desk-runtime";
import { deskCall } from "@/lib/frappe/form";
import { PREFILL_KEY } from "@/lib/form/prefill";
import { MultiSelectDialog, type MultiSelectOptions } from "@/lib/desk-runtime/multiSelect";
import { installShims } from "./shims";
import { setDependsOnGlobals } from "@/lib/crema-form/dependsOn";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

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
  /** the frm calls transaction.js makes for labels and visibility */
  type TxFrm = {
    doc: Record<string, unknown> & { doctype?: string; company?: string; currency?: string; price_list_currency?: string; party_account_currency?: string; docstatus?: number; discount_amount?: unknown; taxes?: Array<{ included_in_print_rate?: number }> };
    fields_dict: Record<string, { grid?: { doctype?: string } } | undefined>;
    toggle_display: (f: string | string[], show: boolean) => void;
    toggle_reqd: (f: string | string[], reqd: boolean) => void;
    set_df_property: (f: string, prop: string, value: unknown) => void;
    set_currency_labels: (fields: string[], currency: string, parentfield?: string) => void;
    set_value: (f: string, v: unknown) => unknown;
  };
  const companies = () => ((g.locals as Record<string, Record<string, { default_currency?: string }>> | undefined)?.[":Company"] ?? {});
  const sysCurrency = () => String(((rt.frappe.boot as { sysdefaults?: { currency?: string } } | undefined)?.sysdefaults?.currency) ?? "");
  /** erpnext/public/js/utils.js get_currency */
  const companyCurrency = (company?: string) => (company ? companies()[company]?.default_currency || sysCurrency() : sysCurrency());
  const docfields = (dt: string) => ((rt.frappe.meta as unknown as { get_docfields: (d: string) => Array<{ fieldname: string; fieldtype: string; options?: string }> }).get_docfields(dt) ?? []);

  class TransactionController extends Controller {
    private _last_currency?: unknown;
    private _last_price_list_currency?: unknown;
    private _last_party_account_currency?: unknown;
    private _last_company_currency?: unknown;
    private get tx() {
      return this.frm as unknown as TxFrm;
    }

    /** transaction.js refresh: Company hidden on a one-company site, then the currency labels and totals shown */
    refresh() {
      this.hide_company();
      this.set_dynamic_labels();
    }

    /** utils.js hide_company: with one Company, fill it and hide the field */
    hide_company() {
      const frm = this.tx;
      if (!frm?.fields_dict?.company) return;
      const names = Object.keys(companies());
      if (names.length === 1) {
        if (!frm.doc.company) void frm.set_value("company", names[0]);
        frm.toggle_display("company", false);
      }
    }

    get_company_currency() {
      return companyCurrency(this.tx.doc.company);
    }

    /** transaction.js set_dynamic_labels: relabel and toggle when a currency changed (also on the first refresh) */
    set_dynamic_labels() {
      const frm = this.tx;
      if (!frm?.doc) return;
      frm.toggle_reqd("plc_conversion_rate", !!(frm.doc.price_list_name && frm.doc.price_list_currency));
      const company_currency = this.get_company_currency();
      if (
        this._last_currency === frm.doc.currency &&
        this._last_price_list_currency === frm.doc.price_list_currency &&
        this._last_party_account_currency === frm.doc.party_account_currency &&
        this._last_company_currency === company_currency
      )
        return;
      this._last_currency = frm.doc.currency;
      this._last_price_list_currency = frm.doc.price_list_currency;
      this._last_party_account_currency = frm.doc.party_account_currency;
      this._last_company_currency = company_currency;
      this.change_form_labels(company_currency);
      this.change_grid_labels(company_currency);
    }

    get_currency_label_options(company_currency: string): Record<string, unknown> {
      const d = this.tx.doc;
      return { currency: d.currency, "Company:company:default_currency": company_currency, party_account_currency: d.party_account_currency };
    }

    set_currency_labels_from_options(options: Record<string, unknown>, parentfield?: string) {
      const frm = this.tx;
      // the child DocType from the table field's options (grid.doctype in Desk)
      const doctype = parentfield ? String(docfields(String(frm.doc.doctype)).find((df) => df.fieldname === parentfield)?.options ?? "") : String(frm.doc.doctype);
      const fields = docfields(doctype);
      for (const [opt, currency] of Object.entries(options)) {
        if (!currency) continue;
        frm.set_currency_labels(fields.filter((df) => df.fieldtype === "Currency" && df.options === opt).map((df) => df.fieldname), String(currency), parentfield);
      }
    }

    /** transaction.js change_form_labels: "(NPR)" on amounts; company-currency, tax and net-total fields only when they say something */
    change_form_labels(company_currency: string) {
      const frm = this.tx;
      const d = frm.doc;
      this.set_currency_labels_from_options(this.get_currency_label_options(company_currency));
      frm.set_currency_labels(["totals_section"], String(d.currency ?? ""));
      frm.set_currency_labels(["base_totals_section"], company_currency);
      frm.set_df_property("conversion_rate", "description", `1 ${d.currency} = [?] ${company_currency}`);
      if (d.price_list_currency && d.price_list_currency !== company_currency)
        frm.set_df_property("plc_conversion_rate", "description", `1 ${d.price_list_currency} = [?] ${company_currency}`);
      const has = (fn: string) => docfields(String(d.doctype)).some((df) => df.fieldname === fn);
      const show = (fields: string[], on: boolean) => frm.toggle_display(fields.filter(has), on);
      show(
        ["conversion_rate", "base_total", "base_net_total", "base_tax_withholding_net_total", "base_total_taxes_and_charges", "base_taxes_and_charges_added", "base_taxes_and_charges_deducted", "base_grand_total", "base_rounded_total", "base_in_words", "base_discount_amount", "base_paid_amount", "base_write_off_amount", "base_operating_cost", "base_raw_material_cost", "base_total_cost", "base_secondary_items_cost", "base_rounding_adjustment"],
        d.currency !== company_currency
      );
      show(["plc_conversion_rate", "price_list_currency"], d.price_list_currency !== company_currency);
      for (const f of ["total_taxes_and_charges", "taxes_and_charges_deducted", "taxes_and_charges_added", "base_taxes_and_charges_added", "base_taxes_and_charges_deducted", "base_total_taxes_and_charges"])
        show([f], d[f] !== 0 || d.docstatus !== 1);
      const netTotal = !!(Number(d.discount_amount) || (d.taxes ?? []).some((t) => t.included_in_print_rate === 1));
      show(["net_total"], netTotal);
      show(["base_net_total"], netTotal && d.currency !== company_currency);
    }

    /** transaction.js change_grid_labels: the same "(NPR)" on child table columns */
    change_grid_labels(company_currency: string) {
      const options = this.get_currency_label_options(company_currency);
      for (const table of ["items", "operations", "secondary_items", "taxes", "advances", "payment_schedule", "sales_team"])
        if (this.tx.fields_dict[table]) this.set_currency_labels_from_options(options, table);
    }

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
  // utils.js get_currency: the Company's currency (sections like "Currency and Price List" open only when it differs)
  erpnext.get_currency = (company?: string) => companyCurrency(company ?? String(((g.cur_frm as { doc?: { company?: string } } | undefined)?.doc?.company) ?? ""));
  erpnext.TransactionController = TransactionController;
  erpnext.taxes_and_totals = TransactionController;
  erpnext.payments = TransactionController;
  /** a party name that only repeats the party's ID is hidden (utils/sales_common.js, controllers/buying.js refresh) */
  const hidePartyName = (frm: TxFrm, party: string) => {
    const name = frm?.doc?.[`${party}_name`];
    if (frm?.fields_dict?.[`${party}_name`]) frm.toggle_display(`${party}_name`, !!name && name !== frm.doc[party]);
  };
  (erpnext.selling as Record<string, unknown>).SellingController = class extends TransactionController {
    refresh() {
      super.refresh();
      hidePartyName(this.frm as unknown as TxFrm, "customer");
    }
  };
  (erpnext.buying as Record<string, unknown>).BuyingController = class extends TransactionController {
    refresh() {
      super.refresh();
      hidePartyName(this.frm as unknown as TxFrm, "supplier");
    }
  };
  (erpnext.stock as Record<string, unknown>).StockController = class extends Controller {};
  (erpnext.utils as Record<string, unknown>).get_fiscal_year = () => undefined;

  // Helpers from ERPNext's bundle we don't implement (erpnext.accounts.taxes.setup_tax_filters, …)
  // resolve to no-ops instead of aborting the whole DocType script.
  g.erpnext = lenient(erpnext);

  // copy own + prototype methods (except constructor) onto cscript
  // depends_on / collapsible_depends_on expressions see the same globals as in Desk
  setDependsOnGlobals({ frappe: rt.frappe, erpnext: g.erpnext, flt: g.flt, cint: g.cint, cstr: g.cstr, in_list: g.in_list, __: g.__ });

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
  // Desk keeps the open form at window.cur_frm too (people inspect it from the browser console)
  if (typeof window !== "undefined") (window as unknown as { cur_frm?: unknown }).cur_frm = opts.frm;

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
    opts.navigate?.(`${doctypeUrl(String(doc.doctype))}/new`);
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
  (frappe.ui.form as Record<string, unknown>).make_quick_entry = (dt: string) => opts.navigate?.(`${doctypeUrl(dt)}/new`);
  installShims(rt, opts);
}
