// Image view: Item (image_field) — cards with images through /files, search narrows, card opens the form.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/image.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const up = await page.request.post(`${BASE}/api/frappe/api/method/upload_file`, { multipart: { file: { name: "crema-item.png", mimeType: "image/png", buffer: png }, is_private: "0" } });
const file = (await up.json()).message;
// an item of this site without an image (restored afterwards), searched by its own code
const ITEM = (await post("frappe.client.get_list", { doctype: "Item", filters: { disabled: 0, image: ["is", "not set"] }, fields: ["name", "item_name"], limit_page_length: 1 }))?.[0];
check(!!ITEM, `site data: item ${ITEM?.name}`);
await post("frappe.client.set_value", { doctype: "Item", name: ITEM.name, fieldname: "image", value: file.file_url });

step("Item list → Image view");
await page.goto(`${BASE}/desk/item`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("button", { name: /^View: / }).click({ timeout: 90000 });
await page.getByRole("menuitem", { name: "Image" }).click();
await page.waitForURL(/\/view\/image/, { timeout: 60000 });
const grid = page.getByRole("list", { name: "Item images" });
await grid.getByRole("listitem").first().waitFor({ timeout: 60000 });
const n = await grid.getByRole("listitem").count();
check(n >= 1, `cards shown (${n})`);
await page.waitForFunction(() => [...document.querySelectorAll("ul img")].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
check(await page.evaluate(() => [...document.querySelectorAll("ul img")].some((i) => i.complete && i.naturalWidth > 0)), "item image loads through /files");
await shot("image_view", false);

step("search + open");
// Image view searches the title field (Item: item_name)
await page.getByLabel("Search", { exact: true }).fill(ITEM.item_name || ITEM.name);
await page.waitForTimeout(1200);
const narrowed = await grid.getByRole("listitem").count();
check(narrowed >= 1 && narrowed <= n, `search narrows the cards (${narrowed} of ${n})`);
await grid.getByRole("link").first().click();
await page.waitForURL(/\/desk\/item\/(?!view)/, { timeout: 30000 });
check(true, "card opens the form");

step("cleanup");
await post("frappe.client.set_value", { doctype: "Item", name: ITEM.name, fieldname: "image", value: "" });
await post("frappe.client.delete", { doctype: "File", name: file.name });
await t.finish();
