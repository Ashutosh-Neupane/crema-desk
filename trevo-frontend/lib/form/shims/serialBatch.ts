/**
 * erpnext.SerialBatchPackageSelector + erpnext.show_serial_batch_selector + erpnext.stock.select_batch_and_serial_no +
 * erpnext.stock.utils.get_serial_range, transcribed from ERPNext (erpnext/public/js/utils/serial_no_batch_selector.js,
 * public/js/controllers/transaction.js, stock/doctype/stock_entry/stock_entry.js, public/js/utils.js). Same constructor
 * `(frm, item, callback)`, same methods and whitelisted calls (add_serial_batch_ledgers, get_auto_data,
 * get_serial_batch_ledgers, create_serial_nos, upload_csv_file, is_serial_batch_no_exists, …) so ERPNext's own
 * `new erpnext.SerialBatchPackageSelector(frm, row, cb)` calls work unchanged. The dialog is the self-contained React
 * dialog in SerialBatchDialog.tsx (DeskDialog cannot render Table fields).
 * Differences: frappe.run_serially is unavailable → plain awaits; no Awesomplete/frappe.ui.form.Grid behaviour in the table.
 */
import type { Runtime } from "@/lib/desk-runtime";
import { PREFILL_KEY } from "@/lib/form/prefill";
import { SBDialog, type SBRow } from "./SerialBatchDialog";
import type { ShimOptions } from "./index";

