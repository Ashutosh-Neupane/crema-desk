// Phone layout (GAPS M6): at 390px the list is cards, standard filters fold behind "More filters", child tables are
// row cards that open the row form, and the form's actions sit in a bottom bar; no horizontal page scroll.
// At 1280px the table, inline grid and header actions are back.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/mobile.mjs
import { start, BASE, defaultCompany } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// orders are tagged by po_no so a crashed earlier run is cleaned up here
for (const d of (await post("frappe.client.get_list", { doctype: "Sales Order", filters: { po_no: ["like", "PO-CREMA-MOBILE-%"], docstatus: 0 }, fields: ["name"] })) ?? []) await post("frappe.client.delete", { doctype: "Sales Order", name: d.name });
const company = await defaultCompany(page);
const customer = (await post("frappe.client.get_list", { doctype: "Customer", fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
const items = (await post("frappe.client.get_list", { doctype: "Item", filters: { is_sales_item: 1, disabled: 0, has_variants: 0 }, fields: ["name"], limit_page_length: 2 })) ?? [];
const day = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const so = (await api("api/resource/Sales Order", { data: { company, customer, po_no: `PO-CREMA-MOBILE-${Date.now()}`, delivery_date: day, items: items.map((i) => ({ item_code: i.name, qty: 3, delivery_date: day })) } })).data?.name;
check(!!so, `draft Sales Order ${so} with ${items.length} items`);

await page.setViewportSize({ width: 390, height: 844 });

step("list at 390px: cards, folded filters");
await page.goto(`${BASE}/desk/doctype/Sales%20Order`, { waitUntil: "domcontentloaded", timeout: 180000 });
const cards = page.getByRole("list", { name: "Sales Order list" });
await cards.waitFor({ timeout: 90000 });
await cards.getByRole("listitem").first().waitFor({ timeout: 30000 });
check((await page.locator("table").count()) === 0, "no table on a phone");
check(await page.getByRole("button", { name: "More filters" }).isVisible(), "More filters button");
check(!(await page.getByRole("button", { name: "Group by", exact: true }).count()), "Group by folded away");
await page.getByRole("button", { name: "More filters" }).click();
check(await page.getByRole("button", { name: "Group by", exact: true }).isVisible(), "More filters shows Group by");
await page.getByRole("checkbox", { name: "Select all" }).check();
check(await page.getByText(/^\d+ selected$/).isVisible(), "select all on the card list");
await page.getByRole("checkbox", { name: "Select all" }).uncheck();
check(await noScroll(), "no horizontal scroll (list)");
await shot("mobile_list", false);

step("tap a card → its form");
await cards.getByRole("link", { name: new RegExp(customer) }).first().click();
await page.waitForURL(/\/desk\/doctype\/Sales%20Order\/SAL-/, { timeout: 30000 });
await page.goto(`${BASE}/desk/doctype/Sales%20Order/${so}`, { waitUntil: "domcontentloaded" });

step("form at 390px: actions in the bottom bar, items as cards");
const bar = page.getByRole("toolbar", { name: "Document actions" });
await bar.waitFor({ timeout: 90000 });
check(await bar.getByRole("button", { name: /^(Save|Submit)$/ }).isVisible(), "Save / Submit in the bottom bar");
const box = await bar.boundingBox();
check(box && Math.abs(box.y + box.height - 844) <= 1, `bar sits at the bottom of the screen (${box?.y}+${box?.height})`);
const rows = page.getByRole("list", { name: "Items rows" });
await rows.scrollIntoViewIfNeeded();
check((await rows.getByRole("listitem").count()) === items.length, `${items.length} item cards`);
check(await rows.getByText(items[0].name).first().isVisible(), "card shows the item code");
check(await noScroll(), "no horizontal scroll (form)");
await shot("mobile_form_items", false);

step("tap a row card → row form; edit qty");
await rows.getByRole("button", { name: "Edit row 1" }).click();
const editor = page.getByRole("dialog", { name: "Editing row 1" });
await editor.waitFor({ timeout: 10000 });
const qty = editor.getByLabel(/^Quantity/).first();
await qty.fill("4");
await qty.press("Tab");
await editor.getByRole("button", { name: "Close" }).click();
await page.waitForTimeout(500);
check(await rows.getByRole("listitem").first().getByText(/Quantity\s*4/).isVisible(), "card shows the new quantity");
await bar.getByRole("button", { name: "Save" }).click();
await page.waitForResponse((r) => r.url().includes("savedocs"), { timeout: 30000 });
await page.waitForTimeout(800);
const saved = (await api(`api/resource/Sales Order/${so}`)).data;
check(saved?.items?.[0]?.qty === 4, `saved qty ${saved?.items?.[0]?.qty}`);

step("desktop 1280px: table, inline grid, header actions");
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(500);
check(!(await page.getByRole("toolbar", { name: "Document actions" }).count()), "no bottom bar on desktop");
check(!(await page.getByRole("list", { name: "Items rows" }).count()), "inline grid on desktop");
await page.goto(`${BASE}/desk/doctype/Sales%20Order`, { waitUntil: "domcontentloaded" });
await page.locator("table").first().waitFor({ timeout: 60000 });
check(true, "list is a table on desktop");

step("cleanup");
await post("frappe.client.delete", { doctype: "Sales Order", name: so });
await t.finish();
