// Query/Script reports: filters from the report JS, run, table, chart, total row,
// tree reports, prepared reports.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/report.mjs
import { start, BASE, defaultCompany } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const open = async (name) => {
  await page.goto(`${BASE}/desk/query-report/${encodeURIComponent(name)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("heading", { name, exact: true }).waitFor({ timeout: 60000 });
};

step("Sales Order Analysis: JS filters with defaults, auto-run");
await open("Sales Order Analysis");
await page.locator("tbody tr").first().waitFor({ timeout: 60000 });
check(await page.getByLabel("Company").first().isVisible(), "Company filter from report JS");
const company = await page.locator("#qr-filter-company").inputValue();
check(company === (await defaultCompany(page)), `company default = ${company}`);
const fromDate = await page.getByLabel("From Date").first().inputValue();
check(!!fromDate, `from_date default via frappe.datetime.add_months (${fromDate})`);
// widen range so seeded orders show
await page.locator("#qr-filter-from_date").fill("01-01-2026").catch(() => {});
const from = page.getByLabel("From Date").first();
await from.fill("2026-01-01");
await from.press("Enter");
await page.waitForTimeout(2500);
const rows = await page.locator("tbody tr").count();
check(rows > 0, `rows rendered (${rows})`);
check(await page.locator("tbody a[href^='/desk/doctype/Sales%20Order/']").first().isVisible(), "Link column renders form links");
check(await page.locator(".recharts-wrapper, .recharts-responsive-container").first().isVisible(), "chart rendered");
check(await page.locator("tfoot").getByText("Total").isVisible(), "total row");
await shot("report_so_analysis");

step("search + sort");
await page.getByLabel("Search in report").fill("SAL-ORD-2026-00003");
await page.waitForTimeout(400);
const filtered = await page.locator("tbody tr").count();
check(filtered > 0 && filtered < rows, `search narrows rows (${filtered}/${rows})`);
await page.getByLabel("Search in report").fill("");

step("link click navigates in-app");
await page.locator("tbody a[href^='/desk/doctype/Sales%20Order/']").first().click();
await page.waitForURL(/\/desk\/doctype\/Sales%20Order\/SAL-ORD-/, { timeout: 30000 });
check(true, "opened Sales Order form");

step("General Ledger: Select filters + rows");
await open("General Ledger");
await page.locator("tbody tr").first().waitFor({ timeout: 60000 });
check(await page.getByLabel("Group By").first().isVisible().catch(() => false) || (await page.locator("select").count()) > 0, "Select filter rendered");
check((await page.locator("tbody tr").count()) > 0, "GL rows");
await shot("report_gl");

step("Trial Balance: tree report with indent + collapse");
await open("Trial Balance");
await page.locator("tbody tr").first().waitFor({ timeout: 60000 });
const before = await page.locator("tbody tr").count();
const collapseBtn = page.getByRole("button", { name: "Collapse" }).first();
if (await collapseBtn.isVisible().catch(() => false)) {
  await collapseBtn.click();
  await page.waitForTimeout(300);
  const after = await page.locator("tbody tr").count();
  check(after < before, `collapse hides children (${before} → ${after})`);
} else check(false, "tree toggle visible");
await shot("report_trial_balance");

step("Stock Balance: prepared report flow");
await open("Stock Balance");
await page.getByRole("button", { name: /Generate New Report|Rebuild/ }).waitFor({ timeout: 60000 });
check(true, "prepared report action shown");

await t.finish();
