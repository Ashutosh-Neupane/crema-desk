// Grid: CSV upload (bulk edit), pagination over 50 rows, drag to reorder (saved idx), CSV download.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/grid.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const P = "Crema Grid Doc";
const C = "Crema Grid Row";
async function cleanup() {
  for (const d of (await post("frappe.client.get_list", { doctype: P, fields: ["name"] }).catch(() => [])) ?? []) await post("frappe.client.delete", { doctype: P, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: P });
  await post("frappe.client.delete", { doctype: "DocType", name: C });
}
await cleanup();
await post("frappe.client.insert", { doc: { doctype: "DocType", name: C, module: "Custom", custom: 1, istable: 1, fields: [
  { fieldname: "item", label: "Item", fieldtype: "Data", in_list_view: 1 },
  { fieldname: "qty", label: "Qty", fieldtype: "Int", in_list_view: 1 },
] } });
await post("frappe.client.insert", { doc: { doctype: "DocType", name: P, module: "Custom", custom: 1, autoname: "hash", fields: [
  { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
  { fieldname: "rows", label: "Rows", fieldtype: "Table", options: C, allow_bulk_edit: 1 },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });

const csv = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "crema-grid-")), "rows.csv");
fs.writeFileSync(csv, ["Item,Qty", ...Array.from({ length: 55 }, (_, i) => `"Row ${i + 1}, x",${i + 1}`)].join("\n"));

step("new doc: upload 55 rows from CSV");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(P)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${P}` }).waitFor({ timeout: 90000 });
await page.getByRole("textbox", { name: /^Title/ }).fill("Grid test");
await page.getByLabel("Upload rows to Rows").setInputFiles(csv);
await page.getByText("Page 1 of 2 · 55 rows").waitFor({ timeout: 30000 });
check(true, "55 rows added, paginated 50 per page");

step("drag row 2 above row 1");
const r1 = page.getByRole("button", { name: "Drag row 1", exact: true });
const r2 = page.getByRole("button", { name: "Drag row 2", exact: true });
await r2.hover();
const b2 = await r2.boundingBox();
const b1 = await page.getByRole("checkbox", { name: "Select row 1", exact: true }).boundingBox();
await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
await page.mouse.down();
await page.mouse.move(b2.x + b2.width / 2, b2.y - 6, { steps: 4 });
await page.mouse.move(b2.x + b2.width / 2, b1.y - 4, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(600);
void r1;

step("save → server order and values");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForURL(new RegExp(`${encodeURIComponent(P)}/(?!new)`), { timeout: 60000 });
const name = decodeURIComponent(page.url().split("/").pop());
const doc = await post("frappe.client.get", { doctype: P, name });
check(doc?.rows?.length === 55, `55 rows saved (${doc?.rows?.length})`);
check(doc?.rows?.[0]?.item === "Row 2, x" && doc?.rows?.[1]?.item === "Row 1, x", `drag order saved (${doc?.rows?.[0]?.item} / ${doc?.rows?.[1]?.item})`);
check(doc?.rows?.[54]?.qty === 55, "quoted CSV values and ints parsed");
await shot("grid_paginated", false);

step("page 2 + download");
await page.getByRole("navigation", { name: "Rows pages" }).getByRole("button", { name: "Next" }).click();
check(await page.getByText("Page 2 of 2 · 55 rows").isVisible(), "page 2 shown");
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.getByRole("button", { name: "Download", exact: true }).click()]);
const out = fs.readFileSync(await dl.path(), "utf8").trim().split("\n");
check(out[0].startsWith("Item,Qty") && out.length === 56, `CSV download (${out.length - 1} rows)`);

step("cleanup");
await cleanup();
await t.finish();
