// Grid details: Move To (row editor), Duplicate with a no_copy child field, select-all "Delete all N rows" across pages.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/gridmove.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const raw = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const post = async (method, data) => (await (await raw(method, data)).json()).message;
const P = "Crema GM Doc";
const C = "Crema GM Row";
async function cleanup() {
  for (const d of (await post("frappe.client.get_list", { doctype: P, fields: ["name"] }).catch(() => [])) ?? []) {
    await raw("frappe.client.delete", { doctype: P, name: d.name });
  }
  await raw("frappe.client.delete", { doctype: "DocType", name: P });
  await raw("frappe.client.delete", { doctype: "DocType", name: C });
}
await cleanup();
await post("frappe.client.insert", { doc: { doctype: "DocType", name: C, module: "Custom", custom: 1, istable: 1, fields: [
  { fieldname: "item", label: "Item", fieldtype: "Data", in_list_view: 1 },
  { fieldname: "secret", label: "Secret", fieldtype: "Data", in_list_view: 1, no_copy: 1 },
] } });
await post("frappe.client.insert", { doc: { doctype: "DocType", name: P, module: "Custom", custom: 1, autoname: "hash", fields: [
  { fieldname: "title", label: "Title", fieldtype: "Data" },
  { fieldname: "rows", label: "Rows", fieldtype: "Table", options: C },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });

const get = (name) => post("frappe.client.get", { doctype: P, name });
const items = (d) => (d?.rows ?? []).map((r) => r.item).join(",");
const idxOk = (d) => (d?.rows ?? []).every((r, i) => r.idx === i + 1);
const mk = async (rows) => (await post("frappe.client.insert", { doc: { doctype: P, title: "t", rows: rows.map((item) => ({ item, secret: `s-${item}` })) } })).name;
const open = async (name) => {
  await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(P)}/${encodeURIComponent(name)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("checkbox", { name: "Select all rows" }).or(page.getByRole("button", { name: "Edit row 1", exact: true })).first().waitFor({ timeout: 120000 });
};
const save = async () => page.getByRole("button", { name: /^Save$/ }).click();
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

step("Move To: row 1 to position 3");
const name = await mk(["A", "B", "C", "D"]);
await open(name);
await page.getByRole("button", { name: "Edit row 1", exact: true }).click();
await dlg().getByRole("button", { name: "Move To", exact: true }).click();
await dlg().getByLabel("Move to Row Number").fill("3");
await dlg().getByRole("button", { name: "Update", exact: true }).click();
await save();
let d = await poll(name, (x) => items(x) === "B,C,A,D");
check(items(d) === "B,C,A,D", `row moved to position 3 (${items(d)})`);
check(idxOk(d), "idx contiguous 1..4 after Move To");

step("Move To: out-of-range value clamps to last row");
await open(name);
await page.getByRole("button", { name: "Edit row 1", exact: true }).click(); // B
await dlg().getByRole("button", { name: "Move To", exact: true }).click();
await dlg().getByLabel("Move to Row Number").fill("99");
await dlg().getByRole("button", { name: "Update", exact: true }).click();
await save();
d = await poll(name, (x) => items(x) === "C,A,D,B");
check(items(d) === "C,A,D,B", `out-of-range Move To lands on last row (${items(d)})`);
check(idxOk(d), "idx contiguous after clamped move");

step("Duplicate selected row: normal fields copied, no_copy field per Desk (grid duplicate ignores no_copy)");
await page.getByRole("checkbox", { name: "Select row 1", exact: true }).check(); // C
await page.getByRole("button", { name: "Duplicate", exact: true }).click();
await save();
d = await poll(name, (x) => (x.rows?.length ?? 0) === 5);
const dup = d.rows?.[4];
check(d.rows?.length === 5, `duplicate appended a row (${items(d)})`);
check(dup?.item === "C", `normal field copied (item=${dup?.item})`);
check(dup?.secret === "s-C", `no_copy field copied, matching Desk grid duplicate (secret=${dup?.secret})`);
check(idxOk(d), "idx contiguous after Duplicate");
await shot("gridmove_duplicated", false);

step("select-all across pages → Delete all N rows");
const big = (await mk(Array.from({ length: 52 }, (_, i) => `R${i + 1}`)));
await open(big);
await page.getByRole("checkbox", { name: "Select all rows" }).check();
check((await page.getByRole("button", { name: "Delete all 52 rows", exact: true }).count()) === 1, "Delete all 52 rows shown");
await page.getByRole("button", { name: "Delete all 52 rows", exact: true }).click();
// Desk's frappe.confirm (an in-app dialog, not the browser's)
await page.getByRole("dialog").getByRole("button", { name: "Yes", exact: true }).click();
await save();
d = await poll(big, (x) => (x.rows?.length ?? 0) === 0);
check((d.rows?.length ?? 0) === 0, "Delete all empties the table on the server");

step("cleanup");
await cleanup();
await t.finish();
