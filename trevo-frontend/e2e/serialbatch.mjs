// Serial & Batch selector (erpnext.SerialBatchPackageSelector): a Material Receipt draft with a batch-tracked item →
// the row's "Add Serial / Batch No" button opens the selector, a batch + qty are entered, and the Serial and Batch
// Bundle created by add_serial_batch_ledgers is linked to the row (verified on the server), then submitted.
//   OUT=/tmp/shots node e2e/serialbatch.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json();
const msg = async (method, data) => (await post(method, data)).message;
const ITEM = "TREVO-SB-ITEM-1";
const BATCH = "TREVO-SB-BATCH-1";
const CS = "Trevo SB Probe";
const COMPANY = "Demo Company";
const list = (doctype, filters, fields = ["name"]) => msg("frappe.client.get_list", { doctype, filters, fields, limit_page_length: 100 }).then((r) => r ?? []);

async function cleanup() {
  const names = new Set();
  for (const r of await list("Stock Ledger Entry", { item_code: ITEM }, ["voucher_no"])) names.add(r.voucher_no);
  for (const r of await list("Stock Entry Detail", { item_code: ITEM }, ["parent"])) names.add(r.parent);
  for (const name of names) {
    const se = await msg("frappe.client.get", { doctype: "Stock Entry", name });
    if (se?.docstatus === 1) await post("frappe.client.cancel", { doctype: "Stock Entry", name });
    await post("frappe.client.delete", { doctype: "Stock Entry", name });
  }
  for (const b of await list("Serial and Batch Bundle", { item_code: ITEM })) {
    const doc = await msg("frappe.client.get", { doctype: "Serial and Batch Bundle", name: b.name });
    if (doc?.docstatus === 1) await post("frappe.client.cancel", { doctype: "Serial and Batch Bundle", name: b.name });
    await post("frappe.client.delete", { doctype: "Serial and Batch Bundle", name: b.name });
  }
  await post("frappe.client.delete", { doctype: "Client Script", name: CS });
  await post("frappe.client.delete", { doctype: "Batch", name: BATCH });
  // an item with stock ledger history cannot be deleted: disable it instead
  const del = await post("frappe.client.delete", { doctype: "Item", name: ITEM });
  if (del.exc || del.exception) await post("frappe.client.set_value", { doctype: "Item", name: ITEM, fieldname: "disabled", value: 1 });
}
await cleanup();

// Item.has_batch_no can only be switched on while Stock Settings ▸ "Activate Serial / Batch No for Item" is on:
// enabled for the run and restored at the end
const SS = "enable_serial_and_batch_no_for_item";
const ssBefore = await msg("frappe.client.get_single_value", { doctype: "Stock Settings", field: SS });
await post("frappe.client.set_value", { doctype: "Stock Settings", name: "Stock Settings", fieldname: SS, value: 1 });
const restore = () => post("frappe.client.set_value", { doctype: "Stock Settings", name: "Stock Settings", fieldname: SS, value: String(ssBefore ?? 0) });

step("setup: batch-tracked item, batch, draft Material Receipt");
const wh = (await list("Warehouse", { company: COMPANY, is_group: 0 }))[0]?.name;
check(!!wh, `warehouse of ${COMPANY}: ${wh}`);
if ((await list("Item", { name: ITEM })).length) {
  await post("frappe.client.set_value", { doctype: "Item", name: ITEM, fieldname: "disabled", value: 0 });
} else {
  await post("frappe.client.insert", { doc: { doctype: "Item", item_code: ITEM, item_name: ITEM, item_group: "All Item Groups", stock_uom: "Nos", is_stock_item: 1, has_batch_no: 1, create_new_batch: 0 } });
}
const item = await msg("frappe.client.get", { doctype: "Item", name: ITEM });
check(item?.has_batch_no === 1, "item has_batch_no=1");
await post("frappe.client.insert", { doc: { doctype: "Batch", batch_id: BATCH, item: ITEM } });
check((await list("Batch", { name: BATCH })).length === 1, `batch ${BATCH} exists`);
const se = await msg("frappe.client.insert", { doc: { doctype: "Stock Entry", stock_entry_type: "Material Receipt", purpose: "Material Receipt", company: COMPANY, items: [{ item_code: ITEM, t_warehouse: wh, qty: 5, basic_rate: 10 }] } });
check(!!se?.name, `inserted ${se?.name}`);
if (!se?.name) {
  await cleanup();
  await restore();
  await t.finish();
}

