// Grid column settings per user (Desk grid_row.js configure_columns / update_user_settings_for_grid):
// remove, add, reorder and size columns from the header gear; saved as GridView[<child doctype>] = [{fieldname, width}]
// in the parent's user settings (the record Desk v16 reads); survives a reload; Desk's legacy `columns` units are read;
// Reset to default drops only this table's entry; at least one column must stay.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/gridcols.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const PARENT = "Crema Cols Doc";
const CHILD = "Crema Cols Row";
const OTHER = "Some Other Row"; // another table's GridView entry must survive our saves

const getUS = async () => {
  const r = await (await post("frappe.model.utils.user_settings.get", { doctype: PARENT })).json();
  return JSON.parse(r.message ?? "{}");
};
const setGridView = (gv) => post("frappe.model.utils.user_settings.save", { doctype: PARENT, user_settings: JSON.stringify({ GridView: gv }) });

async function cleanup() {
  const docs = await api(`api/resource/${encodeURIComponent(PARENT)}?limit_page_length=100`).catch(() => null);
  for (const d of docs?.data ?? []) await post("frappe.client.delete", { doctype: PARENT, name: d.name });
  await setGridView(null);
  await post("frappe.client.delete", { doctype: "DocType", name: PARENT });
  await post("frappe.client.delete", { doctype: "DocType", name: CHILD });
}
await cleanup();

step("setup: child table (item, qty, rate in the list; notes not)");
let r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: CHILD, module: "Custom", custom: 1, istable: 1,
    fields: [
      { fieldname: "item", label: "Item", fieldtype: "Data", in_list_view: 1, columns: 3 },
      { fieldname: "qty", label: "Qty", fieldtype: "Int", in_list_view: 1, columns: 2 },
      { fieldname: "rate", label: "Rate", fieldtype: "Float", in_list_view: 1, columns: 2 },
      { fieldname: "notes", label: "Notes", fieldtype: "Data" },
    ],
  },
});
check(r.ok(), `child DocType (${r.status()})`);
r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: PARENT, module: "Custom", custom: 1, autoname: "hash",
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
      { fieldname: "lines", label: "Lines", fieldtype: "Table", options: CHILD },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
check(r.ok(), `parent DocType (${r.status()})`);
await setGridView({ [OTHER]: [{ fieldname: "x", width: 100 }] });

const headers = async () => (await page.getByRole("columnheader").allInnerTexts()).map((s) => s.replace("*", "").trim()).filter(Boolean);
async function openNew() {
  await page.goto(`${BASE}/desk/${slug(PARENT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("heading", { name: `New ${PARENT}` }).waitFor({ timeout: 90000 });
  await page.getByRole("columnheader").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(500);
}

step("defaults: in_list_view columns");
await openNew();
check(JSON.stringify(await headers()) === JSON.stringify(["Item", "Qty", "Rate"]), `headers ${JSON.stringify(await headers())}`);

step("gear → remove Rate, add Notes, move it first, width 300 → Update");
await page.getByRole("button", { name: "Configure columns of Lines" }).click();
const dlg = page.getByRole("dialog");
await dlg.getByRole("heading", { name: /Column Settings/ }).waitFor({ timeout: 10000 });
await dlg.getByRole("button", { name: "Remove Rate" }).click();
await dlg.getByRole("combobox", { name: "Add a column" }).selectOption("notes");
await dlg.getByRole("button", { name: "Move Notes up" }).click();
await dlg.getByRole("button", { name: "Move Notes up" }).click();
// typed key by key: focus must stay in the field (a dialog once re-focused on every render)
const width = dlg.getByRole("spinbutton", { name: "Notes width" });
await width.fill("");
await width.pressSequentially("300", { delay: 40 });
const focused = await width.evaluate((e) => e === document.activeElement);
check((await width.inputValue()) === "300" && focused, `width typed key by key, focus kept (${await width.inputValue()}, focused ${focused})`);
await shot("gridcols_dialog", false);
await dlg.getByRole("button", { name: "Update" }).click();
await dlg.waitFor({ state: "hidden", timeout: 10000 });
check(JSON.stringify(await headers()) === JSON.stringify(["Notes", "Item", "Qty"]), `headers now ${JSON.stringify(await headers())}`);
let us = await getUS();
const mine = us.GridView?.[CHILD] ?? [];
console.log("  GridView:", JSON.stringify(us.GridView));
check(JSON.stringify(mine.map((c) => c.fieldname)) === JSON.stringify(["notes", "item", "qty"]), "saved in Desk's GridView format");
check(mine[0]?.width === 300, `Notes width 300 px (${mine[0]?.width})`);
check(!!us.GridView?.[OTHER], "another table's entry kept");
const wNotes = await page.locator('[role="columnheader"][data-fieldname="notes"]').evaluate((e) => e.getBoundingClientRect().width);
const wQty = await page.locator('[role="columnheader"][data-fieldname="qty"]').evaluate((e) => e.getBoundingClientRect().width);
check(wNotes > wQty * 2, `Notes wider than Qty (${Math.round(wNotes)} vs ${Math.round(wQty)} px)`);
await shot("gridcols_custom", false);

step("survives a reload");
await openNew();
check(JSON.stringify(await headers()) === JSON.stringify(["Notes", "Item", "Qty"]), `after reload ${JSON.stringify(await headers())}`);

step("at least one column must stay");
await page.getByRole("button", { name: "Configure columns of Lines" }).click();
await dlg.getByRole("button", { name: "Remove Notes" }).click();
await dlg.getByRole("button", { name: "Remove Item" }).click();
await dlg.getByRole("button", { name: "Remove Qty" }).click();
check(await dlg.getByRole("alert").getByText("At least one column is required").isVisible(), "error shown");
check((await dlg.getByRole("list", { name: "Columns" }).getByRole("listitem").count()) === 1, "last column kept");

step("Reset to default drops only this table's setting");
await dlg.getByRole("button", { name: "Reset to default" }).click();
await dlg.waitFor({ state: "hidden", timeout: 10000 });
check(JSON.stringify(await headers()) === JSON.stringify(["Item", "Qty", "Rate"]), `defaults back ${JSON.stringify(await headers())}`);
us = await getUS();
check(!us.GridView?.[CHILD] && !!us.GridView?.[OTHER], `only ${CHILD} removed (${JSON.stringify(us.GridView)})`);

step("Desk's legacy `columns` units are read");
await setGridView({ [CHILD]: [{ fieldname: "rate", columns: 4 }, { fieldname: "item", columns: 2 }] });
await openNew();
check(JSON.stringify(await headers()) === JSON.stringify(["Rate", "Item"]), `legacy setting ${JSON.stringify(await headers())}`);

step("cleanup");
await cleanup();
await t.finish();
