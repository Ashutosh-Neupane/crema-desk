// Form regressions:
//  1. a script hides a tab through field.tab (Desk form/tab.js), e.g. ERPNext's sales_order_proforma.js hides the
//     Proforma tab until a proforma invoice exists → the tab is not shown
//  2. "Create a new <DocType>" in a Link dropdown closes the dropdown before the new-record dialog opens (form field
//     and grid cell)
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/form.scripttabs.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const q = (o) => new URLSearchParams(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])));

step("Sales Order without proformas: no Proforma tab");
const sos = (await api(`api/resource/Sales Order?${q({ fields: ["name"], filters: [["docstatus", "=", 1]], limit_page_length: 20, order_by: "modified desc" })}`)).data ?? [];
let target = null;
for (const so of sos) {
  const n = (await api(`api/method/frappe.client.get_count?${q({ doctype: "Proforma Invoice", filters: [["sales_order", "=", so.name]] })}`)).message;
  if (!n) {
    target = so.name;
    break;
  }
}
if (!target) check(false, "a submitted Sales Order without proformas to test with");
else {
  await page.goto(`${BASE}/desk/sales-order/${encodeURIComponent(target)}`, { waitUntil: "domcontentloaded" });
  const tabs = page.getByRole("tablist").first();
  await tabs.getByRole("tab", { name: "Details" }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500); // the script's refresh + list render
  const names = await tabs.getByRole("tab").allInnerTexts();
  check(!names.some((n) => /proforma/i.test(n)), `no Proforma tab (${names.join(", ")})`);
  await shot("scripttabs_so", false);
}

step("Link: Create a new Customer closes the dropdown");
await page.goto(`${BASE}/desk/sales-order/new`, { waitUntil: "domcontentloaded" });
const cust = page.getByRole("combobox", { name: /^Customer/ }).first();
await cust.waitFor({ timeout: 60000 });
await cust.click();
await cust.fill(`zz new ${Date.now().toString(36)}`);
const create = page.getByRole("option", { name: /Create a new Customer/ });
await create.waitFor({ timeout: 15000 });
await create.click();
await page.getByRole("dialog").first().waitFor({ timeout: 15000 });
await page.waitForTimeout(300);
check(!(await page.getByRole("listbox").first().isVisible().catch(() => false)), "dropdown closed while the new Customer dialog is open");
await shot("scripttabs_create_customer", false);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

step("grid cell: Create a new Item closes the dropdown");
const cell = page.locator("[aria-label^='Select row']").first().locator("xpath=ancestor::div[contains(@class,'grid')][1]").locator("input").nth(1);
await cell.click();
await cell.fill(`zz item ${Date.now().toString(36)}`);
const createItem = page.getByRole("option", { name: /Create a new Item/ });
if (await createItem.waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) {
  await createItem.click();
  await page.waitForTimeout(1500);
  check(!(await page.getByRole("listbox").first().isVisible().catch(() => false)), "dropdown closed after Create a new Item");
  await shot("scripttabs_create_item", false);
} else check(false, "Create a new Item offered in the grid cell");

await t.finish();
