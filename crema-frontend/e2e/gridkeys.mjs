// Grid keyboard and paste, like Desk (form/grid_row.js set_arrow_keys, form/controls/table.js paste):
// Tab across / off the last cell (adds a row), ↑/↓ between rows, Ctrl+↓/↑ insert, Ctrl+Shift+↑ add at the start,
// Shift+Alt+↓ duplicate, Esc drops a new empty row, tab-separated paste fills rows (with and without a header row);
// a value set while a cell is focused survives its blur. Saved rows are checked through the API.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/gridkeys.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const PARENT = "Crema Grid Doc";
const CHILD = "Crema Grid Row";
const mod = process.platform === "darwin" ? "Meta" : "Control";

async function cleanup() {
  const docs = await api(`api/resource/${encodeURIComponent(PARENT)}?limit_page_length=100`).catch(() => null);
  for (const d of docs?.data ?? []) await post("frappe.client.delete", { doctype: PARENT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: PARENT });
  await post("frappe.client.delete", { doctype: "DocType", name: CHILD });
}
await cleanup();

step("setup: parent DocType with a child table (item, qty, rate, due)");
let r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: CHILD, module: "Custom", custom: 1, istable: 1,
    fields: [
      { fieldname: "item", label: "Item", fieldtype: "Data", in_list_view: 1, columns: 3 },
      { fieldname: "qty", label: "Qty", fieldtype: "Int", in_list_view: 1, columns: 2 },
      { fieldname: "rate", label: "Rate", fieldtype: "Float", in_list_view: 1, columns: 2 },
      { fieldname: "due", label: "Due", fieldtype: "Date", in_list_view: 1, columns: 2 },
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

const cell = (row, col) => page.locator(`[data-cell="${row}:${col}"]`).locator("input").first();
const rowCount = () => page.locator('[data-cell$=":0"]').count();
const focusedCell = () => page.evaluate(() => document.activeElement?.closest("[data-cell]")?.getAttribute("data-cell") ?? null);
const values = async (col) => {
  const n = await rowCount();
  const out = [];
  for (let i = 0; i < n; i++) out.push(await cell(i, col).inputValue());
  return out;
};

await page.goto(`${BASE}/desk/${slug(PARENT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${PARENT}` }).waitFor({ timeout: 90000 });
await page.getByRole("textbox", { name: /^Title/ }).fill("Grid keys");

step("Tab across a row; Tab off the last cell adds a row");
await page.getByRole("button", { name: "Add row" }).click();
await cell(0, 0).click();
await page.keyboard.type("Apple");
await page.keyboard.press("Tab");
await page.keyboard.type("3");
await page.keyboard.press("Tab");
await page.keyboard.type("1.5");
await page.keyboard.press("Tab"); // → Due
check((await focusedCell()) === "0:3", `Tab walks the row (${await focusedCell()})`);
await page.keyboard.press("Escape"); // close the calendar
await cell(0, 3).focus();
await page.keyboard.press("Tab");
await page.waitForTimeout(500);
check((await rowCount()) === 2, `Tab off the last cell added a row (${await rowCount()})`);
check((await focusedCell()) === "1:0", `focus on the new row's first cell (${await focusedCell()})`);
await page.keyboard.type("Banana");

step("↓ / ↑ keep the column");
await cell(0, 1).focus();
await page.keyboard.press("ArrowDown");
check((await focusedCell()) === "1:1", `↓ → row 2, Qty (${await focusedCell()})`);
await page.keyboard.type("7");
await page.keyboard.press("ArrowUp");
check((await focusedCell()) === "0:1", `↑ → row 1, Qty (${await focusedCell()})`);
check((await cell(1, 1).inputValue()) === "7", "value committed when leaving the cell");

step("Ctrl/⌘+↓ inserts below, Ctrl/⌘+Shift+↑ adds at the start, Shift+Alt+↓ duplicates");
await cell(0, 0).focus();
await page.keyboard.press(`${mod}+ArrowDown`);
await page.waitForTimeout(400);
check(JSON.stringify(await values(0)) === JSON.stringify(["Apple", "", "Banana"]), `inserted below row 1 (${JSON.stringify(await values(0))})`);
check((await focusedCell()) === "1:0", `focus in the inserted row (${await focusedCell()})`);
await page.keyboard.type("Cherry");
await page.keyboard.press(`${mod}+Shift+ArrowUp`);
await page.waitForTimeout(400);
check((await values(0))[0] === "" && (await rowCount()) === 4, `row added at the start (${JSON.stringify(await values(0))})`);
await page.keyboard.type("Date fruit");
await cell(3, 0).focus(); // Banana
await page.keyboard.press("Shift+Alt+ArrowDown");
await page.waitForTimeout(400);
check(JSON.stringify(await values(0)) === JSON.stringify(["Date fruit", "Apple", "Cherry", "Banana", "Banana"]), `duplicated Banana (${JSON.stringify(await values(0))})`);
check((await cell(4, 1).inputValue()) === "7", "duplicate copies the other cells");

step("Esc removes a new row nobody filled in");
await cell(4, 0).focus();
await page.keyboard.press(`${mod}+ArrowDown`);
await page.waitForTimeout(400);
check((await rowCount()) === 6, "empty row inserted");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
check((await rowCount()) === 5, `Esc removed it (${await rowCount()})`);
await shot("gridkeys_keyboard", false);

