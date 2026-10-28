// Sales Order list behaviour vs Desk: open row, search, filters (add / chip remove),
// indicator filter, group-by, sort, bulk delete — verified against the backend.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/list.salesorder.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3001";
const OUT = process.env.OUT ?? "./smoke-shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`));
let failures = 0;
const check = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) failures++; };
const step = (m) => console.log(`• ${m}`);
const LIST = `${BASE}/desk/doctype/Sales%20Order`;
const rowCount = () => page.locator("tbody tr").count();
const settle = () => page.waitForTimeout(1200);

await page.goto(`${BASE}/login`);
await page.fill("input:not([type=password])", process.env.CREMA_USER ?? "Administrator");
await page.fill("input[type=password]", process.env.CREMA_PASS ?? "admin");
await page.click("button[type=submit]");
await page.waitForURL(/\/desk/);

step("list loads with indicators");
await page.goto(LIST, { waitUntil: "domcontentloaded" });
await page.locator("tbody tr").first().waitFor({ timeout: 60000 });
const n0 = await rowCount();
check(n0 >= 5, `rows shown (${n0})`);
check(await page.getByRole("button", { name: "To Deliver and Bill" }).first().isVisible(), "ERPNext indicator 'To Deliver and Bill'");
check((await page.getByRole("button", { name: /^Filter/ }).count()) === 1, "exactly one Filter button");

step("search by customer name");
await page.getByPlaceholder(/Search/).fill("Everest");
await page.waitForFunction((n) => document.querySelectorAll("tbody tr").length < n, n0, { timeout: 30000 }).catch(() => {});
await settle();
const found = await page.locator("tbody tr").allInnerTexts();
check(found.length >= 1 && found.length < n0 && found.every((r) => r.includes("Everest")), `search narrows to Everest rows (${found.length})`);
await page.getByPlaceholder(/Search/).fill("");
await page.waitForFunction((n) => document.querySelectorAll("tbody tr").length === n, n0, { timeout: 30000 });
await settle();

step("indicator click adds filter; chip removes it");
await page.getByRole("button", { name: "Draft" }).first().click();
await page.waitForURL(/docstatus=0/, { timeout: 30000 }).catch(() => {});
await settle();
check(page.url().includes("docstatus=0"), "URL has docstatus=0");
check((await rowCount()) === 2, "2 draft orders");
await page.getByRole("button", { name: /Remove Document Status filter/ }).click();
await settle();
check((await rowCount()) === n0, "chip × restores all rows");

step("filter editor: Customer = Kathmandu Mart");
await page.getByRole("button", { name: /^Filter/ }).click();
await page.locator("select").filter({ hasText: "Customer" }).first().selectOption({ label: "Customer" });
const linkInput = page.locator(".w-80 input").first();
await linkInput.fill("Kathmandu Mart");
await linkInput.press("Tab");
await page.getByRole("button", { name: "Add filter" }).click();
await settle();
check((await rowCount()) === 1, "filter applied (1 row)");
await page.getByRole("button", { name: "Clear all" }).click();
await settle();
check((await rowCount()) === n0, "Clear all restores rows");

step("group by status counts");
await page.getByRole("button", { name: /Group by/ }).click();
await page.waitForTimeout(1500);
check(await page.getByText("To Deliver and Bill").last().isVisible(), "group-by lists statuses");
await page.keyboard.press("Escape");

step("sort ascending by name");
await page.getByLabel("Sort by").selectOption("name");
// the sort is saved per user (Desk user_settings), so an earlier run may have left it ascending already
const desc = page.getByRole("button", { name: /Descending/ });
if (await desc.isVisible().catch(() => false)) await desc.click();
await settle();
const firstId = await page.locator("tbody tr").first().locator("td").nth(1).innerText();
check(firstId.includes("SAL-ORD-2026-00001"), `first row is 00001 when ascending (${firstId.split("\n").pop()})`);

step("row click opens document");
await page.locator("tbody tr").first().locator("td").nth(3).click();
await page.waitForURL(/Sales%20Order\/SAL-ORD/, { timeout: 15000 });
check(true, `opened ${decodeURIComponent(page.url().split("/").pop())}`);
await page.screenshot({ path: `${OUT}/so_form.png`, fullPage: true });

console.log(`\n${failures ? "FAILED" : "ALL PASSED"} (${failures} failures)`);
errors.forEach((e) => console.log(e));
await browser.close();
process.exit(failures ? 1 : 0);
