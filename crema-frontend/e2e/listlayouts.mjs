// Saved list layouts (Desk v16 list/list_filter/: List Filter) on ToDo: create (filters, sort, columns, global),
// switch to Default Layout and back, the last layout comes back on reopen, URL filters select the matching layout,
// duplicate as personal, edit, delete; a layout made elsewhere (as Desk saves it) shows under Your Layouts.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/listlayouts.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "ToDo";
const NAMES = ["Crema Open", "Crema Open (copy)", "Crema Open Edited", "Crema From Desk"];

async function cleanup() {
  const r = await api(`api/resource/List Filter?filters=${encodeURIComponent(JSON.stringify([["reference_doctype", "=", DT], ["filter_name", "in", NAMES]]))}&limit_page_length=50`).catch(() => null);
  for (const d of r?.data ?? []) await post("frappe.desk.doctype.list_filter.list_filter.delete_list_filter", { name: d.name });
  // forget the remembered layout so the list opens on Default Layout
  await post("frappe.model.utils.user_settings.save", { doctype: DT, user_settings: JSON.stringify({ List: { active_layout_name: "", filters: [] } }) });
}
const layoutDoc = async (filter_name) => (await api(`api/resource/List Filter?filters=${encodeURIComponent(JSON.stringify([["reference_doctype", "=", DT], ["filter_name", "=", filter_name]]))}&fields=${encodeURIComponent('["*"]')}`)).data?.[0];
await cleanup();
await post("frappe.client.insert", { doc: { doctype: DT, description: "crema layout open todo", status: "Open" } });

