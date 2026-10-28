/**
 * DocType-family behaviour that Desk gets from app bundles (not from the
 * DocType's own JS), implemented natively against the same server methods.
 *
 * ERPNext transactions (Quotation, Sales Order/Invoice, Delivery Note,
 * Purchase Order/Invoice/Receipt, POS Invoice, Supplier Quotation) —
 * erpnext/public/js/controllers/transaction.js + taxes_and_totals.js:
 *  - party → erpnext.accounts.party.get_party_details
 *  - item_code → erpnext.stock.get_item_details.get_item_details
 *  - price list → apply_price_list, currency → get_exchange_rate
 *  - tax template → get_taxes_and_charges
 *  - live recalculation of rows, taxes, discounts and totals
 * The server recalculates on save (validate) and its values replace ours.
 */
import { flt } from "@/lib/desk-runtime";
import { deskCall } from "@/lib/frappe/form";
import type { FormController, Row } from "./FormController";

const PRECISION = 2;
const round2 = (n: number) => flt(n, PRECISION);

function isTransaction(ctl: FormController): boolean {
  const has = (f: string) => !!ctl.field(f);
  return has("items") && has("grand_total") && (has("selling_price_list") || has("buying_price_list"));
}

export function attachDoctypeAdapters(ctl: FormController) {
  if (isTransaction(ctl)) attachTransaction(ctl);
}