step("paste a 3×3 block (no header) from the Qty column of row 4");
async function paste(row, col, text) {
  await cell(row, col).focus();
  await page.evaluate((txt) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", txt);
    document.activeElement.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
  await page.waitForTimeout(1200);
}
await paste(3, 1, "10\t2.25\t2026-12-01\n20\t3.5\t2026-12-02\n30\t4\t2026-12-03\n");
check((await rowCount()) === 6, `one row added for the overflow (${await rowCount()})`);
check(JSON.stringify(await values(1)) === JSON.stringify(["", "3", "", "10", "20", "30"]), `Qty filled down (${JSON.stringify(await values(1))})`);
check((await cell(4, 2).inputValue()).startsWith("3.5"), `Rate filled (${await cell(4, 2).inputValue()})`);
check((await cell(3, 0).inputValue()) === "Banana", "columns left of the paste untouched");
await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur: the pasted value must survive
await page.waitForTimeout(300);
check((await cell(3, 1).inputValue()) === "10", `pasted value survives the cell's blur (${await cell(3, 1).inputValue()})`);

step("paste with a header row maps by label / fieldname, any order");
await paste(0, 0, "Rate\tItem\tqty\n9\tElderberry\t1\n8\tFig\t2\n");
check(JSON.stringify((await values(0)).slice(0, 2)) === JSON.stringify(["Elderberry", "Fig"]), `Item by header (${JSON.stringify(await values(0))})`);
check((await cell(0, 1).inputValue()) === "1" && (await cell(1, 1).inputValue()) === "2", "qty by fieldname");
check((await cell(0, 2).inputValue()).startsWith("9"), `Rate by label (${await cell(0, 2).inputValue()})`);
check((await rowCount()) === 6, "no rows added when the block fits");

step("a single value pastes into the cell as usual");
await cell(2, 0).fill("");
await cell(2, 0).focus();
await page.keyboard.insertText("Grape"); // a one-cell paste is native text input
check((await cell(2, 0).inputValue()) === "Grape", "single value typed into the cell");
await shot("gridkeys_paste", false);

step("save → rows in the database");
await page.keyboard.press(`${mod}+s`);
await page.waitForURL(new RegExp(`${slug(PARENT)}/(?!new)`), { timeout: 30000 });
const name = decodeURIComponent(page.url().split("/").pop());
const doc = (await api(`api/resource/${encodeURIComponent(PARENT)}/${name}`)).data;
const saved = (doc?.lines ?? []).map((l) => [l.item, l.qty, l.rate, l.due]);
console.log("  saved:", JSON.stringify(saved));
check(saved.length === 6, `6 rows saved (${saved.length})`);
check(JSON.stringify(saved[0]) === JSON.stringify(["Elderberry", 1, 9, null]), "row 1");
check(saved[2][0] === "Grape" && saved[3][1] === 10 && saved[3][3] === "2026-12-01", "pasted row 4: qty 10, due 2026-12-01");
check(saved[5][1] === 30 && saved[5][2] === 4 && saved[5][3] === "2026-12-03", "pasted overflow row 6");
check(JSON.stringify(doc.lines.map((l) => l.idx)) === "[1,2,3,4,5,6]", "idx 1..6");

step("row menu (⋯): Insert Below, Duplicate, Move Down, Delete");
const rowMenu = async (n, item) => {
  await page.locator(`[data-cell="${n - 1}:0"]`).hover();
  await page.getByRole("button", { name: `Row ${n} actions` }).click();
  await page.getByRole("menuitem", { name: item }).click();
  await page.waitForTimeout(400);
};
// rows now: Elderberry, Fig, Grape, Banana, Banana, (empty)
await rowMenu(1, "Insert Below");
check(JSON.stringify((await values(0)).slice(0, 3)) === JSON.stringify(["Elderberry", "", "Fig"]), `inserted below row 1 (${JSON.stringify(await values(0))})`);
check((await focusedCell()) === "1:0", `focus in the inserted row (${await focusedCell()})`);
await rowMenu(2, "Delete");
check(JSON.stringify((await values(0)).slice(0, 2)) === JSON.stringify(["Elderberry", "Fig"]), "deleted it");
await rowMenu(2, "Duplicate");
check(JSON.stringify((await values(0)).slice(0, 4)) === JSON.stringify(["Elderberry", "Fig", "Fig", "Grape"]), `duplicated Fig (${JSON.stringify(await values(0))})`);
await rowMenu(1, "Move Down");
check(JSON.stringify((await values(0)).slice(0, 2)) === JSON.stringify(["Fig", "Elderberry"]), `moved down (${JSON.stringify(await values(0))})`);
await page.locator('[data-cell="0:0"]').hover();
await page.getByRole("button", { name: "Row 1 actions" }).click();
check(!(await page.getByRole("menuitem", { name: "Move Up" }).isVisible()), "no Move Up on the first row");
await page.keyboard.press("Escape");
await shot("gridkeys_rowmenu", false);

step("cleanup");
await cleanup();
await t.finish();
