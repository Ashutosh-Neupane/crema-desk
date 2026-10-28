// Preview ▸ Accounting Ledger / Stock Ledger (erpnext.accounts.ledger_preview) on draft documents,
// compared with the whitelisted methods' own response.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/ledgerpreview.mjs
import { start, BASE, defaultCompany } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const COMPANY = await defaultCompany(page);
const STORES = `Stores - ${(await (await page.request.post(`${BASE}/api/frappe/api/method/frappe.client.get_value`, { data: { doctype: "Company", fieldname: "abbr", filters: COMPANY } })).json()).message?.abbr}`;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const SC = "erpnext.controllers.stock_controller";
const created = [];
async function cleanup() {
  for (const [doctype, name] of created.splice(0).reverse()) await post("frappe.client.delete", { doctype, name });
}
const open = async (dt, name, wait) => {
  await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(dt)}/${encodeURIComponent(name)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("button", { name: /^Preview/ }).waitFor({ timeout: wait ?? 60000 });
};

step("draft Sales Invoice");
const si = await post("frappe.client.insert", { doc: { doctype: "Sales Invoice", company: COMPANY, customer: "Himalayan Traders", set_posting_time: 0, items: [{ item_code: "SUGAR-1", qty: 2, rate: 100 }] } });
check(!!si?.name, `inserted ${si?.name}`);
created.push(["Sales Invoice", si.name]);
const gl = await post(`${SC}.show_accounting_ledger_preview`, { company: si.company, doctype: "Sales Invoice", docname: si.name });
check(gl?.gl_data?.length >= 2, `API returns ${gl?.gl_data?.length} GL rows`);

await open("Sales Invoice", si.name);
await page.getByRole("button", { name: /^Preview/ }).click();
check(await page.getByRole("menuitem", { name: "Accounting Ledger" }).isVisible(), "Preview group has Accounting Ledger");
await page.getByRole("menuitem", { name: "Accounting Ledger" }).click();
const dlg = page.getByRole("dialog", { name: "Accounting Ledger Preview" });
const table = dlg.getByRole("table", { name: "Ledger preview" });
await table.waitFor({ timeout: 60000 });
const headers = (await table.locator("thead th").allInnerTexts()).map((s) => s.trim());
check(headers.length === gl.gl_columns.length && headers.join() === gl.gl_columns.map((c) => c.name).join(), `columns ${headers.join(" | ")}`);
const rows = await table.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent.trim())));
check(rows.length === gl.gl_data.length, `${rows.length} rows shown`);
const ai = gl.gl_columns.findIndex((c) => c.name === "Account");
check(gl.gl_data.every((r, i) => rows[i][ai] === r[ai]), "account names match the API rows");
const num = (s) => Number(s.replace(/[^0-9.\-]/g, "")) || 0;
const di = gl.gl_columns.findIndex((c) => /Debit/.test(c.name));
const ci = gl.gl_columns.findIndex((c) => /Credit/.test(c.name));
check(gl.gl_data.every((r, i) => num(rows[i][di]) === (r[di] || 0) && num(rows[i][ci]) === (r[ci] || 0)), "debit/credit match the API rows");
const dr = rows.reduce((s, r) => s + num(r[di]), 0);
const cr = rows.reduce((s, r) => s + num(r[ci]), 0);
check(dr > 0 && Math.abs(dr - cr) < 0.01, `balanced: debit ${dr} = credit ${cr}`);
check(/(Rs|NPR|₨)/.test(rows[0][di] + rows[0][ci]), "currency cells formatted with a symbol");
await shot("ledger_accounting", false);
await page.keyboard.press("Escape");
await dlg.waitFor({ state: "detached", timeout: 10000 });

step("draft Purchase Receipt → Stock Ledger");
// Stock Entry and Purchase Invoice scripts currently abort in Crema before they add the preview buttons
// (grid.set_column_disp / script_manager.make are missing — not ledger_preview's fault), so Purchase Receipt covers it.
let sup = (await post("frappe.client.get_list", { doctype: "Supplier", fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
if (!sup) {
  sup = (await post("frappe.client.insert", { doc: { doctype: "Supplier", supplier_name: "Crema LP Supplier", supplier_group: "All Supplier Groups" } }))?.name;
  created.push(["Supplier", sup]);
}
const pi = await post("frappe.client.insert", { doc: { doctype: "Purchase Receipt", company: COMPANY, supplier: sup, set_warehouse: STORES, items: [{ item_code: "SUGAR-1", qty: 5, rate: 50, warehouse: STORES }] } });
check(!!pi?.name, `inserted ${pi?.name} for ${sup}`);
if (!pi?.name) { await cleanup(); await t.finish(); }
created.push(["Purchase Receipt", pi.name]);
const sl = await post(`${SC}.show_stock_ledger_preview`, { company: pi.company, doctype: "Purchase Receipt", docname: pi.name });
check(sl?.sl_data?.length === 1, `API returns ${sl?.sl_data?.length} SLE row`);
await open("Purchase Receipt", pi.name);
await page.getByRole("button", { name: /^Preview/ }).click();
check(await page.getByRole("menuitem", { name: "Accounting Ledger" }).isVisible(), "Purchase Receipt has Accounting Ledger too");
await page.getByRole("menuitem", { name: "Stock Ledger" }).click();
const sdlg = page.getByRole("dialog", { name: "Stock Ledger Preview" });
const stable = sdlg.getByRole("table", { name: "Ledger preview" });
await stable.waitFor({ timeout: 60000 });
const sh = (await stable.locator("thead th").allInnerTexts()).map((s) => s.trim());
check(sh.join() === sl.sl_columns.map((c) => c.name).join(), `columns ${sh.join(" | ")}`);
const srow = await stable.locator("tbody tr").first().evaluate((tr) => [...tr.children].map((td) => td.textContent.trim()));
const ii = sl.sl_columns.findIndex((c) => c.name === "Item");
check(srow[ii] === "SUGAR-1" && sl.sl_data[0][ii] === "SUGAR-1", "item row shown");
check(srow.some((c) => c === STORES), "warehouse shown");
await shot("ledger_stock", false);

await cleanup();
await t.finish();
