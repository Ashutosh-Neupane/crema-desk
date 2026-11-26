// An app's listview_settings hooks run like Desk (list/base_list.js, list/list_view.js, ui/page.js):
//  - Task (ERPNext): filters → default status = Open; onload page.add_menu_item + call_for_selected_items
//  - ToDo (Frappe): onload page.set_title, hide_name_column, per-row `button` that routes to the reference
//  - a throwaway DocType whose List client script uses formatters (sanitised), dropdown_button,
//    add_inner_button groups, add_action_item + get_checked_items, set_indicator, refresh(listview) with
//    get_filter_value, filter_area.add / clear
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/listhooks.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const resetList = (doctype, list = {}) => post("frappe.model.utils.user_settings.save", { doctype, user_settings: JSON.stringify({ List: list }) });
const DT = "Crema Hooks";
const q = (o) => encodeURIComponent(JSON.stringify(o));
// Task is a tree DocType: Desk (and Crema) open those in Tree view unless the list is asked for
const openList = async (doctype) => {
  await page.goto(`${BASE}/desk/${slug(doctype)}${doctype === "Task" ? "?view=list" : ""}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator("tbody tr").first().waitFor({ timeout: 90000 });
};
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function cleanup() {
  for (const d of (await api(`api/resource/Task?filters=${q([["subject", "like", "Crema hooks%"]])}&limit_page_length=50`).catch(() => null))?.data ?? []) await post("frappe.client.delete", { doctype: "Task", name: d.name });
  for (const d of (await api(`api/resource/ToDo?filters=${q([["description", "like", "%crema hooks%"]])}&limit_page_length=50`).catch(() => null))?.data ?? []) await post("frappe.client.delete", { doctype: "ToDo", name: d.name });
  for (const d of (await api(`api/resource/Client Script?filters=${q([["dt", "=", DT]])}`).catch(() => null))?.data ?? []) await post("frappe.client.delete", { doctype: "Client Script", name: d.name });
  for (const d of (await api(`api/resource/${encodeURIComponent(DT)}?limit_page_length=50`).catch(() => null))?.data ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
  for (const dt of ["Task", "ToDo", DT]) await resetList(dt);
}
await cleanup();

step("Task: listview_settings.filters is the default when nothing is saved");
const tasks = [];
for (const s of ["Crema hooks A", "Crema hooks B"]) tasks.push((await (await post("frappe.client.insert", { doc: { doctype: "Task", subject: s, status: "Open" } })).json()).message.name);
await openList("Task");
await page.waitForFunction(() => new URL(location.href).searchParams.get("status") === "Open", null, { timeout: 15000 }).catch(() => {});
check(new URL(page.url()).searchParams.get("status") === "Open", "status=Open applied");

step("Task: onload menu items run call_for_selected_items on the checked rows");
await page.getByRole("button", { name: "List settings" }).click();
check((await page.getByRole("menuitem", { name: "Set as Completed" }).count()) === 1, "Set as Completed in the menu");
check((await page.getByRole("menuitem", { name: "Set as Open" }).count()) === 1, "Set as Open in the menu");
await page.keyboard.press("Escape");
await page.getByPlaceholder(/Search/).fill("Crema hooks");
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 2, null, { timeout: 15000 });
for (const n of tasks) await page.getByRole("checkbox", { name: `Select ${n}` }).check();
await page.getByRole("button", { name: "List settings" }).click();
await page.getByRole("menuitem", { name: "Set as Completed" }).click();
await page.waitForTimeout(2000);
const st = await Promise.all(tasks.map(async (n) => (await api(`api/resource/Task/${n}`)).data.status));
check(st.every((s) => s === "Completed"), `both tasks Completed (${st.join(", ")})`);
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 0 || !document.body.innerText.includes("Crema hooks"), null, { timeout: 15000 }).catch(() => {});
check(!(await page.locator("tbody").innerText().catch(() => "")).includes("Crema hooks"), "list refreshed: completed tasks leave the Open filter");
await page.getByPlaceholder(/Search/).fill("");

step("ToDo: set_title, hide_name_column, row button opens the reference");
const todo = (await (await post("frappe.client.insert", { doc: { doctype: "ToDo", description: "crema hooks todo", reference_type: "Task", reference_name: tasks[0] } })).json()).message.name;
await openList("ToDo");
check((await page.getByRole("heading", { level: 1 }).innerText()) === "To Do", "title is To Do");
const todoRow = page.locator("tbody tr").filter({ hasText: "crema hooks todo" });
await todoRow.waitFor({ timeout: 15000 });
check(!(await todoRow.innerText()).includes(todo), "name column hidden");
const open = todoRow.locator(`[data-row-button="${todo}"]`);
check((await open.innerText()) === "Open" && (await open.getAttribute("title")) === `Open Task: ${tasks[0]}`, "row button label + description");
await shot("listhooks_todo", false);
await open.click();
await page.waitForURL(new RegExp(`/task/${tasks[0]}`), { timeout: 15000 }).catch(() => {});
check(page.url().includes(`/task/${tasks[0]}`), "row button opened the Task");

step("tree DocType list keeps ?view=list and both kinds of URL filter");
await page.goto(`${BASE}/desk/task?view=list&status=Open&filters=${q([["Task", "priority", "!=", "Urgent"]])}`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /Remove .*Status/ }).waitFor({ timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
check(page.url().includes("view=list") && !page.url().includes("/view/tree"), "still the list (view=list kept)");
check((await page.getByRole("button", { name: /Remove .*Status/ }).count()) === 1 && (await page.getByRole("button", { name: /Remove .*Priority/ }).count()) === 1, "status = Open and priority != Urgent both applied");

step("custom DocType: List client script");
let r = await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "field:title", title_field: "title",
  fields: [{ fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1, unique: 1, in_list_view: 1 }, { fieldname: "qty", label: "Qty", fieldtype: "Int", in_list_view: 1 }],
  permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });
check(r.ok(), `DocType (${r.status()})`);
for (const [title, qty] of [["Small", 2], ["Big", 9]]) await post("frappe.client.insert", { doc: { doctype: DT, title, qty } });
const script = `
let lv;
frappe.listview_settings["${DT}"] = {
  formatters: { qty: (v) => \`<b data-qty>\${v} pcs</b><img src="x" onerror="document.title='xss'">\` },
  dropdown_button: { get_label: "More", buttons: [
    { get_label: "Double", show: (d) => d.qty > 0, action: (d) => frappe.db.set_value("${DT}", d.name, "qty", d.qty * 2).then(() => lv.refresh()) },
    { get_label: "Never", show: () => false, action: () => {} },
  ] },
  onload(listview) {
    lv = listview;
    listview.page.add_inner_button("Only big", () => listview.filter_area.add([["qty", ">", 5]]), "Tools");
    listview.page.add_inner_button("Clear filters", () => listview.filter_area.clear(), "Tools");
    listview.page.add_action_item("Zero qty", () =>
      Promise.all(listview.get_checked_items(true).map((n) => frappe.db.set_value("${DT}", n, "qty", 0))).then(() => listview.refresh()));
  },
  refresh(listview) {
    listview.page.set_indicator("rows " + listview.data.length + " qty " + (listview.get_filter_value("qty") ?? "-"), "blue");
  },
};`;
r = await post("frappe.client.insert", { doc: { doctype: "Client Script", name: "Crema Hooks List", dt: DT, view: "List", enabled: 1, script } });
check(r.ok(), `List client script (${r.status()})`);
await openList(DT);
const row = (title) => page.locator("tbody tr").filter({ has: page.getByRole("link", { name: title, exact: true }) });
await row("Big").waitFor({ timeout: 30000 });
const ind = page.locator("[data-page-indicator]");
await page.waitForFunction(() => document.querySelector("[data-page-indicator]")?.textContent === "rows 2 qty -", null, { timeout: 15000 }).catch(() => {});
check((await ind.innerText().catch(() => "")) === "rows 2 qty -", `refresh hook → set_indicator (${await ind.innerText().catch(() => "")})`);
check((await row("Big").locator("[data-qty]").innerText()) === "9 pcs", "formatter output shown");
check((await row("Big").locator("img[onerror]").count()) === 0 && (await page.title()) !== "xss", "formatter HTML sanitised");

step("inner buttons (grouped) + filter_area + get_filter_value");
await page.getByRole("button", { name: "Tools", exact: true }).click();
await page.getByRole("menuitem", { name: "Only big" }).click();
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1, null, { timeout: 15000 });
check((await row("Big").count()) === 1, "filter_area.add → only Big");
await page.waitForFunction(() => document.querySelector("[data-page-indicator]")?.textContent?.startsWith("rows 1"), null, { timeout: 15000 }).catch(() => {});
check((await ind.innerText()) === "rows 1 qty 5", `get_filter_value("qty") (${await ind.innerText()})`);
await page.getByRole("button", { name: "Tools", exact: true }).click();
await page.getByRole("menuitem", { name: "Clear filters" }).click();
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 2, null, { timeout: 15000 });
check(true, "filter_area.clear → both rows");

step("dropdown_button per row");
await row("Small").getByRole("button", { name: "More" }).click();
check((await page.getByRole("menuitem", { name: "Never" }).count()) === 0, "a button whose show() is false is hidden");
await page.getByRole("menuitem", { name: "Double" }).click();
await page.waitForFunction(() => [...document.querySelectorAll("[data-qty]")].some((e) => e.textContent === "4 pcs"), null, { timeout: 15000 }).catch(() => {});
check((await api(`api/resource/${encodeURIComponent(DT)}/Small`)).data.qty === 4, "Double → qty 4");
check(!page.url().includes("/Small") && (await row("Small").locator("[data-qty]").innerText()) === "4 pcs", "stayed on the list, which refreshed");

step("add_action_item uses the checked rows");
await page.getByRole("checkbox", { name: "Select Big" }).check();
await page.getByRole("button", { name: /^Actions/ }).click();
await page.getByRole("menuitem", { name: "Zero qty" }).click();
await page.waitForTimeout(2000);
check((await api(`api/resource/${encodeURIComponent(DT)}/Big`)).data.qty === 0, "Big → qty 0");
check((await api(`api/resource/${encodeURIComponent(DT)}/Small`)).data.qty === 4, "Small untouched");
await shot("listhooks_custom", false);
check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);

step("cleanup");
await cleanup();
await t.finish();
