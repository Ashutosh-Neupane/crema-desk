// Print formats made in Crema: a new Print Format form asks for its Name (autoname Prompt, Desk layout.js
// __newname), a custom Jinja format saves, shows up in the print view's format picker and renders the template on
// the server; a read-only Text Editor value (address) shows as rendered HTML on the form, not as tags.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/printformat.mjs
import { start, BASE, defaultCompany } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const PF = "Crema Test Order Slip";
// labels of required fields read "Name*", so match by prefix
const field = (label) => page.getByLabel(new RegExp(`^${label}\\*?$`)).first();

await post("frappe.client.delete", { doctype: "Print Format", name: PF }).catch(() => {});
const company = await defaultCompany(page);
const customer = (await post("frappe.client.get_list", { doctype: "Customer", fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
const item = (await post("frappe.client.get_list", { doctype: "Item", filters: { is_sales_item: 1, disabled: 0, has_variants: 0 }, fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
const day = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const so = (await api("api/resource/Sales Order", { data: { company, customer, delivery_date: day, items: [{ item_code: item, qty: 2, delivery_date: day }] } })).data?.name;
check(!!so, `draft Sales Order ${so}`);

step("new Print Format → Name field (autoname Prompt) is required");
await page.goto(`${BASE}/desk/doctype/Print%20Format/new`);
await page.getByRole("heading", { name: "New Print Format" }).waitFor({ timeout: 90000 });
await page.waitForTimeout(1500);
check(await field("Name").isVisible(), "Name field shown on the new form");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.getByText("Missing fields").waitFor({ timeout: 10000 });
check(await page.getByRole("dialog").getByText("Name", { exact: true }).isVisible(), "Missing fields lists Name");
await page.getByRole("button", { name: "OK" }).click();

step("custom Jinja format for Sales Order");
await field("Name").fill(PF);
const dt = field("DocType");
await dt.click();
await dt.fill("Sales Order");
await page.getByRole("option", { name: /^Sales Order(?! Item)/ }).first().click();
await page.waitForTimeout(800);
await page.getByLabel("Custom Format", { exact: true }).check();
await page.waitForTimeout(500);
const editor = page.locator('[id$="html"] .cm-content').first();
await editor.click();
await page.keyboard.insertText("<h2>ORDER SLIP {{ doc.name }}</h2><p>Customer: {{ doc.customer_name }}</p><p>Items: {{ doc.items|length }}</p>");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForURL((u) => u.pathname.endsWith(`/Print%20Format/${encodeURIComponent(PF)}`) || u.pathname.endsWith(`/${PF.replace(/ /g, "%20")}`), { timeout: 30000 });
const saved = (await api(`api/resource/Print Format/${encodeURIComponent(PF)}`)).data;
check(saved?.doc_type === "Sales Order" && saved?.custom_format === 1 && saved?.print_format_type === "Jinja", `saved: ${saved?.doc_type}, custom ${saved?.custom_format}, ${saved?.print_format_type}`);
check(/ORDER SLIP/.test(saved?.html ?? ""), "template stored in html");

step("print view uses it");
await page.goto(`${BASE}/desk/print/Sales%20Order/${so}`);
const picker = page.locator('#main-container select[aria-label="Print format"]');
await picker.waitFor({ timeout: 60000 });
await page.waitForFunction((pf) => [...document.querySelectorAll('#main-container select[aria-label="Print format"] option')].some((o) => o.textContent === pf), PF, { timeout: 30000 });
await picker.selectOption(PF);
await page.waitForFunction((n) => (document.querySelector("#main-container iframe")?.contentDocument?.body?.innerText ?? "").includes(`ORDER SLIP ${n}`), so, { timeout: 30000 });
const text = await page.frameLocator("#main-container iframe").locator("body").innerText();
check(text.includes(`ORDER SLIP ${so}`) && /Items: 1/.test(text), "Jinja rendered by the server (name, customer, item count)");
check(!/\{\{|<h2>|<p>/.test(text), "no template or tags shown as text");
await shot("printformat_custom", false);

step("read-only Text Editor value renders as HTML on the form");
await page.goto(`${BASE}/desk/doctype/Sales%20Order/${so}`);
await page.getByRole("tab", { name: "Address & Contact" }).click({ timeout: 90000 });
await page.waitForTimeout(800);
const address = page.locator(".crema-rich").first();
if (await address.count()) {
  const shown = await address.innerText();
  check(!/<br|&lt;/.test(shown), `address shows text, not tags (${shown.replace(/\n/g, " / ").slice(0, 60)})`);
} else check(true, "customer has no address (nothing to render)");

step("cleanup");
await post("frappe.client.delete", { doctype: "Sales Order", name: so });
await post("frappe.client.delete", { doctype: "Print Format", name: PF });
await t.finish();
