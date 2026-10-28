/**
 * erpnext.stock.ItemDashboard + erpnext.stock.move_item / make_stock_entry, transcribed from ERPNext
 * (erpnext/stock/dashboard/item_dashboard.js, item_dashboard.html, item_dashboard_list.html; bundle
 * public/js/item-dashboard.bundle.js). item.js builds `new erpnext.stock.ItemDashboard({ parent: $wrapper, item_code,
 * page_length, method, template })` and calls refresh(); rows come from
 * erpnext.stock.dashboard.item_dashboard.get_data. Rendered with plain DOM into the (jQuery or DOM) parent.
 * Values from get_data are already escape_html()'d server-side (Desk interpolates them raw), so they are used as HTML.
 */
import type { Runtime } from "@/lib/desk-runtime";
import { PREFILL_KEY } from "@/lib/form/prefill";
import type { ShimOptions } from "./index";

type Row = {
  item_code: string;
  item_name: string;
  stock_uom: string;
  warehouse: string;
  projected_qty: number;
  reserved_qty: number;
  reserved_qty_for_production: number;
  reserved_qty_for_sub_contract: number;
  reserved_stock: number;
  actual_qty: number;
  valuation_rate?: number;
  disable_quick_entry?: unknown;
  actual_or_pending: number;
  pending_qty: number;
  total_reserved: number;
};
type Opts = Record<string, unknown> & { parent?: unknown };
type Fn = (...a: unknown[]) => unknown;

const MAKE_ENTRY = "erpnext.stock.dashboard.item_dashboard.make_stock_entry";
const pct = (n: number, max: number) => Math.trunc((n / max) * 100) || 0;