step("open the draft in Trevo and click the row's Add Serial / Batch No");
await page.goto(`${BASE}/desk/doctype/Stock%20Entry/${encodeURIComponent(se.name)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("button", { name: "Edit row 1", exact: true }).waitFor({ timeout: 180000 });
await page.getByRole("button", { name: "Edit row 1", exact: true }).click();
const addBtn = page.getByRole("button", { name: "Add Serial / Batch No" });
await addBtn.waitFor({ timeout: 30000 });
await shot("row_form");
await addBtn.click();

const dlg = page.getByRole("dialog", { name: "Add Batch Nos" });
const opened = await dlg.waitFor({ timeout: 8000 }).then(() => true, () => false);
check(opened, "row button 'Add Serial / Batch No' opens the selector (child Button field → Stock Entry Detail event)");
if (!opened) {
  // Trevo's row form does not forward Button clicks to frm.script_manager.trigger(fieldname, cdt, cdn) (Grid.tsx FormBody
  // has no onButton). Reach the same ERPNext function (stock_entry.js add_serial_batch_bundle) from a form button instead.
  step("fallback: the same erpnext.stock.select_batch_and_serial_no call from a Client Script button");
  await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: "Stock Entry", view: "Form", enabled: 1, script: `frappe.ui.form.on("Stock Entry", { refresh(frm) { if (!frm.is_new()) frm.add_custom_button("Trevo SB Probe", () => erpnext.stock.select_batch_and_serial_no(frm, frm.doc.items[0])); } });` } });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Trevo SB Probe" }).click({ timeout: 180000 });
}
await dlg.waitFor({ timeout: 30000 });
check(true, "selector dialog 'Add Batch Nos' opened");
check((await dlg.getByLabel("Item Code", { exact: true }).inputValue()) === ITEM, "Item Code prefilled");
check((await dlg.getByLabel("Warehouse", { exact: true }).inputValue()) === wh, `Warehouse prefilled (${wh})`);
await dlg.getByRole("button", { name: "Add Row" }).click();
await dlg.getByLabel("Batch No row 1").fill(BATCH);
await dlg.getByLabel("Batch No row 1").press("Enter");
await dlg.getByLabel("Quantity row 1").fill("5");
await shot("selector_filled", false);
await dlg.getByRole("button", { name: "Add Batch Nos", exact: true }).click();

// Desk compares the rows' total with "Qty to Fetch" (only present for outward rows), so inward asks to confirm
const confirm = page.getByRole("dialog", { name: "Confirm" });
await confirm.waitFor({ timeout: 30000 }).catch(async (e) => {
  await shot("no_confirm", false);
  throw e;
});
check(/does not match the/.test(await confirm.innerText()), "confirm: total qty differs from Qty to Fetch (as in Desk)");
await confirm.getByRole("button", { name: "Yes" }).click();
await dlg.waitFor({ state: "detached", timeout: 60000 });
check(true, "selector closed after bundle created and form saved");

step("server state");
let row;
for (let i = 0; i < 40 && !row?.serial_and_batch_bundle; i++) {
  row = (await msg("frappe.client.get", { doctype: "Stock Entry", name: se.name }))?.items?.[0];
  if (!row?.serial_and_batch_bundle) await page.waitForTimeout(500);
}
check(!!row?.serial_and_batch_bundle, `row links bundle ${row?.serial_and_batch_bundle}`);
check(row?.qty === 5, `row qty ${row?.qty}`);
const bundle = await msg("frappe.client.get", { doctype: "Serial and Batch Bundle", name: row?.serial_and_batch_bundle ?? "-" });
check(bundle?.item_code === ITEM && bundle?.type_of_transaction === "Inward" && bundle?.warehouse === wh, `bundle ${bundle?.item_code} ${bundle?.type_of_transaction} ${bundle?.warehouse}`);
check(bundle?.entries?.length === 1 && bundle.entries[0].batch_no === BATCH && bundle.entries[0].qty === 5, `bundle entry ${bundle?.entries?.[0]?.batch_no} x ${bundle?.entries?.[0]?.qty}`);
check(bundle?.total_qty === 5, `bundle total_qty ${bundle?.total_qty}`);
await shot("after_save");

step("submit and check the stock ledger");
const doc = await msg("frappe.client.get", { doctype: "Stock Entry", name: se.name });
const sub = await post("frappe.client.submit", { doc });
check(sub.message?.docstatus === 1, `Stock Entry submitted${sub.message ? "" : ": " + JSON.stringify(sub).slice(0, 200)}`);
const sle = await list("Stock Ledger Entry", { voucher_no: se.name, item_code: ITEM }, ["actual_qty", "warehouse", "serial_and_batch_bundle"]);
check(sle.length === 1 && sle[0].actual_qty === 5 && sle[0].warehouse === wh, `SLE ${sle[0]?.actual_qty} in ${sle[0]?.warehouse}`);
const bq = await msg("erpnext.stock.doctype.batch.batch.get_batch_qty", { batch_no: BATCH, warehouse: wh, item_code: ITEM });
check(Number(bq) === 5, `batch qty in warehouse ${bq}`);

await cleanup();
await restore();
const ssAfter = await msg("frappe.client.get_single_value", { doctype: "Stock Settings", field: SS });
check(Number(ssAfter) === Number(ssBefore ?? 0), `Stock Settings restored (${ssBefore} -> ${ssAfter})`);
await t.finish();
