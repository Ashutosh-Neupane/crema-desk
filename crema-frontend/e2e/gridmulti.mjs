// "Add Multiple" (Desk grid.set_multiple_add → form/link_selector.js): a Client Script calls
// frm.get_field(table).grid.set_multiple_add(link, qty) like ERPNext's transactions do; the grid shows Add Multiple;
// picking values asks for the quantity, adds rows (row events run), and a value already in the table gets the new
// quantity instead of a second row. The grid's set_query filters apply to the search. Saved rows checked via API.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/gridmulti.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const PARENT = "Crema Multi Doc";
const CHILD = "Crema Multi Row";
const SCRIPT = "Crema Multi Add";

async function cleanup() {
  const docs = await api(`api/resource/${encodeURIComponent(PARENT)}?limit_page_length=100`).catch(() => null);
  for (const d of docs?.data ?? []) await post("frappe.client.delete", { doctype: PARENT, name: d.name });
  await post("frappe.client.delete", { doctype: "Client Script", name: SCRIPT });
  await post("frappe.client.delete", { doctype: "DocType", name: PARENT });
  await post("frappe.client.delete", { doctype: "DocType", name: CHILD });
}
await cleanup();

// two enabled currencies to pick (Currency ships with Frappe; most are disabled by default)
const currencies = ((await api(`api/resource/Currency?filters=${encodeURIComponent(JSON.stringify([["enabled", "=", 1]]))}&limit_page_length=5`)).data ?? []).map((c) => c.name);
step(`setup: child table linking to Currency (enabled: ${currencies.join(", ")}), Client Script calling set_multiple_add`);
check(currencies.length >= 2, "at least two enabled currencies");
const [A, B] = currencies;
let r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: CHILD, module: "Custom", custom: 1, istable: 1,
    fields: [
      { fieldname: "currency", label: "Currency", fieldtype: "Link", options: "Currency", in_list_view: 1, columns: 4 },
      { fieldname: "qty", label: "Qty", fieldtype: "Float", in_list_view: 1, columns: 2 },
      { fieldname: "note", label: "Note", fieldtype: "Data", in_list_view: 1, columns: 3 },
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
// the row event proves rows go through the controller (Desk: frappe.model.set_value → child triggers)
r = await post("frappe.client.insert", {
  doc: {
    doctype: "Client Script", name: SCRIPT, dt: PARENT, view: "Form", enabled: 1,
    script: `frappe.ui.form.on(${JSON.stringify(PARENT)}, {
  onload(frm) {
    frm.get_field("lines").grid.set_multiple_add("currency", "qty");
    frm.set_query("currency", "lines", () => ({ filters: { name: ["in", ${JSON.stringify([A, B])}] } }));
  },
});
frappe.ui.form.on(${JSON.stringify(CHILD)}, {
  currency(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    frappe.model.set_value(cdt, cdn, "note", "event:" + row.currency);
  },
});`,
  },
});
check(r.ok(), `Client Script (${r.status()})`);

await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(PARENT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${PARENT}` }).waitFor({ timeout: 90000 });
await page.getByRole("textbox", { name: /^Title/ }).fill("Add multiple");

step("Add Multiple shown because the script asked for it");
const addMultiple = page.getByRole("button", { name: "Add Multiple" });
await addMultiple.waitFor({ timeout: 30000 });
check(true, "Add Multiple button");
// a blank row (like a new Sales Order's) is filled by the first pick, not left above it
await page.getByRole("button", { name: "Add row" }).click();
await addMultiple.click();
const dlg = page.getByRole("dialog");
await dlg.getByRole("heading", { name: "Select Currency" }).waitFor({ timeout: 10000 });
const results = dlg.getByRole("list", { name: "Currency results" });
await results.getByRole("button").first().waitFor({ timeout: 20000 });
const shown = (await results.getByRole("button").allInnerTexts()).map((s) => s.split(/\s/)[0]);
check(shown.length === 2 && shown.includes(A) && shown.includes(B), `set_query filters the search (${JSON.stringify(shown)})`);

step(`pick ${A} with qty 3, ${B} with qty 2`);
await results.getByRole("button", { name: new RegExp(`^${A}`) }).click();
const qty = dlg.getByRole("textbox", { name: "Qty" });
await qty.fill("3");
await qty.press("Enter");
await dlg.getByText(`Added: ${A} (3)`).waitFor({ timeout: 10000 });
await results.getByRole("button", { name: new RegExp(`^${B}`) }).click();
await dlg.getByRole("textbox", { name: "Qty" }).fill("2");
await dlg.getByRole("textbox", { name: "Qty" }).press("Enter");
await dlg.getByText(`${B} (2)`).waitFor({ timeout: 10000 });
check(true, "both added (Added: list)");
await shot("gridmulti_dialog", false);

step(`pick ${A} again with qty 5 → its row's quantity changes, no new row`);
await results.getByRole("button", { name: new RegExp(`^${A}`) }).click();
await dlg.getByRole("textbox", { name: "Qty" }).fill("5");
await dlg.getByRole("textbox", { name: "Qty" }).press("Enter");
await dlg.getByText(`${A} (5)`).waitFor({ timeout: 10000 });
await dlg.getByRole("button", { name: "Done" }).click();
const rows = page.locator('[data-cell$=":0"]');
check((await rows.count()) === 2, `two rows: the blank row was filled, ${A} not added twice (${await rows.count()})`);
const cellVal = (row, col) => page.locator(`[data-cell="${row}:${col}"]`).locator("input").first().inputValue();
check((await cellVal(0, 1)) === "5" || (await cellVal(0, 1)).startsWith("5"), `${A} qty 5 (${await cellVal(0, 1)})`);
check((await cellVal(1, 1)).startsWith("2"), `${B} qty 2 (${await cellVal(1, 1)})`);
check((await cellVal(0, 2)) === `event:${A}`, `row event ran (${await cellVal(0, 2)})`);
await shot("gridmulti_rows", false);

step("save → rows in the database");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForURL(new RegExp(`${encodeURIComponent(PARENT)}/(?!new)`), { timeout: 30000 });
const name = decodeURIComponent(page.url().split("/").pop());
const doc = (await api(`api/resource/${encodeURIComponent(PARENT)}/${name}`)).data;
const saved = (doc?.lines ?? []).map((l) => [l.currency, l.qty, l.note]);
console.log("  saved:", JSON.stringify(saved));
check(JSON.stringify(saved) === JSON.stringify([[A, 5, `event:${A}`], [B, 2, `event:${B}`]]), "saved rows match");

step("no script → no Add Multiple");
await post("frappe.client.set_value", { doctype: "Client Script", name: SCRIPT, fieldname: "enabled", value: 0 });
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(PARENT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${PARENT}` }).waitFor({ timeout: 90000 });
await page.getByRole("button", { name: "Add row" }).waitFor({ timeout: 30000 });
check(!(await page.getByRole("button", { name: "Add Multiple" }).isVisible()), "hidden without set_multiple_add");

step("cleanup");
await cleanup();
await t.finish();
