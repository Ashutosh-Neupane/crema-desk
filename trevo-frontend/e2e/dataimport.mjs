// Data export (list menu → download_template) and Data Import wizard (upload → preview →
// background import → status/log), verified on the backend.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/dataimport.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const tag = `Trevo Imp ${Date.now() % 100000}`;
const names = [`${tag} A`, `${tag} B`];

step("Export from the Sales Order list");
await page.goto(`${BASE}/desk/doctype/Sales%20Order`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.locator("tbody tr").first().waitFor({ timeout: 60000 });
await page.getByRole("button", { name: "List settings" }).click();
await page.getByRole("menuitem", { name: "Export" }).click();
const dlg = page.getByRole("dialog");
await dlg.getByRole("checkbox", { name: "Customer", exact: true }).first().waitFor({ timeout: 30000 });
const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), dlg.getByRole("button", { name: "Export" }).click()]);
const file = path.join(os.tmpdir(), `trevo-export-${Date.now()}.csv`);
await download.saveAs(file);
const csv = fs.readFileSync(file, "utf8");
check(download.suggestedFilename().endsWith(".csv"), `downloaded ${download.suggestedFilename()}`);
check(/"ID"/.test(csv.split("\n")[0]) && csv.includes("SAL-ORD-"), `CSV has header + orders (${csv.split("\n").length - 1} lines)`);

step("Import two Customers");
const src = path.join(os.tmpdir(), `trevo-import-${Date.now()}.csv`);
fs.writeFileSync(src, `Customer Name,Customer Type\n"${names[0]}",Company\n"${names[1]}",Individual\n`);
await page.goto(`${BASE}/desk/data-import?doctype=Customer`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: "Import data" }).waitFor({ timeout: 60000 });
await page.getByLabel("Import file").setInputFiles(src);
await page.getByRole("button", { name: "Preview" }).click();
const table = page.getByRole("table", { name: "Import preview" });
await table.waitFor({ timeout: 60000 });
check(await table.getByText(names[0]).isVisible(), "preview shows rows");
check(await table.getByText("→ Customer Name").isVisible(), "column mapped to field");
await page.getByRole("button", { name: "Start Import" }).click();
await page.getByText(/Import status: Success/).waitFor({ timeout: 90000 });
check(true, "import finished with Success");
await shot("dataimport_done");
for (const n of names) {
  const r = await post("frappe.client.get_value", { doctype: "Customer", filters: { name: n }, fieldname: ["customer_type"] });
  const v = (await r.json()).message;
  check(!!v?.customer_type, `${n} exists (${v?.customer_type})`);
}

step("cleanup");
for (const n of names) await post("frappe.client.delete", { doctype: "Customer", name: n });
const di = await post("frappe.client.get_list", { doctype: "Data Import", filters: { reference_doctype: "Customer" }, fields: ["name"], order_by: "creation desc", limit_page_length: 1 });
for (const d of (await di.json()).message ?? []) await post("frappe.client.delete", { doctype: "Data Import", name: d.name });
await t.finish();
