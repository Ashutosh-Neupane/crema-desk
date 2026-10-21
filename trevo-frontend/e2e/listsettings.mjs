// List Settings dialog + per-user list state (Desk list_settings.js, list_view.js setup_defaults/before_render, model/user_settings.js)
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/listsettings.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const getUS = async () => JSON.parse((await post("frappe.model.utils.user_settings.get", { doctype: "ToDo" })) ?? "{}");
const lvsDoc = async () => (await post("frappe.client.get_list", { doctype: "List View Settings", filters: [["name", "=", "ToDo"]], fields: ["name", "fields", "disable_count"], limit_page_length: 1 }))?.[0];
const psNames = async () => ((await post("frappe.client.get_list", { doctype: "Property Setter", filters: [["doc_type", "=", "ToDo"], ["property", "=", "in_list_view"]], fields: ["name"], limit_page_length: 0 })) ?? []).map((r) => r.name);

// originals, restored at the end
const origUS = await getUS();
const origLVS = await lvsDoc();
const origPS = new Set(await psNames());
async function restore() {
  if (await lvsDoc()) await post("frappe.client.delete", { doctype: "List View Settings", name: "ToDo" });
  for (const n of await psNames()) if (!origPS.has(n)) await post("frappe.client.delete", { doctype: "Property Setter", name: n });
  await post("frappe.model.utils.user_settings.save", { doctype: "ToDo", user_settings: JSON.stringify({ List: origUS.List ?? null, last_view: origUS.last_view ?? null }) });
  if (origLVS) console.log("  (note: ToDo had List View Settings before the test; deleted)");
}
await restore();

const headers = async () => (await page.locator("table thead th").allInnerTexts()).map((s) => s.trim());

step("open the ToDo list and read the default columns");
await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded", timeout: 240000 });
await page.locator("table tbody tr").first().waitFor({ timeout: 240000 });
const before = await headers();
console.log("  headers:", JSON.stringify(before));
check(before.some((h) => /\d+ of \d+/.test(h)), "count shown before (rows of total)");

step("List Settings dialog: add Due Date, remove another column, Disable Count, Save");
await page.getByRole("button", { name: "List settings" }).click();
await page.getByRole("menuitem", { name: "List settings" }).click();
const dlg = page.getByRole("dialog", { name: "ToDo List View Settings" });
await dlg.waitFor({ timeout: 30000 });
const cols = () => dlg.getByRole("list", { name: "List columns" }).locator("li");
const labels = async () => (await cols().locator("span").allInnerTexts()).map((s) => s.trim());
const startCols = await labels();
console.log("  dialog columns:", JSON.stringify(startCols));
check(startCols.length >= 2, "dialog lists the current columns");
await shot("ls_dialog");
// remove the last removable column (not the subject, not Status)
const removable = startCols.filter((l, i) => i > 0 && l !== "Status");
const removed = removable[removable.length - 1];
if (removed) await dlg.getByRole("button", { name: `Remove ${removed}` }).click();
await dlg.getByRole("button", { name: "+ Add / Remove Fields" }).click();
await dlg.getByRole("checkbox", { name: "Field Due Date" }).check();
await dlg.getByRole("button", { name: "Apply" }).click();
check((await labels()).includes("Due Date"), "Due Date added to the dialog columns");
await dlg.getByRole("checkbox", { name: "Disable Count" }).check();
await dlg.getByRole("button", { name: "Save", exact: true }).click();
await dlg.waitFor({ state: "hidden", timeout: 30000 });

const doc = await lvsDoc();
const saved = JSON.parse(doc?.fields ?? "[]").map((f) => f.fieldname);
console.log("  server fields:", JSON.stringify(saved), "disable_count:", doc?.disable_count);
check(doc && Number(doc.disable_count) === 1, "List View Settings.disable_count = 1 on the server");
check(saved.includes("date"), "List View Settings.fields includes date");
check(removed ? !saved.some((n) => n === removed.toLowerCase().replace(/ /g, "_")) : true, `removed column (${removed}) not in saved fields`);