export function install(rt: Runtime, opts: ShimOptions) {
  const g = rt.globals;
  const frappe = rt.frappe as unknown as Record<string, Record<string, unknown> & Fn>;
  const __ = (s: string, args?: unknown[]) => (g.__ as (s: string, a?: unknown[]) => string)(s, args);
  const erpnext = (frappe.provide as unknown as (ns: string) => Record<string, unknown>)("erpnext.stock");
  const call = frappe.call as unknown as (o: Record<string, unknown>) => Promise<unknown>;

  // erpnext.stock.make_stock_entry: server builds the unsaved Stock Entry, the new form opens prefilled with it
  const makeStockEntry = (args: Record<string, unknown>) =>
    void call({
      method: MAKE_ENTRY,
      args,
      freeze: true,
      callback: (r: unknown) => {
        const doc = (r as { message?: Record<string, unknown> }).message;
        if (!doc?.doctype) return;
        sessionStorage.setItem(PREFILL_KEY(String(doc.doctype)), JSON.stringify(doc));
        opts.navigate?.(`/desk/doctype/${encodeURIComponent(String(doc.doctype))}/new`);
      },
    });
  erpnext.make_stock_entry = makeStockEntry;

  // erpnext.stock.move_item: the "Add Item" / "Move Item" dialog
  erpnext.move_item = (item: string, source: string | null, target: string | null, actualQty: unknown, rate: unknown, _uom: unknown, callback?: Fn) => {
    const Dialog = frappe.ui.Dialog as unknown as new (o: Record<string, unknown>) => {
      show(): void;
      hide(): void;
      get_value(f: string): unknown;
    };
    const flt = g.flt as (v: unknown) => number;
    const d: InstanceType<typeof Dialog> = new Dialog({
      title: target ? __("Add Item") : __("Move Item"),
      fields: [
        { fieldname: "item_code", label: __("Item"), fieldtype: "Link", options: "Item", read_only: 1, default: item },
        { fieldname: "source", label: __("Source Warehouse"), fieldtype: "Link", options: "Warehouse", read_only: 1, hidden: source ? 0 : 1, default: source ?? undefined },
        {
          fieldname: "target", label: __("Target Warehouse"), fieldtype: "Link", options: "Warehouse", reqd: 1,
          read_only: target ? 1 : 0, default: target ?? undefined, get_query: () => ({ filters: { is_group: 0 } }),
        },
        { fieldname: "qty", label: __("Quantity"), reqd: 1, fieldtype: "Float", description: __("Available {0}", [actualQty]) },
        { fieldname: "rate", label: __("Rate"), fieldtype: "Currency", hidden: rate ? 0 : 1, default: rate ? flt(rate) : undefined },
      ],
      primary_action_label: __("Create Stock Entry"),
      primary_action: () => {
        const qty = flt(d.get_value("qty"));
        if (qty <= 0) return void (frappe.msgprint as Fn)(__("Quantity must be greater than zero"));
        if (source && qty > flt(actualQty)) return void (frappe.msgprint as Fn)(__("Quantity must be less than or equal to {0}", [actualQty]));
        if (d.get_value("source") === d.get_value("target")) return void (frappe.msgprint as Fn)(__("Source and target warehouse must be different"));
        d.hide();
        makeStockEntry({
          item_code: d.get_value("item_code"),
          source_warehouse: d.get_value("source"),
          target_warehouse: d.get_value("target"),
          qty: d.get_value("qty"),
          rate: d.get_value("rate"),
        });
        callback?.();
      },
    });
    d.show();
  };

  erpnext.ItemDashboard = class ItemDashboard {
    [k: string]: unknown;
    content!: HTMLElement;
    result!: HTMLElement;
    start = 0;
    max_count = 0;
    page_length = 20;
    sort_by?: string;
    sort_order?: string;
    method?: string;

    constructor(o: Opts) {
      Object.assign(this, o);
      // scripts reach the instance through the lenient `erpnext` namespace proxy (erpnext.item.item_dashboard.refresh()),
      // which would hand methods a Proxy `this` whose DOM members are proxied too: bind them to the real instance
      for (const name of ["make", "handleMoveAdd", "refresh", "render", "get_item_dashboard_data", "list"] as const) {
        const fn = this[name] as Fn;
        (this as Record<string, unknown>)[name] = fn.bind(this);
      }
      this.make();
    }

    make() {
      this.start = 0;
      if (!this.sort_by) {
        this.sort_by = "projected_qty";
        this.sort_order = "asc";
      }
      const p = this.parent as { [0]?: unknown } | HTMLElement | undefined;
      const parent = (p && "nodeType" in p ? p : (p as { [0]?: HTMLElement } | undefined)?.[0]) as HTMLElement | undefined;
      const root = document.createElement("div");
      root.className = "stock-levels";
      root.innerHTML = `<div class="result"></div><div class="more hidden px-4 py-3"><button type="button" class="btn-more rounded-md border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">${__("More")}</button></div>`;
      parent?.appendChild(root);
      this.content = root;
      this.result = root.querySelector(".result") as HTMLElement;

      root.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
        if (!btn) return;
        if (btn.classList.contains("btn-more")) {
          this.start += this.page_length;
          this.refresh();
        } else if (btn.classList.contains("btn-move")) this.handleMoveAdd(btn, "Move");
        else if (btn.classList.contains("btn-add")) this.handleMoveAdd(btn, "Add");
      });
      root.addEventListener("click", (e) => {
        const a = (e.target as HTMLElement).closest("a[data-type]") as HTMLElement | null;
        if (!a) return;
        const name = a.dataset.name ?? "";
        const doctype = a.dataset.type === "warehouse" ? "Warehouse" : "Item";
        opts.navigate?.(`/desk/doctype/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
      });
    }

    handleMoveAdd(el: HTMLElement, action: "Move" | "Add") {
      const d = el.dataset;
      const entryType = action === "Move" ? "Material Transfer" : "Material Receipt";
      if (Number(d.disable_quick_entry)) {
        const transfer = entryType === "Material Transfer";
        makeStockEntry({ item_code: d.item, source_warehouse: transfer ? d.warehouse : null, target_warehouse: transfer ? null : d.warehouse, stock_entry_type: entryType });
      } else if (action === "Add") {
        (erpnext.move_item as Fn)(d.item, null, d.warehouse, d.actual_qty, d.rate, d.stockUom, () => this.refresh());
      } else {
        (erpnext.move_item as Fn)(d.item, d.warehouse, null, d.actual_qty, null, d.stockUom, () => this.refresh());
      }
    }

    refresh() {
      (this.before_refresh as Fn | undefined)?.call(this);
      void call({
        method: this.method ?? "erpnext.stock.dashboard.item_dashboard.get_data",
        args: {
          item_code: this.item_code, warehouse: this.warehouse, parent_warehouse: this.parent_warehouse, item_group: this.item_group,
          company: this.company, start: this.start, sort_by: this.sort_by, sort_order: this.sort_order,
        },
        callback: (r: unknown) => {
          this.render((r as { message?: Row[] }).message);
          (this.after_refresh as Fn | undefined)?.call(this);
        },
      });
    }

    render(data?: Row[]) {
            if (this.start === 0) {
        this.max_count = 0;
        this.result.innerHTML = "";
      }
      const rows = data ?? [];
      const more = this.content.querySelector(".more") as HTMLElement;
      // a full page + 1 means there is more; the extra row is dropped
      if (rows.length === this.page_length + 1) {
        more.classList.remove("hidden");
        rows.splice(-1);
      } else more.classList.add("hidden");
      const ctx = this.get_item_dashboard_data(rows, this.max_count, true);
      if (rows.length) {
        this.result.classList.remove("text-center");
        this.result.insertAdjacentHTML("beforeend", this.list(ctx));
      } else {
        this.result.classList.add("text-center");
        this.result.insertAdjacentHTML("beforeend", `<div class="text-muted mx-1 my-5 text-sm text-zinc-500 dark:text-zinc-400">${__("No Stock Available Currently")}</div>`);
      }
    }

    get_item_dashboard_data(data: Row[], maxCount: number, showItem: boolean) {
      let max = maxCount || 0;
      data.forEach((d) => {
        d.actual_or_pending = d.projected_qty + d.reserved_qty + d.reserved_qty_for_production + d.reserved_qty_for_sub_contract;
        d.pending_qty = 0;
        d.total_reserved = d.reserved_qty + d.reserved_qty_for_production + d.reserved_qty_for_sub_contract;
        if (d.actual_or_pending > d.actual_qty) d.pending_qty = d.actual_or_pending - d.actual_qty;
        max = Math.max(d.actual_or_pending, d.actual_qty, d.total_reserved, max);
      });
      this.max_count = max;
      const can_write = !!(frappe.model.can_write as Fn)("Stock Entry");
      return { data, max_count: max, can_write, show_item: showItem };
    }

    /** item_dashboard_list.html */
    list(c: { data: Row[]; max_count: number; can_write: boolean; show_item: boolean }) {
      const btn = "rounded-md border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";
      const link = "cursor-pointer text-sky-700 hover:underline dark:text-sky-400";
      return c.data
        .map((d) => {
          const attrs = `data-disable_quick_entry="${d.disable_quick_entry ? 1 : 0}" data-warehouse="${d.warehouse}" data-actual_qty="${d.actual_qty}" data-stock-uom="${d.stock_uom}" data-item="${d.item_code}"`;
          const reservedW = Math.trunc((Math.abs(d.total_reserved) / c.max_count) * 100) || 5;
          return `<div class="dashboard-list-item border-b border-zinc-200 py-2 text-sm dark:border-zinc-800"><div class="grid grid-cols-12 items-center gap-2">
  <div class="col-span-3"><a role="link" tabindex="0" class="${link}" data-type="warehouse" data-name="${d.warehouse}">${d.warehouse}</a></div>
  <div class="col-span-3">${c.show_item ? `<a role="link" tabindex="0" class="${link}" data-type="item" data-name="${d.item_code}">${d.item_code}${d.item_name !== d.item_code ? ` (${d.item_name})` : ""}</a>` : ""}</div>
  <div class="col-span-1" title="${__("Reserved Stock")}">${d.reserved_stock}</div>
  <div class="col-span-3 flex gap-2">
    <span class="inline-graph-half flex-1" title="${__("Reserved Qty")}"><span class="inline-graph-count block text-xs tabular-nums">${d.total_reserved}</span>
      <span class="inline-graph-bar block h-1.5 rounded bg-zinc-100 dark:bg-zinc-800"><span class="inline-graph-bar-inner block h-full rounded bg-zinc-400 dark:bg-zinc-500" style="width:${reservedW}%"></span></span></span>
    <span class="inline-graph-half flex-1" title="${__("Actual Qty {0} / Waiting Qty {1}", [d.actual_qty, d.pending_qty])}"><span class="inline-graph-count block text-xs tabular-nums">${d.actual_qty} ${d.pending_qty > 0 ? `(${d.pending_qty})` : ""}</span>
      <span class="inline-graph-bar flex h-1.5 rounded bg-zinc-100 dark:bg-zinc-800"><span class="inline-graph-bar-inner dark block h-full rounded bg-zinc-700 dark:bg-zinc-200" style="width:${pct(d.actual_qty, c.max_count)}%"></span>${d.pending_qty > 0 ? `<span class="inline-graph-bar-inner block h-full bg-zinc-400 dark:bg-zinc-500" title="${__("Projected Qty")}" style="width:${pct(d.pending_qty, c.max_count)}%"></span>` : ""}</span></span>
  </div>
  ${c.can_write ? `<div class="col-span-2 flex justify-end gap-2">${d.actual_qty ? `<button type="button" class="btn-move ${btn}" ${attrs}>${__("Move")}</button>` : ""}<button type="button" class="btn-add ${btn}" ${attrs} data-rate="${d.valuation_rate ?? ""}">${__("Add")}</button></div>` : ""}
</div></div>`;
        })
        .join("");
    }
  };
}
