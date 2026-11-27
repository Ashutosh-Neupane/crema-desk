// A saved transaction shows the fields Desk shows (lib/form/compat.ts ports transaction.js / sales_common.js refresh,
// FormController.cleanupRefresh ports form.js): Company hidden on a one-company site, Customer Name hidden when it
// repeats the Customer, Series hidden once saved, Net Total only with a discount, "Currency and Price List" closed
// when the currency is the company's (collapsible_depends_on with erpnext.get_currency in scope).
//   BASE=http://localhost:3001 NEW_LAYOUT=0|1 node e2e/form.deskparity.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step } = t;
const api = t.api;
const q = (v) => encodeURIComponent(JSON.stringify(v));

const so = (await api(`api/resource/Sales Order?filters=${q([["docstatus", "=", 1]])}&fields=${q(["name", "customer", "customer_name", "currency", "company", "discount_amount"])}&limit_page_length=1`))?.data?.[0];
step("a submitted Sales Order to look at");
if (!so) {
  check(true, "no submitted Sales Order on this site: nothing to compare");
  await t.finish();
  process.exit(0);
}
const companies = (await api("api/resource/Company?limit_page_length=5"))?.data ?? [];
const companyCurrency = (await api(`api/resource/Company/${encodeURIComponent(so.company)}`))?.data?.default_currency;

await page.goto(`${BASE}/desk/sales-order/${encodeURIComponent(so.name)}`, { waitUntil: "domcontentloaded" });
const main = page.locator("main");
// a submitted document shows values, not inputs: look for the field labels themselves
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// a field label, with or without the required marker ("Customer *")
const visible = (label) => main.getByText(new RegExp(`^${esc(label)}\\s*\\*?$`)).first().isVisible().catch(() => false);
await main.getByText("Total Quantity", { exact: true }).first().waitFor({ timeout: 60000 });
await page.waitForTimeout(2500); // form scripts' refresh runs after the first paint
check(await visible("Delivery Date"), "fields render (control: Delivery Date shown)");

step("fields Desk hides");
if (companies.length === 1) check(!(await visible("Company")), "Company hidden (one company)");
if (so.customer_name === so.customer) check(!(await visible("Customer Name")), "Customer Name hidden (same as Customer)");
check(!(await visible("Series")), "Series hidden on a saved document");
if (!Number(so.discount_amount)) check(!(await visible("Net Total")), "Net Total hidden without a discount");

step("sections Desk keeps closed");
if (so.currency === companyCurrency) {
  const head = page.getByRole("button", { name: /^Currency and Price List/ }).first();
  check((await head.getAttribute("aria-expanded")) === "false", "Currency and Price List closed (company currency)");
}

step("currency labels");
check(await page.getByText(`Grand Total (${so.currency})`, { exact: true }).first().isVisible().catch(() => false), `Grand Total labelled (${so.currency})`);

await t.finish();