step("the list honours the saved columns and hides the count");
await page.waitForFunction(() => ![...document.querySelectorAll("table thead th")].some((th) => /\d+ of \d+/.test(th.textContent ?? "")) && [...document.querySelectorAll("table thead th")].some((th) => /Due Date/.test(th.textContent ?? "")), null, { timeout: 60000 });
let after = await headers();
check(after.includes("Due Date"), "Due Date column shown");
check(!after.some((h) => /\d+ of \d+/.test(h)), "no count in the header");
if (removed) check(!after.includes(removed), `${removed} column hidden`);
await shot("ls_list_after");
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("table tbody tr").first().waitFor({ timeout: 120000 });
after = await headers();
check(after.includes("Due Date") && !after.some((h) => /\d+ of \d+/.test(h)), "settings persist after reload");

step("dialog re-opens with the saved state (Disable Count checked)");
await page.getByRole("button", { name: "List settings" }).click();
await page.getByRole("menuitem", { name: "List settings" }).click();
await dlg.waitFor({ timeout: 30000 });
check(await dlg.getByRole("checkbox", { name: "Disable Count" }).isChecked(), "Disable Count is checked");
check((await labels()).includes("Due Date"), "Due Date is in the dialog");
await page.keyboard.press("Escape");

step("restore List View Settings + property setters");
await restore();
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("table tbody tr").first().waitFor({ timeout: 120000 });
check((await headers()).some((h) => /\d+ of \d+/.test(h)), "count back after restoring");

step("user settings: set a filter + sort");
await page.goto(`${BASE}/desk/doctype/ToDo?priority=High`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByLabel("Sort by").waitFor({ timeout: 60000 });
await page.getByLabel("Sort by").selectOption("creation");
await page.getByRole("button", { name: "Descending" }).click(); // -> ascending
await page.getByRole("button", { name: "Ascending" }).waitFor();
let us;
for (let i = 0; i < 30; i++) {
  us = (await getUS()).List;
  if (us?.sort_by === "creation" && us?.sort_order === "asc") break;
  await page.waitForTimeout(500);
}
console.log("  server List settings:", JSON.stringify(us));
check(us?.sort_by === "creation" && us?.sort_order === "asc", "sort_by/sort_order saved on the server");
check(JSON.stringify(us?.filters ?? []).includes('"priority","=","High"'), "filters saved on the server");
check((await getUS()).last_view === "List", "last_view = List saved");

step("bare list URL restores filter + sort");
await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => decodeURIComponent(location.search).includes("priority=High"), null, { timeout: 60000 });
check(true, `URL gained the saved filter (${decodeURIComponent(new URL(page.url()).search)})`);
check((await page.getByLabel("Sort by").inputValue()) === "creation", "sort field restored (creation)");
check(await page.getByRole("button", { name: "Ascending" }).isVisible(), "sort order restored (ascending)");
check(await page.getByRole("button", { name: "Remove Priority filter" }).isVisible(), "Priority filter chip shown");
await shot("ls_restored");

step("explicit ?field=value URL wins over the saved filter");
await page.goto(`${BASE}/desk/doctype/ToDo?status=Cancelled`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByRole("button", { name: "Remove Status filter" }).waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
const u = decodeURIComponent(new URL(page.url()).search);
check(u.includes("status=Cancelled") && !u.includes("priority"), `URL filter kept, saved one not merged (${u})`);
check((await page.getByRole("button", { name: "Remove Priority filter" }).count()) === 0, "no Priority chip");
for (let i = 0; i < 30; i++) {
  us = (await getUS()).List;
  if (JSON.stringify(us?.filters ?? []).includes("Cancelled")) break;
  await page.waitForTimeout(500);
}
check(JSON.stringify(us?.filters ?? []).includes("Cancelled"), "the URL filter becomes the saved filter (Desk saves current filters)");

await restore();
check(JSON.stringify((await getUS()).List ?? null) === JSON.stringify(origUS.List ?? null) || (await getUS()).List === null, "user settings restored");
await t.finish();