const trigger = () => page.getByRole("button", { name: /^Layout: / });
const open = async (q = "") => {
  await page.goto(`${BASE}/desk/${slug(decodeURIComponent(DT))}${q}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await trigger().waitFor({ timeout: 90000 });
};

step("list opens on Default Layout");
await open();
check((await trigger().getAttribute("aria-label")) === "Layout: Default Layout", "Default Layout");

step("Create Layout: status = Open, sort by Created On ascending, a column removed, for all users");
await trigger().click();
await page.getByRole("menuitem", { name: "Create Layout" }).click();
const dlg = page.getByRole("dialog", { name: "Create layout" });
await dlg.getByLabel("Layout name").fill("Crema Open");
await dlg.getByLabel("Filter field").selectOption("status");
await dlg.getByLabel("Filter operator").selectOption("=");
await dlg.getByLabel("Filter value").selectOption("Open");
await dlg.getByRole("button", { name: "Add filter" }).click();
check((await dlg.getByRole("list", { name: "Layout filters" }).innerText()).includes("Open"), "filter listed");
await dlg.getByLabel("Sort Field").selectOption("creation");
await dlg.getByLabel("Sort Order").selectOption("asc");
const cols = dlg.getByRole("list", { name: "Layout columns" }).locator("li");
const before = await cols.count();
const removed = await cols.last().getAttribute("data-column");
await cols.last().getByRole("button", { name: /^Remove column/ }).click();
check((await cols.count()) === before - 1, `column ${removed} removed (${before} → ${before - 1})`);
await dlg.getByRole("checkbox", { name: "Available to all users" }).check();
await shot("listlayouts_create", false);
await dlg.getByRole("button", { name: "Create" }).click();
await page.waitForFunction(() => document.querySelector('button[aria-label^="Layout: "]')?.getAttribute("aria-label") === "Layout: Crema Open", null, { timeout: 15000 });

const saved = await layoutDoc("Crema Open");
check(!!saved && !saved.for_user, "saved as a global List Filter");
check(JSON.stringify(JSON.parse(saved.filters)) === JSON.stringify([[DT, "status", "=", "Open"]]), `filters ${saved.filters}`);
check(saved.route_signature === "status=Open", `route_signature ${saved.route_signature}`);
check(saved.sort_field === "creation" && saved.sort_order === "asc", `sort ${saved.sort_field} ${saved.sort_order}`);
check(!JSON.parse(saved.columns).some((c) => c.fieldname === removed), "columns saved without the removed one");
await page.waitForFunction(() => new URL(location.href).searchParams.get("status") === "Open", null, { timeout: 10000 }).catch(() => {});
check(new URL(page.url()).searchParams.get("status") === "Open", "applied: list filtered by status=Open");

step("Default Layout and back");
await trigger().click();
await page.getByRole("menuitemradio", { name: /Default Layout/ }).click();
await page.waitForFunction(() => !new URL(location.href).searchParams.get("status"), null, { timeout: 10000 });
check((await trigger().getAttribute("aria-label")) === "Layout: Default Layout", "Default Layout restores the filters it had");
await trigger().click();
await page.getByRole("menuitemradio", { name: /Crema Open/ }).click();
await page.waitForFunction(() => new URL(location.href).searchParams.get("status") === "Open", null, { timeout: 10000 });
check(true, "Crema Open applied again");

step("reopening the list brings the last layout back; URL filters pick the matching layout");
await page.waitForTimeout(1500); // user settings are saved after render
await open();
await page.waitForFunction(() => document.querySelector('button[aria-label^="Layout: "]')?.getAttribute("aria-label") === "Layout: Crema Open", null, { timeout: 15000 });
check(new URL(page.url()).searchParams.get("status") === "Open", "remembered layout re-applied");
await trigger().click();
await page.getByRole("menuitemradio", { name: /Default Layout/ }).click();
await page.waitForTimeout(1500);
await open("?status=Open");
await page.waitForFunction(() => document.querySelector('button[aria-label^="Layout: "]')?.getAttribute("aria-label") === "Layout: Crema Open", null, { timeout: 15000 });
check(true, "?status=Open → Crema Open (route signature)");

step("Manage: duplicate as personal, edit, delete");
await trigger().click();
await page.getByRole("menuitem", { name: "Manage Layouts" }).click();
const mng = page.getByRole("dialog", { name: "Manage Layouts" });
check((await mng.locator('[data-layout="Crema Open"]').innerText()).includes("Global"), "Crema Open is Global");
await mng.getByRole("button", { name: "Duplicate Crema Open" }).click();
const dup = page.getByRole("dialog", { name: "Create layout" });
check((await dup.getByLabel("Layout name").inputValue()) === "Crema Open (copy)", "duplicate named … (copy)");
check((await dup.getByRole("list", { name: "Layout filters" }).innerText()).includes("Open"), "duplicate keeps the filters");
await dup.getByRole("checkbox", { name: "Available to all users" }).uncheck();
await dup.getByRole("button", { name: "Create" }).click();
await page.waitForFunction(() => document.querySelector('button[aria-label^="Layout: "]')?.getAttribute("aria-label") === "Layout: Crema Open (copy)", null, { timeout: 15000 });
check((await layoutDoc("Crema Open (copy)"))?.for_user === "Administrator", "copy is personal");
await trigger().click();
check((await page.getByRole("menuitemradio", { name: /Crema Open \(copy\)/ }).count()) === 1, "copy under Your Layouts");
await page.keyboard.press("Escape");

await trigger().click();
await page.getByRole("menuitem", { name: "Manage Layouts" }).click();
await mng.getByRole("button", { name: "Edit Crema Open", exact: true }).click();
const ed = page.getByRole("dialog", { name: "Edit layout" });
await ed.getByLabel("Layout name").fill("Crema Open Edited");
await ed.getByRole("button", { name: "Update" }).click();
await page.waitForTimeout(1500);
check(!!(await layoutDoc("Crema Open Edited")) && !(await layoutDoc("Crema Open")), "renamed to Crema Open Edited");
check((await trigger().getAttribute("aria-label")) === "Layout: Crema Open Edited", "the edited layout is applied");

await trigger().click();
await page.getByRole("menuitem", { name: "Manage Layouts" }).click();
await mng.getByRole("button", { name: "Delete Crema Open (copy)" }).click();
await mng.getByRole("button", { name: "Yes" }).click();
await page.waitForTimeout(1500);
check(!(await layoutDoc("Crema Open (copy)")), "copy deleted");
check((await trigger().getAttribute("aria-label")) === "Layout: Crema Open Edited", "deleting another layout keeps the active one");
await mng.getByRole("button", { name: "Delete Crema Open Edited" }).click();
await mng.getByRole("button", { name: "Yes" }).click();
await page.waitForTimeout(1500);
check((await trigger().getAttribute("aria-label")) === "Layout: Default Layout", "deleting the active layout → Default Layout");
await page.keyboard.press("Escape");

step("a layout saved as Desk does shows under Your Layouts");
await post("frappe.client.insert", { doc: { doctype: "List Filter", reference_doctype: DT, filter_name: "Crema From Desk", for_user: "Administrator", filters: JSON.stringify([[DT, "status", "=", "Closed"]]), columns: "[]", sort_field: "modified", sort_order: "desc" } });
await open();
await trigger().click();
await page.getByRole("menuitemradio", { name: /Crema From Desk/ }).click();
await page.waitForFunction(() => new URL(location.href).searchParams.get("status") === "Closed", null, { timeout: 10000 });
check(true, "Desk's layout applied (status=Closed)");
await shot("listlayouts_desk", false);

step("cleanup");
await cleanup();
await t.finish();
