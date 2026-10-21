/**
 * erpnext.accounts.ledger_preview — transcription of erpnext/public/js/utils/ledger_preview.js.
 * Same names/signatures; the Preview ▸ Accounting Ledger / Stock Ledger buttons call the same whitelisted
 * methods and show the returned columns/rows in a frappe.ui.Dialog. DeskDialog has no live DOM wrapper for
 * frappe.DataTable, so the table is rendered as static HTML into the HTML field's `options` (which the HTML
 * control displays). Limitation: no inline column filters / column resizing like frappe-datatable.
 */
import type { Runtime } from "@/lib/desk-runtime";
import { DeskDialog } from "@/lib/desk-runtime/dialogs";
import { formatCurrency } from "@/lib/frappe/format";
import type { ShimOptions } from "./index";

interface PreviewColumn {
  name?: string;
  fieldtype?: string;
  options?: string;
  width?: number;
}
type FrmLike = {
  doc: Record<string, unknown>;
  is_new: () => boolean;
  add_custom_button: (label: string, fn: () => void, group?: string) => unknown;
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const NUMERIC = new Set(["Currency", "Float", "Int", "Percent"]);

/** Static equivalent of get_datatable(): a header row + one <tr> per data row; Currency cells via format_currency */
export function ledgerTableHtml(columns: PreviewColumn[], data: unknown[][]): string {
  const th = columns
    .map((c) => `<th class="whitespace-nowrap border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 text-left text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ${NUMERIC.has(c.fieldtype ?? "") ? "!text-right" : ""}">${esc(c.name)}</th>`)
    .join("");
  const body = data
    .map((row) => {
      const tds = columns
        .map((c, i) => {
          const v = row[i];
          const isNum = NUMERIC.has(c.fieldtype ?? "");
          const text = c.fieldtype === "Currency" ? formatCurrency(v, c.options) : v === "" || v == null ? "" : String(v);
          return `<td class="border-b border-zinc-100 px-2 py-1.5 text-sm dark:border-zinc-800 ${isNum ? "whitespace-nowrap text-right tabular-nums" : ""}">${esc(text)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  return `<div class="overflow-x-auto" data-testid="ledger-preview"><table aria-label="Ledger preview" class="w-full border-collapse"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function install(rt: Runtime, _opts: ShimOptions) {
  const frappe = rt.frappe as unknown as { call: (o: Record<string, unknown>) => unknown; msgprint: (m: unknown) => void; provide: (ns: string) => Record<string, unknown> };
  const __ = (s: string) => (rt.globals.__ as ((t: string) => string) | undefined)?.(s) ?? s;
  const accounts = frappe.provide("erpnext.accounts");

  const preview = {
    show_accounting_ledger_preview(frm: FrmLike) {
      if (!frm.is_new() && frm.doc.docstatus == 0) {
        frm.add_custom_button(
          __("Accounting Ledger"),
          () => {
            frappe.call({
              type: "GET",
              method: "erpnext.controllers.stock_controller.show_accounting_ledger_preview",
              args: { company: frm.doc.company, doctype: frm.doc.doctype, docname: frm.doc.name },
              callback: (response: { message: { gl_columns: PreviewColumn[]; gl_data: unknown[][] } }) => {
                preview.make_dialog("Accounting Ledger Preview", "accounting_ledger_preview_html", response.message.gl_columns, response.message.gl_data);
              },
            });
          },
          __("Preview"),
        );
      }
    },

    show_stock_ledger_preview(frm: FrmLike) {
      if (!frm.is_new() && frm.doc.docstatus == 0) {
        frm.add_custom_button(
          __("Stock Ledger"),
          () => {
            frappe.call({
              type: "GET",
              method: "erpnext.controllers.stock_controller.show_stock_ledger_preview",
              args: { company: frm.doc.company, doctype: frm.doc.doctype, docname: frm.doc.name },
              callback: (response: { message: { sl_columns: PreviewColumn[]; sl_data: unknown[][] } }) => {
                preview.make_dialog("Stock Ledger Preview", "stock_ledger_preview_html", response.message.sl_columns, response.message.sl_data);
              },
            });
          },
          __("Preview"),
        );
      }
    },

    make_dialog(label: string, fieldname: string, columns: PreviewColumn[], data: unknown[][]) {
      if (data.length === 0 && fieldname === "accounting_ledger_preview_html") {
        frappe.msgprint("<strong>" + __("No Impact on Accounting Ledger") + "</strong>");
      } else {
        const dialog = new DeskDialog({
          size: "extra-large",
          title: __(label),
          fields: [{ fieldtype: "HTML", fieldname, options: ledgerTableHtml(columns, data) }],
        });
        dialog.show();
      }
    },
  };
  Object.assign(accounts, { ledger_preview: preview });
}
