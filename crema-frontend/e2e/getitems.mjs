// ERPNext "Get Items From → Sales Order" on a new Sales Invoice: MultiSelectDialog + map_docs, saved and verified.
// Makes its own submitted Sales Order (customer and items from the site) and removes everything afterwards.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/getitems.mjs
import { start, BASE, defaultCompany } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const COMPANY = await defaultCompany(page);
const CUSTOMER = (await post("frappe.client.get_list", { doctype: "Customer", filters: { disabled: 0 }, fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
const ITEMS = ((await post("frappe.client.get_list", { doctype: "Item", filters: { is_sales_item: 1, disabled: 0, has_variants: 0 }, fields: ["name"], limit_page_length: 2 })) ?? []).map((i) => i.name);
check(!!CUSTOMER && ITEMS.length > 0, `site data: ${CUSTOMER}, items ${ITEMS.join(", ")}`);
const day = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

const so = await post("frappe.client.insert", { doc: { doctype: "Sales Order", company: COMPANY, customer: CUSTOMER, delivery_date: day, items: ITEMS.map((item_code, i) => ({ item_code, qty: i + 2, rate: 100 + i * 10, delivery_date: day })) } });
await post("frappe.client.submit", { doc: { ...so, docstatus: 0 } });
const SO = so.name;
let name = null;

try {
  step(`new Sales Invoice for ${CUSTOMER}`);
  await page.goto(`${BASE}/desk/doctype/Sales%20Invoice/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("heading", { name: "New Sales Invoice" }).waitFor({ timeout: 120000 });
  const cust = page.getByRole("combobox", { name: /^Customer/ }).first();
  await cust.click();
  await cust.fill(CUSTOMER);
  await page.getByRole("option", { name: CUSTOMER }).first().click();
  await page.waitForTimeout(2500);

  step("Get Items From → Sales Order");
  await page.getByRole("button", { name: /^Get Items From/ }).click();
  await page.getByRole("menuitem", { name: "Sales Order" }).click();
  const dlg = page.getByRole("dialog");
  const results = dlg.getByRole("table", { name: "Sales Order results" });
  await results.getByRole("checkbox", { name: `Select ${SO}` }).waitFor({ timeout: 60000 });
  const rows = await results.locator("tbody tr").count();
  check(rows >= 1, `dialog lists submitted orders for the customer (${rows})`);
  await results.getByRole("checkbox", { name: `Select ${SO}` }).check();
  await dlg.getByRole("button", { name: /^Get Items/ }).click();
  await dlg.waitFor({ state: "detached", timeout: 30000 });
  await page.waitForTimeout(2500);
  const values = await page.locator("main input").evaluateAll((els) => els.map((e) => e.value));
  check(ITEMS.every((c) => values.includes(c)), `${ITEMS.length} item(s) mapped from the order`);
  await shot("getitems_mapped", false);

  step("save → server keeps the link to the order");
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForURL(/Sales%20Invoice\/(?!new)/, { timeout: 60000 });
  name = decodeURIComponent(page.url().split("/").pop());
  const si = await post("frappe.client.get", { doctype: "Sales Invoice", name });
  check(si?.items?.length === ITEMS.length && si.items.every((r) => r.sales_order === SO), `${name}: ${ITEMS.length} row(s) linked to ${SO}`);
  check(si?.net_total === so.net_total, `net total ${si?.net_total} = order ${so.net_total}`);
} finally {
  step("cleanup");
  if (name) await post("frappe.client.delete", { doctype: "Sales Invoice", name });
  await post("frappe.client.cancel", { doctype: "Sales Order", name: SO });
  await post("frappe.client.delete", { doctype: "Sales Order", name: SO });
}
await t.finish();
