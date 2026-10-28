// Address & Contact cards (frappe.contacts.render_address_and_contact) on the Customer form:
// cards from __onload, Edit links, New Address → new Address form linked to the customer, hidden on new docs.
//   OUT=/tmp/shots node e2e/addresscontact.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => {
  const r = await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
  return (await r.json()).message;
};
const TAG = `CremaAC${Date.now()}`;
const CUST = `${TAG} Customer`;
const cleanup = async () => {
  const leftovers = await post("frappe.client.get_list", { doctype: "Customer", filters: [["customer_name", "like", "CremaAC%"]], pluck: "name", limit_page_length: 0 });
  for (const dt of ["Address", "Contact"]) {
    const names = await post("frappe.client.get_list", { doctype: dt, filters: [["Dynamic Link", "link_name", "like", "CremaAC%"]], pluck: "name", limit_page_length: 0 });
    for (const n of names ?? []) await post("frappe.client.delete", { doctype: dt, name: n });
  }
  for (const n of leftovers ?? []) await post("frappe.client.delete", { doctype: "Customer", name: n });
};
const main = page.locator("#main-content");
const enc = encodeURIComponent;
try {
  await cleanup();
  const cust = await post("frappe.client.insert", { doc: { doctype: "Customer", customer_name: CUST, customer_type: "Company" } });
  const link = [{ link_doctype: "Customer", link_name: cust.name }];
  const addr = await post("frappe.client.insert", { doc: { doctype: "Address", address_title: `${TAG} HQ`, address_type: "Billing", address_line1: "12 Test Street", city: "Kathmandu", country: "Nepal", links: link } });
  const contact = await post("frappe.client.insert", { doc: { doctype: "Contact", first_name: "Ada", last_name: TAG, designation: "Buyer", email_ids: [{ email_id: "ada.ac@example.com", is_primary: 1 }], phone_nos: [{ phone: "9800000001", is_primary_phone: 1 }], links: link } });

  step("cards on a saved Customer");
  await page.goto(`${BASE}/desk/doctype/Customer/${enc(cust.name)}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  const openTab = async () => {
    await main.getByRole("tab", { name: "Address & Contact" }).click({ timeout: 120000 });
  };
  await openTab();
  const aBox = main.locator(`[data-name="${addr.name}"]`);
  const cBox = main.locator(`[data-name="${contact.name}"]`);
  await aBox.waitFor({ timeout: 120000 });
  await cBox.waitFor({ timeout: 30000 });
  const aText = await aBox.innerText();
  check(aText.includes("12 Test Street") && aText.includes("Kathmandu"), "address card shows address lines");
  check(aText.includes("Billing"), "address card shows type");
  const cText = await cBox.innerText();
  check(cText.includes("ada.ac@example.com") && cText.includes("9800000001") && cText.includes("Buyer"), "contact card shows email, phone, designation");
  check((await cBox.locator('a[href="mailto:ada.ac@example.com"]').count()) === 1, "email is a mailto link");
  check((await aBox.getByRole("link", { name: `Edit ${addr.name}` }).getAttribute("href")) === `/desk/doctype/Address/${enc(addr.name)}`, "address Edit link route");
  check((await cBox.getByRole("link", { name: `Edit ${contact.name}` }).getAttribute("href")) === `/desk/doctype/Contact/${enc(contact.name)}`, "contact Edit link route");
  await aBox.getByRole("button", { name: "Options" }).click();
  check(await page.getByRole("menuitem", { name: "Set as Primary" }).isVisible(), "card menu offers Set as Primary");
  check(await page.getByRole("menuitem", { name: "Unlink Address" }).isVisible(), "card menu offers Unlink");
  await shot("addr_contact_cards");
  await aBox.getByRole("button", { name: "Options" }).click();

  step("New Address opens a linked form");
  await main.getByRole("group", { name: "Address cards" }).getByRole("button", { name: "Address", exact: true }).click();
  await page.waitForURL(/\/desk\/doctype\/Address\/new/, { timeout: 60000 });
  const title = `${TAG} Second`;
  await main.getByLabel(/Address Title/).first().fill(title);
  await main.getByLabel(/Address Line 1/).first().fill("99 Linked Road");
  await main.getByLabel(/City\/Town/).first().fill("Pokhara");
  check((await main.getByText(cust.name, { exact: false }).count()) > 0 || (await main.locator(`input[value="${cust.name}"]`).count()) > 0, "new Address form shows the prefilled Dynamic Link row");
  await shot("addr_new_linked");
  await page.keyboard.press("Control+s");
  await page.waitForURL((u) => !/\/new/.test(u.pathname) && /\/Address\//.test(u.pathname), { timeout: 60000 });
  const saved = decodeURIComponent(page.url().split("/Address/")[1]);
  const doc = await post("frappe.client.get", { doctype: "Address", name: saved });
  check(doc?.links?.some((l) => l.link_doctype === "Customer" && l.link_name === cust.name), "saved Address is linked to the Customer on the server");

  step("back on the Customer, both addresses listed");
  await page.goto(`${BASE}/desk/doctype/Customer/${enc(cust.name)}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await openTab();
  await main.locator(`[data-name="${saved}"]`).waitFor({ timeout: 60000 });
  check((await main.locator("[data-name]").filter({ hasText: "99 Linked Road" }).count()) === 1, "new address card appears");

  step("Unlink from the card menu");
  await main.locator(`[data-name="${saved}"]`).getByRole("button", { name: "Options" }).click();
  await page.getByRole("menuitem", { name: "Unlink Address" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Yes|OK|Confirm/i }).first().click();
  await main.locator(`[data-name="${saved}"]`).waitFor({ state: "detached", timeout: 30000 });
  check(true, "unlinked card disappears");

  step("hidden on a new Customer");
  await page.goto(`${BASE}/desk/doctype/Customer/new`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await main.getByLabel(/Customer Name/).first().waitFor({ timeout: 120000 });
  check((await main.locator(".address-display, [data-name]").count()) === 0 && (await main.getByText(/No addresses added yet|No contacts added yet/).count()) === 0, "no address/contact cards on an unsaved Customer");
} finally {
  await cleanup();
}
await t.finish();
