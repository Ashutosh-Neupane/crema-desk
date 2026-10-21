// Item stock levels (Desk: erpnext.stock.ItemDashboard, rendered by item.js into stock_levels_html): a unique stock
// Item with a submitted Material Receipt → the form lists the warehouse and actual qty from item_dashboard.get_data;
// Add opens the "Add Item" dialog, Move the "Move Item" one, and Create Stock Entry opens a prefilled new Stock Entry.
//   OUT=/tmp/shots node e2e/itemdashboard.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json());
const msg = async (method, data) => (await post(method, data)).message;
const ITEM = "TREVO-ITEMDASH-1";
const COMPANY = "Demo Company";
async function cleanup() {
  const names = new Set();
  for (const f of [{ doctype: "Stock Ledger Entry", fields: ["voucher_no"] }, { doctype: "Stock Entry Detail", fields: ["parent as voucher_no"], parent: "Stock Entry" }]) {
    for (const r of (await msg("frappe.client.get_list", { ...f, filters: { item_code: ITEM }, limit_page_length: 100 })) ?? []) names.add(r.voucher_no);
  }
  for (const name of names) {
    const se = await msg("frappe.client.get", { doctype: "Stock Entry", name });
    if (se?.docstatus === 1) await post("frappe.client.cancel", { doctype: "Stock Entry", name });
    await post("frappe.client.delete", { doctype: "Stock Entry", name });
  }
  // an item with stock ledger history cannot be deleted (Frappe: "disable this Item instead"), so fall back to disabling
  const del = await post("frappe.client.delete", { doctype: "Item", name: ITEM });
  if (del.exc || del.exception) await post("frappe.client.set_value", { doctype: "Item", name: ITEM, fieldname: "disabled", value: 1 });
}
await cleanup();

step("setup: item + 7 units received");
const wh = (await msg("frappe.client.get_list", { doctype: "Warehouse", filters: { company: COMPANY, is_group: 0 }, fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
check(!!wh, `warehouse of ${COMPANY}: ${wh}`);
if (await msg("frappe.client.get_value", { doctype: "Item", filters: { name: ITEM }, fieldname: "name" })) await post("frappe.client.set_value", { doctype: "Item", name: ITEM, fieldname: "disabled", value: 0 });
else await post("frappe.client.insert", { doc: { doctype: "Item", item_code: ITEM, item_name: ITEM, item_group: "All Item Groups", stock_uom: "Nos", is_stock_item: 1 } });
check(!!(await msg("frappe.client.get_value", { doctype: "Item", filters: { name: ITEM }, fieldname: "name" })), "item exists (enabled)");
const se = await msg("frappe.client.insert", { doc: { doctype: "Stock Entry", stock_entry_type: "Material Receipt", company: COMPANY, items: [{ item_code: ITEM, t_warehouse: wh, qty: 7, basic_rate: 10 }] } });
const sub = await post("frappe.client.submit", { doc: se });
check(sub.message?.docstatus === 1, "Material Receipt submitted");
const data = (await msg("erpnext.stock.dashboard.item_dashboard.get_data", { item_code: ITEM })) ?? [];
check(data.length === 1 && data[0].actual_qty === 7, `get_data: ${data[0]?.warehouse} actual ${data[0]?.actual_qty}`);

step("item form shows stock levels");
await page.goto(`${BASE}/desk/doctype/Item/${ITEM}`, { waitUntil: "domcontentloaded", timeout: 240000 });
await page.getByRole("tab", { name: "Inventory" }).click();
const lvl = page.locator(".stock-levels");
await lvl.locator(".dashboard-list-item").first().waitFor({ timeout: 120000 });
const item = lvl.locator(".dashboard-list-item");
check((await item.count()) === 1, "one row");
const text = await item.innerText();
check(text.includes(wh) && text.includes(ITEM), "row shows warehouse and item");
check(new RegExp(`\\b7\\b`).test(await item.locator(".inline-graph-half").nth(1).innerText()), "actual qty 7 in the bar");
check((await item.locator(".inline-graph-bar-inner.dark").evaluate((e) => e.style.width)) === "100%", "actual bar full width");
await shot("item_stock_levels");

step("Add opens the Add Item dialog");
await item.getByRole("button", { name: "Add", exact: true }).click();
const dlg = page.getByRole("dialog");
await dlg.waitFor({ timeout: 30000 });
check((await dlg.innerText()).includes("Add Item"), "Add Item dialog");
await shot("item_stock_add");
await dlg.getByLabel("Quantity").fill("3");
await dlg.getByRole("button", { name: "Create Stock Entry" }).click();
await page.waitForURL(/doctype\/Stock(%20| )Entry\/new/, { timeout: 60000 });
await page.waitForFunction((it) => [...document.querySelectorAll("input")].some((i) => i.value === it), ITEM, { timeout: 90000 });
check(true, "navigated to a new Stock Entry carrying the item row");
const vals = await page.locator("input").evaluateAll((els) => els.map((e) => e.value));
check(vals.includes("Material Receipt"), "Stock Entry type Material Receipt prefilled");
check(vals.includes(wh) && vals.includes("3"), "target warehouse and qty 3 prefilled");
await shot("item_stock_add_entry");

step("Move opens the Move Item dialog");
await page.goto(`${BASE}/desk/doctype/Item/${ITEM}`, { waitUntil: "domcontentloaded" });
await page.getByRole("tab", { name: "Inventory" }).click();
await lvl.locator(".dashboard-list-item").first().waitFor({ timeout: 90000 });
await lvl.getByRole("button", { name: "Move", exact: true }).click();
await dlg.waitFor({ timeout: 30000 });
check((await dlg.innerText()).includes("Move Item") && (await dlg.innerText()).includes("Available 7"), "Move Item dialog with Available 7");
await dlg.getByLabel("Quantity").fill("99");
await dlg.getByRole("button", { name: "Create Stock Entry" }).click();
await page.waitForTimeout(1000);
check(/Item\//.test(page.url()), "quantity above available is refused (stays on the item)");

step("cleanup");
await cleanup();
await t.finish();
