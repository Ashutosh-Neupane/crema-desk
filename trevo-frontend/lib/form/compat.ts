/**
 * Globals that app form JS expects from Desk's bundles, so ERPNext-style
 * scripts load instead of throwing on their first line:
 *  - frappe.ui.form.Controller and the ERPNext controller bases
 *    (TransactionController, SellingController, BuyingController, StockController)
 *    — empty bases: Trevo provides the behaviour natively (see lib/erpnext)
 *  - extend_cscript(cscript, controller) — copies controller methods onto frm.cscript
 *  - frappe.model.open_mapped_doc — "Create → Delivery Note" style mapping via
 *    the app's whitelisted make_* method, opened as a new unsaved form
 */
import type { Runtime } from "@/lib/desk-runtime";
import { deskCall } from "@/lib/frappe/form";
import { PREFILL_KEY } from "@/lib/form/prefill";

/** Chainable no-op: callable, constructible, any property → itself */
const NOOP: unknown = new Proxy(function () {}, {
  get: (_t, p) => (p === "prototype" ? {} : p === Symbol.toPrimitive ? () => "" : p === "then" ? undefined : NOOP),
  apply: () => undefined,
  construct: () => ({}),
});

/** Namespace proxy: real members as-is (namespaces wrapped too), missing ones → NOOP */
function lenient(obj: Record<string, unknown>): Record<string, unknown> {
  return new Proxy(obj, {
    get(target, prop) {
      if (typeof prop === "symbol") return (target as Record<symbol, unknown>)[prop];
      if (!(prop in target)) return NOOP;
      const v = target[prop];
      return v && typeof v === "object" && !Array.isArray(v) ? lenient(v as Record<string, unknown>) : v;
    },
  });
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
  (frappe.ui.form as Record<string, unknown>).Controller = Controller;

  const provide = rt.frappe.provide as (ns: string) => Record<string, unknown>;
  const erpnext = provide("erpnext");
  provide("erpnext.utils");
  provide("erpnext.selling");
  provide("erpnext.buying");
  provide("erpnext.stock");
  provide("erpnext.accounts");
  provide("erpnext.taxes");
  class TransactionController extends Controller {}
  // ERPNext controller subclasses call many base helpers (setup_accounting_dimension_triggers,
  // set_dynamic_labels, …); Trevo implements their effects natively, so missing ones are no-ops.
  Object.setPrototypeOf(
    TransactionController.prototype,
    new Proxy(Controller.prototype, {
      get(target, prop, receiver) {
        if (typeof prop === "symbol" || prop in target) return Reflect.get(target, prop, receiver);
        return () => undefined;
      },
    }),
  );
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
    while (proto && proto !== Object.prototype) {
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
}
