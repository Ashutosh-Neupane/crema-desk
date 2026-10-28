// Save like Desk (frappe/public/js/frappe/form/save.js, form.js validate_and_save) on a Sales Order:
// Save of an unchanged doc sends no request and says "No changes in document"; a real save refreshes the form in
// place from the savedocs response (no getdoc, no remount). The timeline follows version_timeline_content_builder.js:
// "submitted this document", no raw HTML, hidden fields left out.
//   BASE=http://localhost:3001 node e2e/formsave.mjs
import { start, BASE, defaultCompany } from "./lib.mjs";

const t = await start();
const { page, check, step, api } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const company = await defaultCompany(page);
const customer = (await post("frappe.client.get_list", { doctype: "Customer", fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
const item = (await post("frappe.client.get_list", { doctype: "Item", filters: { is_sales_item: 1, is_stock_item: 1, disabled: 0, has_variants: 0 }, fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
const template = (await post("frappe.client.get_list", { doctype: "Sales Taxes and Charges Template", filters: { company }, fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
const taxes = template ? await post("erpnext.controllers.accounts_controller.get_taxes_and_charges", { master_doctype: "Sales Taxes and Charges Template", master_name: template }) : [];
// orders left by an interrupted run (their po_no would trip ERPNext's duplicate-PO check)
for (const o of (await post("frappe.client.get_list", { doctype: "Sales Order", filters: [["po_no", "like", "PO-CREMA-%"]], fields: ["name", "docstatus"] })) ?? []) {
  if (o.docstatus === 1) await post("frappe.client.cancel", { doctype: "Sales Order", name: o.name });
  await post("frappe.client.delete", { doctype: "Sales Order", name: o.name });
}
const PO = `PO-CREMA-${Date.now()}`;
const day = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const order = async () =>
  (await api("api/resource/Sales Order", { data: { company, customer, delivery_date: day, taxes_and_charges: template, taxes, items: [{ item_code: item, qty: 1, delivery_date: day }] } })).data?.name;

const calls = [];
page.on("request", (r) => {
  const m = decodeURIComponent(r.url()).match(/api\/method\/(frappe\.desk\.form\.(?:save\.savedocs|load\.getdoc))\b/);
  if (m) calls.push(m[1]);
});

const draft = await order();
check(!!draft, `draft ${draft} (${customer}, ${item}, ${template ?? "no tax template"})`);
await page.goto(`${BASE}/desk/doctype/Sales%20Order/${draft}`);
const submit = page.getByRole("button", { name: /^Submit$/ });
await submit.waitFor({ timeout: 90000 });
await page.waitForTimeout(2500);

step("Ctrl+S on an unchanged draft → no request, 'No changes in document'");
calls.length = 0;
await page.locator("main h1").first().click();
await page.keyboard.press("ControlOrMeta+s");
await page.locator("[data-sonner-toast]", { hasText: "No changes in document" }).waitFor({ timeout: 10000 });
await page.waitForTimeout(1000);
check(!calls.includes("frappe.desk.form.save.savedocs"), `no savedocs sent (${calls.join(", ") || "no calls"})`);

step("a real change → one savedocs, refreshed in place without getdoc");
const marker = await page.locator("main h1").first().evaluateHandle((el) => ((el.dataset.probe = "same-node"), el));
const po = page.getByLabel("Customer's Purchase Order", { exact: true }).first();
// po_no sits in the collapsible "Additional Info" section of the More Info tab
await page.getByRole("tab", { name: "More Info" }).click();
const section = page.getByRole("button", { name: "Additional Info" });
if ((await section.getAttribute("aria-expanded")) === "false") await section.click();
await po.fill(PO);
await po.press("Tab");
calls.length = 0;
const saved = page.waitForResponse((r) => r.url().includes("frappe.desk.form.save.savedocs"), { timeout: 30000 });
await page.keyboard.press("ControlOrMeta+s");
const res = await saved;
check(res.ok(), `savedocs HTTP ${res.status()}`);
await page.waitForTimeout(1500);
check(calls.filter((c) => c.endsWith("savedocs")).length === 1, "one savedocs");
check(!calls.includes("frappe.desk.form.load.getdoc"), `no getdoc after save (${calls.join(", ")})`);
check(await marker.evaluate((el) => el.isConnected && el.dataset.probe === "same-node"), "form header kept (no remount)");
check((await api(`api/resource/Sales Order/${draft}`)).data?.po_no === PO, "po_no saved on the server");
const activity = page.getByRole("region", { name: "Activity" });
await activity.getByText(`changed the value of Customer's Purchase Order from "" to ${PO}`).waitFor({ timeout: 10000 });
check(true, "timeline shows the change from the savedocs docinfo");

step("submit → timeline reads like Desk");
await submit.click();
await page.getByRole("button", { name: "Yes" }).click();
await page.getByRole("button", { name: /^Cancel$/ }).waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);
const text = await activity.innerText();
check(/submitted this document/.test(text), "'submitted this document'");
check(!/changed docstatus|<div|<table|tax-break-up/.test(text), "no docstatus line and no raw HTML");
check(!/Item Wise Tax Details/.test(text), "hidden child table (Item Wise Tax Details) left out");

step("cleanup");
await post("frappe.client.cancel", { doctype: "Sales Order", name: draft });
await post("frappe.client.delete", { doctype: "Sales Order", name: draft });
await t.finish();
