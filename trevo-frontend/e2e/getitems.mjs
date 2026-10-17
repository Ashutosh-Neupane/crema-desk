// ERPNext "Get Items From → Sales Order" on a new Sales Invoice: MultiSelectDialog + map_docs, saved and verified.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/getitems.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const SO = "SAL-ORD-2026-00003";

step("new Sales Invoice for Everest Foods");
await page.goto(`${BASE}/desk/doctype/Sales%20Invoice/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: "New Sales Invoice" }).waitFor({ timeout: 120000 });
const cust = page.getByRole("combobox", { name: /^Customer/ }).first();
await cust.click();
await cust.fill("Everest");
await page.getByRole("option", { name: /Everest Foods/ }).first().click();
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
const gridText = (await page.locator("main input").evaluateAll((els) => els.map((e) => e.value))).join(" ") + (await page.locator("main").innerText());
check(["SUGAR-1", "TEA-500", "NOODLE-B"].every((c) => gridText.includes(c)), "three items mapped from the order");
await shot("getitems_mapped", false);

step("save → server keeps the link to the order");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForURL(/Sales%20Invoice\/(?!new)/, { timeout: 60000 });
const name = decodeURIComponent(page.url().split("/").pop());
const si = await post("frappe.client.get", { doctype: "Sales Invoice", name });
check(si?.items?.length === 3 && si.items.every((r) => r.sales_order === SO), `${name}: 3 rows linked to ${SO}`);
check(si?.grand_total === 12670, `grand total ${si?.grand_total}`);

step("cleanup");
await post("frappe.client.delete", { doctype: "Sales Invoice", name });
await t.finish();