/* eslint-disable @typescript-eslint/no-explicit-any -- ERPNext child rows / frm are untyped Desk objects */
type Fn = (...a: any[]) => any;
type Item = Record<string, any>;
type Frm = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function install(rt: Runtime, opts: ShimOptions) {
  const g = rt.globals as Record<string, Fn>;
  const frappe = rt.frappe as unknown as Record<string, any> & Record<string, Fn>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const __ = (s: string, args?: unknown[]) => g.__(s, args) as string;
  const flt = g.flt as (v: unknown, p?: number) => number;
  const provide = frappe.provide as unknown as (ns: string) => Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const erpnext = provide("erpnext");
  const stock = provide("erpnext.stock");
  const stockUtils = provide("erpnext.stock.utils");
  const SB = "erpnext.stock.doctype.serial_and_batch_bundle.serial_and_batch_bundle";
  const call = (o: Record<string, unknown>) => (frappe.call as Fn)(o) as Promise<{ message?: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any

  // erpnext.stock.utils.get_serial_range (public/js/utils.js)
  stockUtils.get_serial_range = (rangeString: string, separator: string) => {
    if (!rangeString) return;
    const [startStr, endStr] = rangeString.trim().split(separator);
    if (!startStr || !endStr) return;
    const endInt = parseInt(endStr);
    const lengthDifference = startStr.length - endStr.length;
    const startInt = parseInt(startStr.substring(lengthDifference));
    if (isNaN(startInt) || isNaN(endInt)) return;
    return Array(endInt - startInt + 1)
      .fill(1)
      .map((x, y) => x + y)
      .map((x) => x + startInt - 1)
      .map((val) => startStr.substring(0, lengthDifference) + val.toString().padStart(endStr.length, "0"));
  };

  erpnext.SerialBatchPackageSelector = class SerialNoBatchBundleUpdate {
    frm: Frm;
    item: Item;
    qty: number;
    callback?: Fn;
    bundle?: string;
    based_on?: string;
    dialog!: SBDialog;

    constructor(frm: Frm, item: Item, callback?: Fn) {
      this.frm = frm;
      this.item = item;
      this.qty = item.qty;
      this.callback = callback;
      this.bundle = this.item?.is_rejected ? this.item.rejected_serial_and_batch_bundle : this.item.serial_and_batch_bundle;
      void this.init();
    }

    async init() {
      try {
        this.based_on = await stock.get_pick_serial_batch_based_on();
      } catch {
        this.based_on = "FIFO";
      }
      this.based_on ||= "FIFO";
      this.make();
      this.render_data();
    }

    make() {
      let label = this.item?.has_serial_no ? __("Serial Nos") : __("Batch Nos");
      let primary_label = this.bundle ? __("Update") : __("Add");
      if (this.item?.has_serial_no && this.item?.has_batch_no) label = __("Serial Nos / Batch Nos");
      primary_label += " " + label;

      const outward = this.item?.type_of_transaction === "Outward";
      this.dialog = new SBDialog({
        title: this.item?.title || primary_label,
        primaryLabel: primary_label,
        secondaryLabel: __("Edit Full Form"),
        itemCode: this.item.item_code,
        hasSerial: !!this.item.has_serial_no,
        hasBatch: !!this.item.has_batch_no,
        outward,
        csvTitle: __("{0} {1} via CSV File", [primary_label, label]),
        manualTitle: __("{0} {1} Manually", [primary_label, label]),
        workOrder: this.frm.doc.doctype === "Stock Entry" && this.frm.doc.purpose === "Manufacture" ? this.frm.doc.work_order || "" : null,
        warehouse: this.get_warehouse(),
        basedOn: this.based_on,
        onPrimary: () => this.update_bundle_entries(),
        onSecondary: () => this.edit_full_form(),
        warehouseQuery: () => ({
          query: "erpnext.controllers.queries.warehouse_query",
          filters: [
            ["Bin", "item_code", "=", this.item.item_code],
            ["Warehouse", "is_group", "=", 0],
            ["Warehouse", "company", "=", this.frm.doc.company],
          ],
        }),
        serialQuery: () => ({ filters: this.get_serial_no_filters() }),
        batchQuery: () => this.get_batch_query(),
        on: {
          warehouse: () => {
            if (this.item?.is_rejected) this.item.rejected_warehouse = this.dialog.get_value("warehouse");
            else this.item.warehouse = this.dialog.get_value("warehouse");
            return this.get_auto_data();
          },
          qty: () => this.get_auto_data(),
          based_on: () => this.get_auto_data(),
          scan_serial_no: () => this.scan_barcode_data(),
          scan_batch_no: () => this.scan_barcode_data(),
          serial_no_range: () => this.set_serial_nos_from_range(),
          attach_serial_batch_csv: () => this.upload_csv_file(),
          download_csv: () => this.download_csv_file(),
          batch_row: (row?: SBRow) => {
            // Batch No `change`: an Outward row without qty gets the batch's available qty
            if (row && !row.qty && this.item.type_of_transaction === "Outward") {
              this.get_batch_qty(String(row.batch_no), (qty) => {
                row.qty = qty;
                this.dialog.touch();
              });
            }
          },
        },
      });
      this.dialog.show();

      let qty = this.item.stock_qty || this.item.transfer_qty || this.item.qty;
      if (this.item?.is_rejected) qty = this.item.rejected_qty;
      qty = Math.abs(qty);
      if (qty > 0) {
        void this.dialog.set_value("qty", qty).then(() => {
          if (this.item.serial_no && !this.item.serial_and_batch_bundle) {
            const serial_nos = this.item.serial_no.split("\n");
            if (serial_nos.length > 1) {
              serial_nos.forEach((serial_no: string) => {
                this.dialog.fields_dict.entries.df.data.push({ serial_no, batch_no: this.item.batch_no });
              });
            } else {
              void this.dialog.set_value("scan_serial_no", this.item.serial_no);
            }
            void frappe.model.set_value(this.item.doctype, this.item.name, "serial_no", "");
          } else if (this.item.batch_no && !this.item.serial_and_batch_bundle) {
            void this.dialog.set_value("scan_batch_no", this.item.batch_no);
            void frappe.model.set_value(this.item.doctype, this.item.name, "batch_no", "");
          }
          this.dialog.fields_dict.entries.grid.refresh();
        });
      }
    }

    get_serial_no_filters() {
      let warehouse = this.item?.type_of_transaction === "Outward" ? this.item.warehouse || this.item.s_warehouse : "";
      if (this.frm.doc.doctype === "Stock Entry") warehouse = this.item.s_warehouse || this.item.t_warehouse;
      if (!warehouse && this.frm.doc.doctype === "Stock Reconciliation") warehouse = this.get_warehouse();
      return { item_code: this.item.item_code, warehouse: ["=", warehouse] };
    }

    get_batch_query() {
      let is_inward = false;
      if (
        (["Purchase Receipt", "Purchase Invoice"].includes(this.frm.doc.doctype) && !this.frm.doc.is_return) ||
        (this.frm.doc.doctype === "Stock Entry" &&
          (this.frm.doc.purpose === "Material Receipt" || (this.frm.doc.purpose === "Manufacture" && this.item.is_finished_item)))
      ) {
        is_inward = true;
      }
      return {
        query: "erpnext.controllers.queries.get_batch_no",
        filters: {
          item_code: this.item.item_code,
          warehouse: this.item.s_warehouse || this.item.t_warehouse || this.item.warehouse,
          is_inward,
          posting_date: this.frm.doc.posting_date,
          posting_time: this.frm.doc.posting_time,
          include_expired_batches: this.include_expired_batches(),
        },
      };
    }

    set_serial_nos_from_range() {
      const serial_no_range = this.dialog.get_value("serial_no_range") as string;
      if (!serial_no_range) return;
      const serial_nos = stockUtils.get_serial_range(serial_no_range, "::");
      if (serial_nos) void this.dialog.set_value("upload_serial_nos", serial_nos.join("\n"));
    }

    create_serial_nos() {
      const { upload_serial_nos } = this.dialog.get_values() as { upload_serial_nos?: string };
      if (!upload_serial_nos) frappe.throw(__("Please enter Serial Nos"));
      return call({
        method: `${SB}.create_serial_nos`,
        args: { item_code: this.item.item_code, serial_nos: upload_serial_nos },
        callback: (r: { message?: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (r.message) {
            this.dialog.fields_dict.entries.df.data = [];
            this.set_data(r.message);
            void this.update_bundle_entries();
          }
        },
      });
    }

    download_csv_file() {
      let csvFileData = ["Serial No"];
      if (this.item.has_serial_no && this.item.has_batch_no) csvFileData = ["Serial No", "Batch No", "Quantity"];
      else if (this.item.has_batch_no) csvFileData = ["Batch No", "Quantity"];
      const method = `/api/method/${SB}.download_blank_csv_template?content=${encodeURIComponent(JSON.stringify(csvFileData))}`;
      // Trevo reaches the bench through its /api/frappe proxy
      const w = window.open(`/api/frappe${method}`);
      if (!w) frappe.msgprint(__("Please enable pop-ups"));
    }

    upload_csv_file() {
      const file_path = this.dialog.get_value("attach_serial_batch_csv");
      return call({
        method: `${SB}.upload_csv_file`,
        args: { item_code: this.item.item_code, file_path },
        callback: (r: { message: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (r.message.serial_nos && r.message.serial_nos.length) this.set_data(r.message.serial_nos);
          else if (r.message.batch_nos && r.message.batch_nos.length) this.set_data(r.message.batch_nos);
        },
      });
    }

    get_batch_qty(batch_no: string, callback: (qty: number) => void) {
      const warehouse = this.item.s_warehouse || this.item.t_warehouse || this.item.warehouse;
      return call({
        method: "erpnext.stock.doctype.batch.batch.get_batch_qty",
        args: { batch_no, warehouse, item_code: this.item.item_code, posting_date: this.frm.doc.posting_date, posting_time: this.frm.doc.posting_time },
        callback: (r: { message?: unknown }) => {
          if (r.message) callback(flt(r.message));
        },
      });
    }

    include_expired_batches() {
      return (
        this.frm.doc.doctype === "Stock Reconciliation" ||
        (this.frm.doc.doctype === "Stock Entry" && ["Material Receipt", "Material Transfer", "Material Issue"].includes(this.frm.doc.purpose))
      );
    }

    get_auto_data() {
      const values = this.dialog.get_values() as { qty?: number; based_on?: string };
      const qty = values.qty;
      let based_on = values.based_on;
      if (this.item.serial_and_batch_bundle || this.item.rejected_serial_and_batch_bundle) {
        if (this.qty && qty === Math.abs(this.qty)) return;
      }
      if (this.item.serial_no || this.item.batch_no) return;
      if (!based_on) based_on = this.based_on;

      let warehouse = this.item.warehouse || this.item.s_warehouse;
      if (this.item?.is_rejected) warehouse = this.item.rejected_warehouse;

      if (qty) {
        return call({
          method: `${SB}.get_auto_data`,
          args: {
            item_code: this.item.item_code,
            warehouse,
            has_serial_no: this.item.has_serial_no,
            has_batch_no: this.item.has_batch_no,
            qty,
            based_on,
            posting_date: this.frm.doc.posting_date,
            posting_time: this.frm.doc.posting_time,
            scio_detail: this.item.scio_detail,
          },
          callback: (r: { message?: SBRow[] }) => {
            if (r.message) {
              this.dialog.fields_dict.entries.df.data = r.message;
              this.dialog.fields_dict.entries.grid.refresh();
            }
          },
        });
      }
    }

    scan_barcode_data() {
      const { scan_serial_no, scan_batch_no } = this.dialog.get_values() as { scan_serial_no?: string; scan_batch_no?: string };
      void this.dialog.set_value("enter_manually", 0);
      if (scan_serial_no || scan_batch_no) {
        return call({
          method: `${SB}.is_serial_batch_no_exists`,
          args: { item_code: this.item.item_code, type_of_transaction: this.item.type_of_transaction, serial_no: scan_serial_no, batch_no: scan_batch_no },
          callback: () => this.update_serial_batch_no(),
        });
      }
    }

    update_serial_batch_no() {
      const { scan_serial_no, scan_batch_no } = this.dialog.get_values() as { scan_serial_no?: string; scan_batch_no?: string };
      const data = () => this.dialog.fields_dict.entries.df.data;

      if (scan_serial_no) {
        const existing_row = data().filter((d) => d.serial_no === scan_serial_no);
        if (existing_row?.length) frappe.throw(__("Serial No {0} already exists", [scan_serial_no]));

        if (!this.item.has_batch_no) {
          data().push({ serial_no: scan_serial_no });
          void this.dialog.fields_dict.scan_serial_no.set_value("");
        } else {
          void call({
            method: `${SB}.get_batch_no_from_serial_no`,
            args: { serial_no: scan_serial_no },
            callback: (r: { message?: string }) => {
              data().push({ serial_no: scan_serial_no, batch_no: r.message });
              void this.dialog.fields_dict.scan_serial_no.set_value("");
              this.dialog.fields_dict.entries.grid.refresh();
            },
          });
        }
      } else if (scan_batch_no) {
        const existing_row = data().filter((d) => d.batch_no === scan_batch_no);
        if (existing_row?.length) existing_row[0].qty = flt(existing_row[0].qty) + 1;
        else data().push({ batch_no: scan_batch_no, qty: 1 });
        void this.dialog.fields_dict.scan_batch_no.set_value("");
      }
      this.dialog.fields_dict.entries.grid.refresh();
    }

    update_bundle_entries() {
      const entries = (this.dialog.get_values() as { entries?: SBRow[] }).entries;
      const warehouse = this.dialog.get_value("warehouse") as string;
      const upload_serial_nos = this.dialog.get_value("upload_serial_nos");

      if (!entries?.length && upload_serial_nos) return this.create_serial_nos();
      if ((entries && !entries.length) || !entries) frappe.throw(__("Please add atleast one Serial No / Batch No"));
      if (!warehouse) frappe.throw(__("Please select a Warehouse"));
      if (this.item?.is_rejected && this.item.rejected_warehouse === this.item.warehouse) {
        frappe.throw(__("Rejected Warehouse and Accepted Warehouse cannot be same."));
      }

      const qty_to_fetch = flt(this.dialog.get_value("qty"));
      const total_qty = entries!.reduce((total, row) => total + (flt(row.qty) || 1.0), 0);

      if (flt(total_qty, 6) !== flt(qty_to_fetch, 6)) {
        const format_number = g.format_number as (n: number) => string;
        const confirm_dialog = frappe.confirm(
          __(
            "<strong>Total qty</strong> of the rows (<strong>{0}</strong>) does not match the <strong>Qty to Fetch</strong> (<strong>{1}</strong>). Qty of the item will be changed to <strong>{0}</strong>. Are you sure want to proceed?",
            [format_number(total_qty), format_number(qty_to_fetch)],
          ),
          () => this.create_bundle_entries(entries!, warehouse),
        );
        confirm_dialog.indicator = "blue";
        confirm_dialog.set_indicator?.();
        return;
      }
      return this.create_bundle_entries(entries!, warehouse);
    }

    async create_bundle_entries(entries: SBRow[], warehouse: string) {
      const r = await call({
        method: `${SB}.add_serial_batch_ledgers`,
        args: { entries, child_row: this.item, doc: this.frm.doc, warehouse },
      });
      // Desk: frappe.run_serially([callback, frm.save, dialog.hide])
      if (this.callback) await this.callback(r.message);
      await this.frm.save();
      this.dialog.hide();
    }

    edit_full_form() {
      const bundle_id = this.item.serial_and_batch_bundle;
      if (!bundle_id) {
        // new Serial and Batch Bundle form prefilled with the row's values (Desk: get_new_doc + set_route)
        const doc = {
          doctype: "Serial and Batch Bundle",
          item_code: this.item.item_code,
          warehouse: this.get_warehouse(),
          has_serial_no: this.item.has_serial_no,
          has_batch_no: this.item.has_batch_no,
          type_of_transaction: this.item.type_of_transaction,
          company: this.frm.doc.company,
          voucher_type: this.frm.doc.doctype,
        };
        sessionStorage.setItem(PREFILL_KEY(doc.doctype), JSON.stringify(doc));
        opts.navigate?.(`/desk/doctype/${encodeURIComponent(doc.doctype)}/new`);
      } else {
        void frappe.set_route("Form", "Serial and Batch Bundle", bundle_id);
      }
      this.dialog.hide();
    }

    get_warehouse() {
      if (this.item?.is_rejected) return this.item.rejected_warehouse;
      return this.item?.type_of_transaction === "Outward" ? this.item.warehouse || this.item.s_warehouse : this.item.warehouse || this.item.t_warehouse;
    }

    render_data() {
      if (this.bundle || (this.frm.doc.is_return && this.frm.doc.return_against)) {
        void call({
          method: `${SB}.get_serial_batch_ledgers`,
          args: {
            item_code: this.item.item_code,
            name: this.bundle,
            voucher_no: !this.frm.is_new() ? this.item.parent : "",
            child_row: this.frm.doc.is_return ? this.item : "",
          },
        }).then((r) => {
          if (r.message) this.set_data(r.message);
        });
      }
    }

    set_data(data: SBRow[]) {
      data.forEach((d) => {
        d.qty = Math.abs(Number(d.qty));
        d.name = (d.child_row as string) || d.name;
        this.dialog.fields_dict.entries.df.data.push(d);
      });
      this.dialog.fields_dict.entries.grid.refresh();
      if (this.dialog.fields_dict.entries.df.data?.length) void this.dialog.set_value("enter_manually", 0);
    }
  };

  // erpnext.show_serial_batch_selector (public/js/controllers/transaction.js)
  erpnext.show_serial_batch_selector = (frm: Frm, item_row: Item) => {
    let warehouse: unknown, receiving_stock: boolean | undefined, existing_stock: boolean | undefined;
    let warehouse_field = "warehouse";
    if (frm.doc.is_return) {
      if (["Purchase Receipt", "Purchase Invoice"].includes(frm.doc.doctype)) {
        existing_stock = true;
        warehouse = item_row.warehouse;
      } else if (["Delivery Note", "Sales Invoice"].includes(frm.doc.doctype)) {
        receiving_stock = true;
      }
    } else if (frm.doc.doctype == "Stock Entry") {
      if (frm.doc.purpose == "Material Receipt") {
        receiving_stock = true;
      } else {
        existing_stock = true;
        warehouse = item_row.s_warehouse;
      }
      warehouse_field = ["Material Transfer", "Send to Subcontractor", "Material Issue", "Material Consumption for Manufacture", "Material Transfer for Manufacture"].includes(frm.doc.purpose)
        ? "s_warehouse"
        : "t_warehouse";
    } else {
      existing_stock = true;
      warehouse = item_row.warehouse;
    }
    if (!warehouse) {
      if (receiving_stock) warehouse = ["like", ""];
      else if (existing_stock) warehouse = ["!=", ""];
    }

    if (["Sales Invoice", "Delivery Note"].includes(frm.doc.doctype)) item_row.type_of_transaction = frm.doc.is_return ? "Inward" : "Outward";
    else item_row.type_of_transaction = frm.doc.is_return ? "Outward" : "Inward";

    return new erpnext.SerialBatchPackageSelector(frm, item_row, (r: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (r) {
        const update_values: Record<string, unknown> = { serial_and_batch_bundle: r.name, qty: Math.abs(r.total_qty) };
        if (r.warehouse) update_values[warehouse_field] = r.warehouse;
        return frappe.model.set_value(item_row.doctype, item_row.name, update_values);
      }
    });
  };

  // erpnext.stock.select_batch_and_serial_no (stock_entry.js): the "Add Serial / Batch No" row button
  stock.select_batch_and_serial_no = (frm: Frm, item: Item) =>
    frappe.db.get_value("Item", item.item_code, ["has_batch_no", "has_serial_no"]).then((r: { message?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (r.message && (r.message.has_batch_no || r.message.has_serial_no)) {
        item.has_serial_no = r.message.has_serial_no;
        item.has_batch_no = r.message.has_batch_no;
        item.type_of_transaction = item.s_warehouse ? "Outward" : "Inward";
        new erpnext.SerialBatchPackageSelector(frm, item, (b: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (b) {
            return frappe.model.set_value(item.doctype, item.name, {
              serial_and_batch_bundle: b.name,
              use_serial_batch_fields: 0,
              basic_rate: b.avg_rate,
              qty: Math.abs(b.total_qty) / flt(item.conversion_factor || 1, (g.precision as Fn)("conversion_factor", item)),
            });
          }
        });
      }
    });
}
