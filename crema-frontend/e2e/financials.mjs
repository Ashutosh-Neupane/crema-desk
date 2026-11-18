// Financial statements (ERPNext financial_statements.js run unchanged in the report runtime): Balance Sheet,
// Profit and Loss, Cash Flow — filters, summary, tree, bold group rows, figures checked against the
// frappe.desk.query_report.run response the page received, account → General Ledger drill-down; Gross Profit's
// Item link titles (frappe.form.link_formatters) and report decimals.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/financials.mjs
import { start, BASE, defaultCompany } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;

const num = (s) => {
  const m = String(s ?? "").replace(/[^\d.\-]/g, "");
  return m === "" || m === "-" || m === "." ? null : Number(m);
};
const unquote = (s) => String(s ?? "").replace(/^'(.*)'$/, "$1");

/** open a report and return the query_report.run payload Crema rendered */
async function open(name) {
  const run = page.waitForResponse((r) => r.url().includes("frappe.desk.query_report.run") && r.request().method() === "POST", { timeout: 120000 });
  await page.goto(`${BASE}/desk/query-report/${encodeURIComponent(name)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const res = await (await run).json();
  await page.locator("main table tbody tr").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  return res.message;
}

async function visibleRows() {
  return page.evaluate(() =>
    [...document.querySelectorAll("main table tbody tr")].map((r) => {
      const cells = [...r.querySelectorAll("td")].slice(1);
      return { cells: cells.map((c) => c.innerText.trim()), bold: !!r.querySelector("td [style*='bold'], td b, td strong"), link: !!cells[0]?.querySelector("a[data-link-onclick]") };
    }),
  );
}

/** every rendered row matches its API row: label, bold (financial_statements formatter), first period figure */
async function checkStatement(name, msg) {
  const nameField = name === "Cash Flow" ? "section" : "account";
  const period = msg.columns.find((c) => c.fieldtype === "Currency")?.fieldname;
  check(!!period, `${name}: period column ${period}`);
  const rows = await visibleRows();
  const api = msg.result.filter((r) => r && Object.keys(r).length);
  check(rows.length > 0 && rows.length <= msg.result.length, `${name}: ${rows.length} rows rendered of ${msg.result.length}`);
  const bad = [];
  for (const r of rows) {
    if (!r.cells[0]) continue; // the blank spacer row
    const d = api.find((x) => unquote(x.section_name || x.account_name || x[nameField]) === r.cells[0]);
    if (!d) {
      bad.push(`no API row for "${r.cells[0]}"`);
      continue;
    }
    const wantBold = (!d.parent_account && !d.parent_section) || !!d.is_group_account || !!d.is_group;
    if (r.bold !== wantBold) bad.push(`${r.cells[0]} bold=${r.bold}`);
    const shown = num(r.cells[1]);
    const want = Number(d[period] ?? 0);
    if (shown === null || Math.abs(shown - want) > 0.005) bad.push(`${r.cells[0]} ${r.cells[1]} ≠ ${want}`);
    if ((d.account || d.accounts) && !String(d[nameField]).startsWith("'") && !r.link) bad.push(`${r.cells[0]} has no ledger link`);
  }
  check(bad.length === 0, `${name}: labels, bold rows, figures and ledger links match the API${bad.length ? " — " + bad.slice(0, 4).join("; ") : ""}`);
  return api;
}

async function checkSummary(name, msg) {
  const items = (msg.report_summary ?? []).filter((s) => s && s.type !== "separator");
  if (!items.length) return;
  const shown = await page.locator("[data-summary-item]").allInnerTexts();
  check(shown.length === items.length, `${name}: ${items.length} summary items`);
  const bad = items.filter((s, k) => {
    const v = num((shown[k] ?? "").split("\n").slice(1).join(" "));
    return v === null || Math.abs(v - Number(s.value)) > 0.005;
  });
  check(bad.length === 0, `${name}: summary values match (${shown.map((s) => s.replace(/\s+/g, " ")).join(" ; ")})`);
  const cur = items.find((s) => s.datatype === "Currency");
  if (cur) check(!/^\d/.test((shown[items.indexOf(cur)] ?? "").split("\n").pop().trim()), `${name}: currency summary shows the currency symbol`);
}

step("Balance Sheet: ERPNext filters, summary, tree");
const company = await defaultCompany(page);
let msg = await open("Balance Sheet");
for (const f of ["company", "filter_based_on", "periodicity"]) check(await page.locator(`#qr-filter-${f}`).count(), `filter ${f} from financial_statements.js`);
check((await page.locator("#qr-filter-company").inputValue()) === company, `company default ${company}`);
// erpnext.utils.add_dimensions adds them in a frappe.call callback; the filters are read after frappe.after_ajax
const dims = await page.request.post(`${BASE}/api/frappe/api/method/erpnext.accounts.doctype.accounting_dimension.accounting_dimension.get_dimensions`, { data: {} });
const dimFields = dims.ok() ? ((await dims.json()).message?.[0] ?? []).map((d) => d.fieldname) : [];
const missingDims = [];
for (const f of dimFields) if (!(await page.locator(`#qr-filter-${f}`).count())) missingDims.push(f);
check(missingDims.length === 0, `accounting dimension filters (${dimFields.join(", ") || "none on this site"})${missingDims.length ? " missing " + missingDims.join(", ") : ""}`);
await checkSummary("Balance Sheet", msg);
const bs = await checkStatement("Balance Sheet", msg);
check(await page.getByRole("button", { name: "Collapse" }).first().isVisible(), "tree rows collapse");
await shot("financials_balance_sheet");

step("Balance Sheet: collapse a group hides its accounts");
const before = (await visibleRows()).length;
await page.getByRole("button", { name: "Collapse" }).first().click();
const after = (await visibleRows()).length;
check(after < before, `collapsed ${before} → ${after} rows`);
await page.getByRole("button", { name: "Expand" }).first().click();
check((await visibleRows()).length === before, "expanded again");

step("Balance Sheet: account → General Ledger (open_general_ledger)");
const leaf = bs.find((d) => d.account && !d.is_group && !["Payable", "Receivable"].includes(d.account_type) && !String(d.account).startsWith("'"));
if (leaf) {
  const label = unquote(leaf.account_name || leaf.account);
  await page.locator("main table tbody a[data-link-onclick]", { hasText: label }).first().click();
  await page.waitForURL(/\/desk\/query-report\/General%20Ledger/, { timeout: 30000 });
  const url = new URL(page.url());
  check(url.searchParams.get("company") === company, "route option company");
  check(!!url.searchParams.get("from_date") && !!url.searchParams.get("to_date"), "route options from_date / to_date");
  await page.locator("main table tbody tr").first().waitFor({ timeout: 60000 });
  const accounts = await page.locator("main table tbody tr").evaluateAll((trs) => trs.map((tr) => tr.innerText));
  check(accounts.some((x) => x.includes(leaf.account)), `General Ledger opened filtered on ${leaf.account}`);
  check(accounts.every((x) => !x.trim() || x.includes(leaf.account) || /Opening|Total|Closing/.test(x)), "only that account's entries");
  await shot("financials_gl_drilldown");
} else check(true, "no plain leaf account on this site — drill-down skipped");

step("Profit and Loss Statement");
msg = await open("Profit and Loss Statement");
await checkSummary("Profit and Loss Statement", msg);
await checkStatement("Profit and Loss Statement", msg);

step("Cash Flow: section headings, quoted labels");
msg = await open("Cash Flow");
await checkStatement("Cash Flow", msg);
const cfRows = await visibleRows();
const heading = cfRows.find((r) => r.cells[0] === "Cash Flow from Operations");
check(!!heading && num(heading.cells[1]) === 0, `section heading shows 0.00 (${heading?.cells[1]})`);
const pfy = cfRows.find((r) => r.cells[0] === "Profit for the year");
check(!!pfy && !pfy.link && !pfy.bold, "'Profit for the year' is a plain label (unquoted, not bold, no link)");
await shot("financials_cash_flow");

step("Gross Profit: Item link titles and report decimals");
msg = await open("Gross Profit");
const itemCol = msg.columns.findIndex((c) => c.fieldtype === "Link" && c.options === "Item");
const qtyCol = msg.columns.findIndex((c) => c.fieldtype === "Float");
const gp = await visibleRows();
const withItem = gp.find((r) => r.cells[itemCol] && msg.result.some((d) => d.item_name && d.item_code && r.cells[itemCol] === `${d.item_code}: ${d.item_name}`));
if (itemCol >= 0 && msg.result.some((d) => d.item_name && d.item_code && d.item_name !== d.item_code)) check(!!withItem, `Item shows "code: item_name" (${withItem?.cells[itemCol]})`);
if (qtyCol >= 0) {
  const qty = gp.map((r) => r.cells[qtyCol]).filter(Boolean);
  check(qty.length > 0 && qty.every((q) => /\.\d+$/.test(q)), `Float cells keep decimals (${qty.slice(0, 3).join(", ")})`);
}

await t.finish();
