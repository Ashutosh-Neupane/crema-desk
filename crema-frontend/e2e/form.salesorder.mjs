// Sales Order lifecycle through the UI, verified against ERPNext:
// new → customer (get_party_details) → item (get_item_details: rate) → qty →
// live totals → mandatory check → save (server totals) → submit → cancel → amend → delete.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/form.salesorder.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const warnings = [];
page.on("console", (m) => m.type() === "warning" && /\[form\]|\[erpnext|desk-runtime/.test(m.text()) && warnings.push(m.text().slice(0, 240)));
const SO = `${BASE}/desk/doctype/Sales%20Order`;
const field = (label) => page.getByLabel(label, { exact: true }).first();
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const money = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// test data from this site: any enabled customer, and an item priced in the default selling price list
const priceList = (await api("api/method/frappe.client.get_single_value?doctype=Selling%20Settings&field=selling_price_list")).message;
const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === "string" ? v : JSON.stringify(v))}`).join("&");
const CUSTOMER = (await api(`api/resource/Customer?${q({ filters: [["disabled", "=", 0]], limit_page_length: 1 })}`)).data?.[0]?.name;
const price = (await api(`api/resource/Item%20Price?${q({ fields: ["item_code", "price_list_rate"], filters: [["price_list", "=", priceList]], limit_page_length: 1 })}`)).data?.[0];
if (!CUSTOMER || !price) {
  console.log(`SKIPPED: needs an enabled Customer and an Item Price in "${priceList}" (customer ${CUSTOMER}, price ${JSON.stringify(price)})`);
  await t.finish();
  process.exit(0);
}
const ITEM = price.item_code;
const RATE = price.price_list_rate;
console.log(`  data: customer ${CUSTOMER}, item ${ITEM} at ${RATE} (${priceList})`);

step("new Sales Order");
await page.goto(`${SO}/new`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "New Sales Order" }).waitFor({ timeout: 60000 });
check(await page.getByText("Not Saved").isVisible(), "Not Saved indicator");
check((await page.locator("[aria-label^='Select row']").count()) === 1, "one empty item row (mandatory table)");

step("save empty → missing fields dialog");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.getByText("Missing fields").waitFor({ timeout: 10000 });
check(await page.getByText(/Customer/).first().isVisible(), "lists Customer as missing");
await page.getByRole("button", { name: "OK" }).click();

step("customer → party details");
await field("Customer").click();
await field("Customer").fill(CUSTOMER);
await page.getByRole("option", { name: new RegExp(esc(CUSTOMER)) }).first().click();
await page.waitForTimeout(2500);
check((await field("Customer Name").textContent().catch(() => "")) !== null, "customer set");

step("delivery date");
const dd = page.getByRole("textbox", { name: /^Delivery Date/ }).first();
await dd.click();
await dd.fill(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
await dd.press("Enter");
await page.waitForTimeout(800);
const rowDate = await page.getByRole("textbox", { name: "Delivery Date", exact: true }).nth(1).inputValue().catch(() => "");
check(!!rowDate, `parent delivery date copied to item row (${rowDate})`);

step("free text in Item Code is rejected (Link validation)");
const row1 = page.locator("[aria-label^='Select row']").first().locator("xpath=ancestor::div[contains(@class,'grid')][1]").locator("input").nth(1);
await row1.click();
await row1.fill("NOT-AN-ITEM");
await row1.press("Tab");
await page.waitForTimeout(2000);
check(await page.getByText(/NOT-AN-ITEM does not exist/).first().isVisible(), "'does not exist' message shown");
check((await row1.inputValue()) === "", "invalid Item Code cleared");

step("item → get_item_details fills rate");
const itemCell = page.locator("[aria-label^='Select row']").first().locator("xpath=ancestor::div[contains(@class,'grid')][1]").locator("input").nth(1);
await itemCell.click();
await itemCell.fill(ITEM);
await page.waitForTimeout(800);
await page.getByRole("button", { name: new RegExp(esc(ITEM)) }).first().click();
await page.waitForTimeout(3000);
const rateText = await page.getByLabel("Rate", { exact: true }).first().inputValue().catch(() => "");
check(rateText.includes(money(RATE)), `rate ${money(RATE)} fetched from the price list (${rateText})`);

step("qty 3 → amount and totals recalc live");
const qty = page.getByLabel("Quantity", { exact: true }).first();
await qty.click();
await qty.fill("3");
await qty.press("Enter");
await page.waitForTimeout(800);
const body = await page.locator("main").innerText();
check(body.includes(money(RATE * 3)), `amount ${money(RATE * 3)} shown before save`);
await shot("so_new_filled");

step("save → server totals");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForURL(/Sales%20Order\/SAL-ORD-/, { timeout: 30000 });
const name = decodeURIComponent(page.url().split("/").pop());
const saved = (await api(`api/resource/Sales Order/${encodeURIComponent(name)}`)).data;
check(saved?.customer === CUSTOMER, `saved ${name} for ${CUSTOMER}`);
// net total, not grand total: the site may add taxes from a default template
check(saved?.net_total === RATE * 3 && saved?.items?.[0]?.rate === RATE, `server net_total ${saved?.net_total}, rate ${saved?.items?.[0]?.rate}`);
await page.getByRole("button", { name: /^Submit$/ }).waitFor({ timeout: 20000 });

step("submit");
await page.getByRole("button", { name: /^Submit$/ }).click();
await page.getByRole("button", { name: "Yes" }).click();
await page.waitForTimeout(3000);
const sub = (await api(`api/resource/Sales Order/${encodeURIComponent(name)}`)).data;
check(sub?.docstatus === 1, `docstatus 1 (${sub?.status})`);
check(await page.getByRole("button", { name: /^Cancel$/ }).isVisible(), "Cancel button shown after submit");
const createMenu = page.getByRole("button", { name: /^Create/ });
check((await createMenu.count()) > 0, "ERPNext 'Create' button group from sales_order.js");
await shot("so_submitted");

step("cancel");
await page.getByRole("button", { name: /^Cancel$/ }).click();
await page.getByRole("button", { name: "Yes" }).click();
await page.waitForTimeout(3000);
check((await api(`api/resource/Sales Order/${encodeURIComponent(name)}`)).data?.docstatus === 2, "docstatus 2 (cancelled)");

step("amend → new draft with amended_from");
await page.getByRole("button", { name: "Amend" }).click();
await page.getByRole("heading", { name: "New Sales Order" }).waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForURL((u) => !u.pathname.endsWith("/new") && u.pathname.includes("SAL-ORD"), { timeout: 30000 });
const amended = decodeURIComponent(page.url().split("/").pop());
const am = (await api(`api/resource/Sales Order/${encodeURIComponent(amended)}`)).data;
check(am?.amended_from === name, `${amended} amended_from ${am?.amended_from}`);

step("delete the amended draft");
await page.getByRole("button", { name: "More actions" }).click();
await page.getByRole("menuitem", { name: /Delete/ }).click();
await page.getByRole("button", { name: "Yes" }).click();
await page.waitForURL(/Sales%20Order$/, { timeout: 20000 });
const gone = await page.request.get(`${BASE}/api/frappe/api/resource/Sales%20Order/${encodeURIComponent(amended)}`);
check(gone.status() === 404, "deleted on server");

// remove the cancelled original too so repeated runs don't pile up orders (list tests page on 20 rows)
await page.request.post(`${BASE}/api/frappe/api/method/frappe.client.delete`, { data: { doctype: "Sales Order", name } });

if (warnings.length) console.log("script warnings:\n" + warnings.slice(0, 15).join("\n"));
await t.finish();
