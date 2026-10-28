// Report view: columns (incl. child table), inline edit, group by, totals, Save As.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/reportview.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const REPORT = "Crema E2E SO Report";
await post("frappe.model.utils.user_settings.save", { doctype: "Sales Order", user_settings: JSON.stringify({ Report: {} }) });
await post("frappe.desk.reportview.delete_report", { name: REPORT }).catch(() => {});

step("open Report view from the list");
await page.goto(`${BASE}/desk/doctype/Sales%20Order`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Report", exact: true }).click();
await page.waitForURL(/\/view\/report/, { timeout: 30000 });
const grid = page.getByRole("table", { name: "Sales Order report" });
await grid.locator("tbody tr").first().waitFor({ timeout: 60000 });
const base = await grid.locator("tbody tr").count();
check(base > 0, `rows (${base})`);
check(await grid.locator("tbody a[href*='/desk/doctype/Sales%20Order/SAL-ORD-']").first().isVisible(), "ID links to form");

step("pick columns: Customer's Purchase Order + child Item Code");
await page.getByRole("button", { name: "Columns" }).click();
const dlg = page.getByRole("dialog");
await dlg.getByPlaceholder("Search fields").fill("Purchase Order");
await dlg.getByLabel("Customer's Purchase Order", { exact: true }).first().check();
await dlg.getByPlaceholder("Search fields").fill("Item Code");
await dlg.locator("section", { hasText: "Sales Order Item" }).getByLabel("Item Code", { exact: true }).check();
await dlg.getByRole("button", { name: "Done" }).click();
await page.waitForTimeout(2500);
check(await grid.getByRole("columnheader", { name: /Sales Order Item:\s*Item Code/ }).isVisible(), "child column header");
const fanned = await grid.locator("tbody tr").count();
check(fanned >= base, `child rows fan out (${base} → ${fanned})`);

step("inline edit a draft's PO number");
await page.goto(`${BASE}/desk/doctype/Sales%20Order/view/report?docstatus=0`, { waitUntil: "domcontentloaded" });
await grid.locator("tbody tr").first().waitFor({ timeout: 60000 });
const firstName = (await grid.locator("tbody tr").first().locator("a").first().innerText()).trim();
const poIdx = await grid.locator("thead th").evaluateAll((ths) => ths.findIndex((th) => /Customer's Purchase Order/.test(th.textContent ?? "")));
check(poIdx > 0, `PO column present (index ${poIdx})`);
const cell = grid.locator("tbody tr").first().locator("td").nth(poIdx);
await cell.dblclick();
const stamp = `RV-${Date.now() % 100000}`;
await cell.locator("input").fill(stamp);
await cell.locator("input").press("Enter");
await page.waitForTimeout(2000);
const so = (await api(`api/resource/Sales Order/${encodeURIComponent(firstName)}`)).data;
check(so?.po_no === stamp, `po_no saved on ${firstName} (${so?.po_no})`);
await shot("reportview_edit");

step("group by customer, sum of grand total");
await page.getByRole("button", { name: /Group By/ }).click();
await page.getByLabel("Group by field").selectOption("customer");
await page.getByLabel("Aggregate function").selectOption("sum");
await page.getByLabel("Aggregate on").selectOption("grand_total");
await page.getByRole("button", { name: "Apply" }).click();
await page.waitForTimeout(2500);
check(await grid.getByRole("columnheader", { name: /Sum of Grand Total/ }).isVisible(), "aggregate column");
await page.getByRole("button", { name: /Grouped by/ }).click();
await page.getByRole("button", { name: "Remove", exact: true }).click();
await page.waitForTimeout(1500);

step("totals row");
await page.getByRole("button", { name: "Totals" }).click();
await page.waitForTimeout(500);
check(await grid.locator("tfoot").getByText("Total").isVisible(), "totals footer");

step("Save As → saved report route, reload keeps columns");
await page.getByRole("button", { name: "Save As" }).click();
await page.getByLabel("Report Name").fill(REPORT);
await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
await page.waitForURL(new RegExp(`/view/report/${encodeURIComponent(REPORT).replace(/%20/g, "%20")}`), { timeout: 30000 });
await page.reload({ waitUntil: "domcontentloaded" });
await grid.locator("tbody tr").first().waitFor({ timeout: 60000 });
check(await page.getByRole("heading", { name: REPORT }).isVisible(), "saved report title");
check(await grid.getByRole("columnheader", { name: /Sales Order Item:\s*Item Code/ }).isVisible(), "saved columns restored");
const rep = (await api(`api/resource/Report/${encodeURIComponent(REPORT)}`)).data;
check(rep?.report_type === "Report Builder" && rep?.ref_doctype === "Sales Order", `Report doc saved (${rep?.report_type})`);
await shot("reportview_saved");

step("query-report link redirects Report Builder reports here");
await page.goto(`${BASE}/desk/query-report/${encodeURIComponent(REPORT)}`, { waitUntil: "domcontentloaded" });
await page.waitForURL(/\/view\/report\//, { timeout: 30000 });
check(true, "redirected");

step("cleanup");
await post("frappe.client.set_value", { doctype: "Sales Order", name: firstName, fieldname: "po_no", value: "" });
await post("frappe.desk.reportview.delete_report", { name: REPORT });
await post("frappe.model.utils.user_settings.save", { doctype: "Sales Order", user_settings: JSON.stringify({ Report: {} }) });
await t.finish();