function attachTransaction(ctl: FormController) {
  const dt = ctl.meta.name;
  const selling = !!ctl.field("selling_price_list");
  const partyField = selling ? (ctl.field("customer") ? "customer" : "party_name") : "supplier";
  const priceListField = selling ? "selling_price_list" : "buying_price_list";
  const itemsDt = String(ctl.field("items")?.options ?? "");
  const taxesDt = String(ctl.field("taxes")?.options ?? "");
  let companyCurrency: string | null = null;
  let busy = false;

  const doc = () => ctl.getDoc() as Record<string, unknown>;
  const items = () => (doc().items as Row[]) ?? [];
  const has = (f: string, d = dt) => !!ctl.field(f, d);
  const onlyKnown = (values: Record<string, unknown>, d = dt) =>
    Object.fromEntries(Object.entries(values ?? {}).filter(([k]) => has(k, d) && k !== "doctype" && k !== "name"));

  async function getCompanyCurrency(): Promise<string | null> {
    if (companyCurrency) return companyCurrency;
    const company = doc().company;
    if (!company) return null;
    const { env } = await deskCall("frappe.client.get_value", { doctype: "Company", filters: { name: company }, fieldname: "default_currency" });
    companyCurrency = ((env.message as { default_currency?: string }) ?? {}).default_currency ?? null;
    return companyCurrency;
  }

  // ── party ────────────────────────────────────────────────────────────────
  async function partyChanged() {
    const d = doc();
    const party = d[partyField];
    if (!party || (partyField === "party_name" && d.quotation_to !== "Customer")) return;
    const { env } = await deskCall("erpnext.accounts.party.get_party_details", {
      party,
      party_type: selling ? "Customer" : "Supplier",
      company: d.company,
      posting_date: d.posting_date ?? d.transaction_date,
      doctype: dt,
      price_list: d[priceListField],
      currency: d.currency,
      fetch_payment_terms_template: 1,
      party_address: d.customer_address ?? d.supplier_address,
      shipping_address: d.shipping_address_name,
      company_address: d.company_address,
    });
    const r = (env.message ?? {}) as Record<string, unknown>;
    const { taxes, ...rest } = r;
    const values = onlyKnown(rest);
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined) delete values[k];
    }
    ctl.applyComputed(values);
    if (Array.isArray(taxes) && taxes.length) await ctl.set_value("taxes", taxes);
    if (values.currency) {
      await currencyChanged();
      await toggleCompanyCurrencyFields();
    }
    recalc();
  }

  // ── currency ─────────────────────────────────────────────────────────────
  async function currencyChanged() {
    const d = doc();
    const cc = await getCompanyCurrency();
    if (!d.currency || !cc) return;
    if (d.currency === cc) {
      ctl.applyComputed({ conversion_rate: 1 });
      return;
    }
    const { env } = await deskCall("erpnext.setup.utils.get_exchange_rate", {
      from_currency: d.currency,
      to_currency: cc,
      transaction_date: d.transaction_date ?? d.posting_date,
      args: selling ? "for_selling" : "for_buying",
    });
    if (env.message) ctl.applyComputed({ conversion_rate: flt(env.message) });
  }

  // ── items ────────────────────────────────────────────────────────────────
  async function itemCodeChanged(cdn: string) {
    const d = doc();
    const row = items().find((r) => r.name === cdn);
    if (!row) return;
    if (!row.item_code) return;
    const args = {
      item_code: row.item_code,
      barcode: row.barcode,
      set_warehouse: d.set_warehouse,
      warehouse: row.warehouse ?? d.set_warehouse,
      customer: d.customer ?? (d.quotation_to === "Customer" ? d.party_name : undefined),
      supplier: d.supplier,
      currency: d.currency,
      update_stock: d.update_stock,
      conversion_rate: d.conversion_rate,
      price_list: d[priceListField],
      price_list_currency: d.price_list_currency,
      plc_conversion_rate: d.plc_conversion_rate,
      company: d.company,
      order_type: d.order_type,
      is_pos: d.is_pos ?? 0,
      is_return: d.is_return ?? 0,
      is_subcontracted: d.is_subcontracted ?? 0,
      ignore_pricing_rule: d.ignore_pricing_rule ?? 0,
      doctype: dt,
      name: d.name,
      child_doctype: itemsDt,
      child_docname: row.name,
      qty: row.qty || 1,
      stock_qty: row.stock_qty,
      conversion_factor: row.conversion_factor,
      uom: row.uom,
      stock_uom: row.stock_uom,
      cost_center: row.cost_center,
      tax_category: d.tax_category,
      item_tax_template: row.item_tax_template,
      transaction_date: d.transaction_date,
      posting_date: d.posting_date,
      project: row.project ?? d.project,
    };
    // v16 names the first parameter `ctx`, v15 `args` — Frappe drops the one a version doesn't declare
    const { env } = await deskCall("erpnext.stock.get_item_details.get_item_details", { ctx: JSON.stringify(args), args: JSON.stringify(args), doc: JSON.stringify(d) });
    const details = onlyKnown((env.message ?? {}) as Record<string, unknown>, itemsDt);
    if (!details.qty && !row.qty) details.qty = 1;
    ctl.applyComputed({}, { items: { [cdn]: details } });
    recalc();
  }

  async function priceListChanged() {
    const d = doc();
    if (!d[priceListField] || !items().some((r) => r.item_code)) return;
    const plArgs = JSON.stringify({
        items: items().map((r) => ({ doctype: itemsDt, name: r.name, item_code: r.item_code, qty: r.qty, uom: r.uom, stock_uom: r.stock_uom, conversion_factor: r.conversion_factor })),
        customer: d.customer,
        supplier: d.supplier,
        currency: d.currency,
        conversion_rate: d.conversion_rate,
        price_list: d[priceListField],
        price_list_currency: d.price_list_currency,
        plc_conversion_rate: d.plc_conversion_rate,
        company: d.company,
        transaction_date: d.transaction_date,
        posting_date: d.posting_date,
        ignore_pricing_rule: d.ignore_pricing_rule,
        doctype: dt,
        name: d.name,
        is_return: d.is_return ?? 0,
      });
    const { env } = await deskCall("erpnext.stock.get_item_details.apply_price_list", { ctx: plArgs, args: plArgs });
    const r = (env.message ?? {}) as { parent?: Record<string, unknown>; children?: Array<Record<string, unknown>> };
    const rows: Record<string, Record<string, unknown>> = {};
    for (const c of r.children ?? []) if (typeof c.name === "string") rows[c.name] = onlyKnown(c, itemsDt);
    ctl.applyComputed(onlyKnown(r.parent ?? {}), { items: rows });
    recalc();
  }

  // ── taxes ────────────────────────────────────────────────────────────────
  async function taxTemplateChanged() {
    const d = doc();
    const tpl = d.taxes_and_charges;
    if (!tpl) return;
    const { env } = await deskCall("erpnext.controllers.accounts_controller.get_taxes_and_charges", {
      master_doctype: selling ? "Sales Taxes and Charges Template" : "Purchase Taxes and Charges Template",
      master_name: tpl,
    });
    if (Array.isArray(env.message)) await ctl.set_value("taxes", env.message);
    recalc();
  }

  // ── calculation (port of the core of erpnext.taxes_and_totals) ──────────
  function rowValues(r: Row, changed?: string): Record<string, unknown> {
    const qty = flt(r.qty);
    const plr = flt(r.price_list_rate);
    let rate = flt(r.rate);
    const out: Record<string, unknown> = {};
    if (has("margin_type", itemsDt) && plr) {
      const margin = r.margin_type === "Percentage" ? (plr * flt(r.margin_rate_or_amount)) / 100 : r.margin_type === "Amount" ? flt(r.margin_rate_or_amount) : 0;
      const withMargin = plr + margin;
      out.rate_with_margin = round2(withMargin);
      if (changed === "rate") {
        // manual rate → derive the discount from it
        const disc = withMargin - rate;
        out.discount_amount = round2(Math.max(disc, 0));
        out.discount_percentage = withMargin ? flt((Math.max(disc, 0) / withMargin) * 100, 6) : 0;
      } else if (changed === "discount_amount") {
        rate = withMargin - flt(r.discount_amount);
        out.discount_percentage = withMargin ? flt((flt(r.discount_amount) / withMargin) * 100, 6) : 0;
      } else if (["price_list_rate", "discount_percentage", "margin_type", "margin_rate_or_amount"].includes(changed ?? "") || !rate) {
        rate = withMargin * (1 - flt(r.discount_percentage) / 100);
        out.discount_amount = round2(withMargin - rate);
      }
    }
    rate = round2(rate);
    const conv = flt(doc().conversion_rate) || 1;
    const amount = round2(rate * qty);
    Object.assign(out, {
      rate,
      amount,
      net_rate: rate,
      net_amount: amount,
      base_rate: round2(rate * conv),
      base_amount: round2(amount * conv),
      base_net_rate: round2(rate * conv),
      base_net_amount: round2(amount * conv),
      base_price_list_rate: round2(plr * flt(doc().plc_conversion_rate || conv)),
    });
    if (has("stock_qty", itemsDt)) out.stock_qty = flt(qty * (flt(r.conversion_factor) || 1), 6);
    return Object.fromEntries(Object.entries(out).filter(([k]) => has(k, itemsDt)));
  }

  function recalc(changedRow?: string, changedField?: string) {
    if (busy) return;
    busy = true;
    try {
      const d = doc();
      const conv = flt(d.conversion_rate) || 1;
      const rowPatches: Record<string, Record<string, unknown>> = {};
      let totalQty = 0;
      let total = 0;
      for (const r of items()) {
        const patch = rowValues(r, r.name === changedRow ? changedField : undefined);
        rowPatches[r.name] = patch;
        totalQty += flt(r.qty);
        total += flt(patch.amount ?? r.amount);
      }
      total = round2(total);

      // additional discount on Net Total reduces the base taxes are computed on
      const applyOn = String(d.apply_discount_on ?? "Grand Total");
      let discount = flt(d.discount_amount);
      if (flt(d.additional_discount_percentage)) discount = 0; // recomputed below from the percentage
      let netTotal = total;
      if (applyOn === "Net Total") {
        if (flt(d.additional_discount_percentage)) discount = round2((total * flt(d.additional_discount_percentage)) / 100);
        netTotal = round2(total - discount);
      }

      const taxes = ((d.taxes as Row[]) ?? []).filter(Boolean);
      const taxPatches: Record<string, Record<string, unknown>> = {};
      let running = netTotal;
      const computed: Array<{ tax_amount: number; total: number }> = [];
      taxes.forEach((t, i) => {
        const rate = flt(t.rate);
        const prev = computed[Number(t.row_id) - 1] ?? computed[i - 1];
        let amount = 0;
        switch (t.charge_type) {
          case "On Net Total":
            amount = (netTotal * rate) / 100;
            break;
          case "Actual":
            amount = flt(t.tax_amount);
            break;
          case "On Previous Row Amount":
            amount = prev ? (prev.tax_amount * rate) / 100 : 0;
            break;
          case "On Previous Row Total":
            amount = prev ? (prev.total * rate) / 100 : 0;
            break;
          case "On Item Quantity":
            amount = totalQty * rate;
            break;
          default:
            amount = flt(t.tax_amount);
        }
        amount = round2(amount);
        const deduct = t.add_deduct_tax === "Deduct";
        const valuationOnly = t.category === "Valuation";
        if (!valuationOnly) running = round2(running + (deduct ? -amount : amount));
        computed.push({ tax_amount: amount, total: running });
        taxPatches[t.name] = Object.fromEntries(
          Object.entries({
            tax_amount: amount,
            tax_amount_after_discount_amount: amount,
            total: running,
            base_tax_amount: round2(amount * conv),
            base_tax_amount_after_discount_amount: round2(amount * conv),
            base_total: round2(running * conv),
          }).filter(([k]) => has(k, taxesDt)),
        );
      });
      const totalTaxes = round2(running - netTotal);
      let grand = round2(netTotal + totalTaxes);
      if (applyOn === "Grand Total") {
        if (flt(d.additional_discount_percentage)) discount = round2((grand * flt(d.additional_discount_percentage)) / 100);
        grand = round2(grand - discount);
      }
      const rounded = d.disable_rounded_total ? grand : Math.round(grand);
      const parent: Record<string, unknown> = {
        total_qty: totalQty,
        total,
        net_total: netTotal,
        base_total: round2(total * conv),
        base_net_total: round2(netTotal * conv),
        total_taxes_and_charges: totalTaxes,
        base_total_taxes_and_charges: round2(totalTaxes * conv),
        discount_amount: discount,
        base_discount_amount: round2(discount * conv),
        grand_total: grand,
        base_grand_total: round2(grand * conv),
        rounded_total: rounded,
        base_rounded_total: round2(rounded * conv),
        rounding_adjustment: round2(rounded - grand),
        base_rounding_adjustment: round2((rounded - grand) * conv),
      };
      ctl.applyComputed(Object.fromEntries(Object.entries(parent).filter(([k]) => has(k))), { items: rowPatches, taxes: taxPatches });
    } finally {
      busy = false;
    }
  }

  /** erpnext set_dynamic_labels: company-currency (base_*) fields only matter when currencies differ */
  async function toggleCompanyCurrencyFields() {
    const cc = await getCompanyCurrency();
    const same = !cc || doc().currency === cc;
    for (const f of ctl.meta.fields ?? []) {
      if (f.fieldname.startsWith("base_")) ctl.setDf(f.fieldname, "hidden", same ? 1 : 0);
    }
    for (const f of ctl.metas[itemsDt]?.fields ?? []) {
      if (f.fieldname.startsWith("base_")) ctl.setDf(`items.${f.fieldname}`, "hidden", same ? 1 : 0);
    }
    for (const f of ["conversion_rate", "plc_conversion_rate"]) {
      if (has(f)) ctl.setDf(f, "hidden", same && (f === "conversion_rate" || doc().price_list_currency === cc) ? 1 : 0);
    }
  }
  void toggleCompanyCurrencyFields();

  const ROW_CALC = new Set(["qty", "rate", "price_list_rate", "discount_percentage", "discount_amount", "margin_type", "margin_rate_or_amount", "conversion_factor", "uom"]);
  const DOC_CALC = new Set(["additional_discount_percentage", "discount_amount", "apply_discount_on", "conversion_rate", "plc_conversion_rate", "disable_rounded_total"]);

  ctl.watch(async ({ fieldname, cdt, cdn, table }) => {
    try {
      if (cdt === itemsDt && cdn) {
        if (fieldname === "item_code") await itemCodeChanged(cdn);
        else if (ROW_CALC.has(fieldname)) recalc(cdn, fieldname);
        return;
      }
      if (cdt === taxesDt) {
        recalc();
        return;
      }
      if (table === "items" || table === "taxes") {
        recalc();
        return;
      }
      if (cdt) return;
      if (fieldname === partyField || (fieldname === "party_name" && partyField === "party_name")) await partyChanged();
      else if (fieldname === priceListField) await priceListChanged();
      else if (fieldname === "currency" || fieldname === "price_list_currency") {
        await currencyChanged();
        await toggleCompanyCurrencyFields();
        recalc();
      } else if (fieldname === "taxes_and_charges") await taxTemplateChanged();
      else if (fieldname === "company") {
        companyCurrency = null;
        await toggleCompanyCurrencyFields();
      }
      else if (fieldname === "delivery_date" || fieldname === "schedule_date") {
        // Sales/Purchase Order: parent date flows to rows (sales_order.js / purchase_order.js)
        const patches: Record<string, Record<string, unknown>> = {};
        for (const r of items()) if (has(fieldname, itemsDt)) patches[r.name] = { [fieldname]: doc()[fieldname] };
        ctl.applyComputed({}, { items: patches });
      } else if (fieldname === "set_warehouse") {
        const patches: Record<string, Record<string, unknown>> = {};
        for (const r of items()) patches[r.name] = { warehouse: doc().set_warehouse };
        ctl.applyComputed({}, { items: patches });
      } else if (DOC_CALC.has(fieldname)) recalc();
    } catch (err) {
      console.warn("[erpnext adapter]", err);
    }
  });

  // new item rows inherit parent defaults, like TransactionController / sales_order.js items_add.
  // Desk fires `<table>_add` on the CHILD doctype (trigger(fieldname + "_add", cdt, cdn)).
  const handlers = ctl.runtime.frappe.ui.form.handlers;
  if (!handlers.has(itemsDt)) handlers.set(itemsDt, new Map());
  const childHandlers = handlers.get(itemsDt)!;
  if (!childHandlers.has("items_add")) childHandlers.set("items_add", []);
  childHandlers.get("items_add")!.unshift((_frm: unknown, _cdt: unknown, cdn: unknown) => {
    const d = doc();
    const first = items()[0];
    const patch: Record<string, unknown> = {};
    for (const f of ["delivery_date", "schedule_date"]) {
      if (!has(f, itemsDt)) continue;
      // parent date wins; otherwise copy the first row's (copy_from_first_row)
      if (d[f]) patch[f] = d[f];
      else if (first && first.name !== cdn && first[f]) patch[f] = first[f];
    }
    if (has("warehouse", itemsDt)) patch.warehouse = d.set_warehouse || (first && first.name !== cdn ? first.warehouse : undefined);
    if (d.cost_center && has("cost_center", itemsDt)) patch.cost_center = d.cost_center;
    ctl.applyComputed({}, { items: { [String(cdn)]: Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null)) } });
  });
}
