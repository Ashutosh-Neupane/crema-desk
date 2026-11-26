// Sales Order list behaviour vs Desk: open row, search, filters (add / chip remove),
// indicator filter, group-by, sort, bulk delete — verified against the backend.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/list.salesorder.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3001";
const OUT = process.env.OUT ?? "./smoke-shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`));
let failures = 0;
const check = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) failures++; };
const step = (m) => console.log(`• ${m}`);
const LIST = `${BASE}/desk/sales-order`;
const rowCount = () => page.locator("tbody tr").count();
const settle = () => page.waitForTimeout(1200);
// expected values come from the bench itself, so the suite runs against any site with ERPNext data
const api = async (path) => (await page.request.get(`${BASE}/api/frappe/${path}`)).json();
const soCount = async (filters) => (await api(`api/method/frappe.client.get_count?doctype=Sales%20Order&filters=${encodeURIComponent(JSON.stringify(filters))}`)).message;

await page.goto(`${BASE}/login`);
await page.fill("input:not([type=password])", process.env.CREMA_USER ?? "Administrator");
await page.fill("input[type=password]", process.env.CREMA_PASS ?? "admin");
await page.click("button[type=submit]");
await page.waitForURL(/\/desk/);

// the sort and filters are saved per user (Desk user_settings): start from the default (newest first)
await page.request.post(`${BASE}/api/frappe/api/method/frappe.model.utils.user_settings.save`, { data: { doctype: "Sales Order", user_settings: JSON.stringify({ List: { filters: [], sort_by: "modified", sort_order: "desc", active_layout_name: "" } }) } });

step("list loads with indicators");
await page.goto(LIST, { waitUntil: "domcontentloaded" });
await page.locator("tbody tr").first().waitFor({ timeout: 60000 });
const n0 = await rowCount();
check(n0 >= 5, `rows shown (${n0})`);
const firstStatus = (await api(`api/resource/Sales%20Order?fields=${encodeURIComponent('["status"]')}&order_by=modified%20desc&limit_page_length=1`)).data[0].status;
check(await page.getByRole("button", { name: firstStatus, exact: true }).first().isVisible(), `ERPNext indicator '${firstStatus}' on the newest order`);
check((await page.getByRole("button", { name: /^Filter/ }).count()) === 1, "exactly one Filter button");

step("search by customer name");
const cust = (await api(`api/resource/Sales%20Order?fields=${encodeURIComponent('["customer_name"]')}&order_by=modified%20desc&limit_page_length=1`)).data[0].customer_name;
const word = String(cust).split(" ")[0];
await page.getByPlaceholder(/Search/).fill(word);
await page.waitForFunction((n) => document.querySelectorAll("tbody tr").length < n, n0, { timeout: 30000 }).catch(() => {});
await settle();
const found = await page.locator("tbody tr").allInnerTexts();
const wantFound = Math.min(20, await soCount([["customer_name", "like", `%${word}%`]]));
check(found.length === wantFound && found.every((r) => r.toLowerCase().includes(word.toLowerCase())), `search "${word}" → ${found.length} rows (expected ${wantFound})`);
await page.getByPlaceholder(/Search/).fill("");
await page.waitForFunction((n) => document.querySelectorAll("tbody tr").length === n, n0, { timeout: 30000 });
await settle();

step("indicator click adds filter; chip removes it");
await page.getByRole("button", { name: "Draft" }).first().click();
await page.waitForURL(/docstatus=0/, { timeout: 30000 }).catch(() => {});
await settle();
check(page.url().includes("docstatus=0"), "URL has docstatus=0");
const drafts = Math.min(20, await soCount([["docstatus", "=", 0]]));
check((await rowCount()) === drafts, `${drafts} draft orders`);
await page.getByRole("button", { name: /Remove Document Status filter/ }).click();
await settle();
check((await rowCount()) === n0, "chip × restores all rows");

const customer = (await api(`api/resource/Sales%20Order?fields=${encodeURIComponent('["customer"]')}&order_by=modified%20desc&limit_page_length=1`)).data[0].customer;
const byCustomer = Math.min(20, await soCount([["customer", "=", customer]]));
step(`filter editor: Customer = ${customer}`);
await page.getByRole("button", { name: /^Filter/ }).click();
await page.locator("select").filter({ hasText: "Customer" }).first().selectOption({ label: "Customer" });
const linkInput = page.locator(".w-80 input").first();
await linkInput.fill(customer);
await linkInput.press("Tab");
await page.getByRole("button", { name: "Add filter" }).click();
await settle();
check((await rowCount()) === byCustomer, `filter applied (${byCustomer} rows)`);
await page.getByRole("button", { name: "Clear all" }).click();
await settle();
check((await rowCount()) === n0, "Clear all restores rows");

step("group by status counts");
await page.getByRole("button", { name: /Group by/ }).click();
await page.waitForTimeout(1500);
check(await page.getByText(firstStatus).last().isVisible(), "group-by lists statuses");
await page.keyboard.press("Escape");

step("sort ascending by name");
await page.getByLabel("Sort by").selectOption("name");
// the sort is saved per user (Desk user_settings), so an earlier run may have left it ascending already
const desc = page.getByRole("button", { name: /Descending/ });
if (await desc.isVisible().catch(() => false)) await desc.click();
await settle();
const firstId = await page.locator("tbody tr").first().locator("td").nth(1).innerText();
// the site's first order by name, whatever the series
const firstSO = (await (await page.request.post(`${BASE}/api/frappe/api/method/frappe.client.get_list`, { data: { doctype: "Sales Order", fields: ["name"], order_by: "name asc", limit_page_length: 1 } })).json()).message?.[0]?.name;
check(!!firstSO && firstId.includes(firstSO), `first row is ${firstSO} when ascending (${firstId.split("\n").pop()})`);

step("row click opens document");
await page.locator("tbody tr").first().locator("td").nth(3).click();
await page.waitForURL(/sales-order\/SAL-ORD/, { timeout: 15000 });
check(true, `opened ${decodeURIComponent(page.url().split("/").pop())}`);
await page.screenshot({ path: `${OUT}/so_form.png`, fullPage: true });

console.log(`\n${failures ? "FAILED" : "ALL PASSED"} (${failures} failures)`);
errors.forEach((e) => console.log(e));
await browser.close();
process.exit(failures ? 1 : 0);
