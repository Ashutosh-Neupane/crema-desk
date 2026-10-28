// Grid row operations: Insert Above/Below, multi-select Delete, select-all, _add/_remove events, read-only.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/gridrows.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const raw = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const post = async (method, data) => (await (await raw(method, data)).json()).message;
const P = "Crema GR Doc";
const C = "Crema GR Row";
const CS = "Crema GR Client Script";
async function cleanup() {
  for (const d of (await post("frappe.client.get_list", { doctype: P, fields: ["name", "docstatus"] }).catch(() => [])) ?? []) {
    if (d.docstatus === 1) await raw("frappe.client.cancel", { doctype: P, name: d.name });
    await raw("frappe.client.delete", { doctype: P, name: d.name });
  }
  await raw("frappe.client.delete", { doctype: "Client Script", name: CS });
  await raw("frappe.client.delete", { doctype: "DocType", name: P });
  await raw("frappe.client.delete", { doctype: "DocType", name: C });
}
await cleanup();
await post("frappe.client.insert", { doc: { doctype: "DocType", name: C, module: "Custom", custom: 1, istable: 1, fields: [
  { fieldname: "item", label: "Item", fieldtype: "Data", in_list_view: 1 },
] } });
await post("frappe.client.insert", { doc: { doctype: "DocType", name: P, module: "Custom", custom: 1, autoname: "hash", is_submittable: 1, fields: [
  { fieldname: "title", label: "Title", fieldtype: "Data" },
  { fieldname: "adds", label: "Adds", fieldtype: "Int" },
  { fieldname: "removes", label: "Removes", fieldtype: "Int" },
  { fieldname: "rows", label: "Rows", fieldtype: "Table", options: C },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1 }] } });
const script = `
frappe.ui.form.on("${C}", {
  rows_add(frm) { frm.set_value("adds", (frm.doc.adds || 0) + 1); },
  rows_remove(frm) { frm.set_value("removes", (frm.doc.removes || 0) + 1); },
});`;
await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: P, view: "Form", enabled: 1, script } }).catch(() => {});
const mk = async (submit) => {
  const d = await post("frappe.client.insert", { doc: { doctype: P, title: "t", adds: 0, removes: 0, rows: ["A", "B", "C"].map((item) => ({ item })) } });
  if (submit) await raw("frappe.client.submit", { doc: { ...d } });
  return d.name;
};
const get = (name) => post("frappe.client.get", { doctype: P, name });
const items = (d) => (d?.rows ?? []).map((r) => r.item).join(",");
const idxOk = (d) => (d?.rows ?? []).every((r, i) => r.idx === i + 1);
const open = async (name) => {
  await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(P)}/${encodeURIComponent(name)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("checkbox", { name: "Select all rows" }).or(page.getByRole("button", { name: "Edit row 1", exact: true })).first().waitFor({ timeout: 120000 });
};
const save = async () => {
  await page.getByRole("button", { name: /^Save$/ }).click();
};
const poll = async (name, fn) => {
  let d;
  for (let i = 0; i < 40; i++) {
    d = await get(name);
    if (fn(d)) return d;
    await page.waitForTimeout(500);
  }
  return d;
};
const dlg = () => page.getByRole("dialog");

const name = await mk(false);
await open(name);

step("Insert Above row 2, Insert Below row 3");
await page.getByRole("button", { name: "Edit row 2", exact: true }).click();
await dlg().getByRole("button", { name: "Insert Above", exact: true }).click();
await dlg().getByRole("textbox", { name: /^Item/ }).fill("X");
await dlg().getByRole("button", { name: "Close" }).click();
await page.getByRole("button", { name: "Edit row 3", exact: true }).click(); // B
await dlg().getByRole("button", { name: "Insert Below", exact: true }).click();
await dlg().getByRole("textbox", { name: /^Item/ }).fill("Y");
await dlg().getByRole("button", { name: "Close" }).click();
await shot("gridrows_inserted", false);
await save();
let d = await poll(name, (x) => x.rows?.length === 5);
check(items(d) === "A,X,B,Y,C", `insert above/below positions (${items(d)})`);
check(idxOk(d), "idx contiguous 1..5");
check(d.adds === 2, `rows_add handler fired twice (${d.adds})`);

step("select rows 1 and 4 → Delete");
await page.getByRole("checkbox", { name: "Select row 1", exact: true }).check();
await page.getByRole("checkbox", { name: "Select row 4", exact: true }).check();
await page.getByRole("button", { name: "Delete", exact: true }).click();
await save();
d = await poll(name, (x) => x.rows?.length === 3);
check(items(d) === "X,B,C", `selected rows removed (${items(d)})`);
check(idxOk(d), "idx renumbered after delete");
check(d.removes === 2, `rows_remove handler fired per row (${d.removes})`);

step("select all → Delete");
await page.getByRole("checkbox", { name: "Select all rows" }).check();
await page.getByRole("button", { name: "Delete", exact: true }).click();
await save();
d = await poll(name, (x) => (x.rows?.length ?? 0) === 0);
check((d.rows?.length ?? 0) === 0, "select all + delete empties the table");
check(d.removes === 5, `rows_remove fired for every row (${d.removes})`);

step("submitted doc: grid is read-only");
const sub = await mk(true);
await open(sub);
check((await get(sub)).docstatus === 1, "doc submitted");
check((await page.getByRole("checkbox", { name: "Select all rows" }).count()) === 0, "no select-all checkbox");
check((await page.getByRole("button", { name: "Add row" }).count()) === 0, "no Add row button");
await page.getByRole("button", { name: "Edit row 1", exact: true }).click();
check((await dlg().getByRole("button", { name: "Insert Above", exact: true }).count()) === 0, "no Insert Above in read-only row editor");
check((await dlg().getByRole("button", { name: "Insert Below", exact: true }).count()) === 0, "no Insert Below in read-only row editor");
await shot("gridrows_readonly", false);

step("cleanup");
await cleanup();
await t.finish();
