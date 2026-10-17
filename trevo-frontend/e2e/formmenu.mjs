// Form menu: Rename (title + name), Links, Remind Me, Customize (route_options doc_type).
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/formmenu.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const DT = "Trevo Rename Doc";
async function cleanup() {
  for (const d of (await post("frappe.client.get_list", { doctype: "Reminder", filters: { reminder_doctype: DT }, fields: ["name"] })) ?? []) await post("frappe.client.delete", { doctype: "Reminder", name: d.name });
  for (const d of (await post("frappe.client.get_list", { doctype: DT, fields: ["name"] }).catch(() => [])) ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();
await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "prompt", allow_rename: 1, title_field: "title", show_title_field_in_link: 0,
    fields: [{ fieldname: "title", label: "Title", fieldtype: "Data" }],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
await post("frappe.client.insert", { doc: { doctype: DT, name: "OLD-1", title: "Old title" } });

step("click title → rename title and ID");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/OLD-1`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("button", { name: "Old title" }).click({ timeout: 90000 });
const dlg = page.getByRole("dialog");
await dlg.getByLabel("Title").fill("New title");
await dlg.getByLabel("New name").fill("NEW-1");
await dlg.getByRole("button", { name: "Rename" }).click();
await page.waitForURL(/\/NEW-1$/, { timeout: 30000 });
const d = await post("frappe.client.get_value", { doctype: DT, filters: { name: "NEW-1" }, fieldname: ["title"] });
check(d?.title === "New title", `renamed to NEW-1 with title "${d?.title}"`);

step("Remind Me");
await page.getByRole("button", { name: "More actions" }).click();
await page.getByRole("menuitem", { name: "Remind Me" }).click();
await page.getByRole("dialog").getByLabel("Note").fill("follow up");
await page.getByRole("dialog").getByRole("button", { name: "Set reminder" }).click();
await page.waitForTimeout(2000);
const rem = await post("frappe.client.get_list", { doctype: "Reminder", filters: { reminder_doctype: DT, reminder_docname: "NEW-1" }, fields: ["name", "description"] });
check(rem?.length === 1 && rem[0].description === "follow up", "Reminder created");

step("Links on a customer");
await page.goto(`${BASE}/desk/doctype/Customer/Everest%20Foods`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "More actions" }).click({ timeout: 90000 });
await page.getByRole("menuitem", { name: "Links" }).click();
await page.getByRole("dialog").getByText(/^Sales Order/).first().waitFor({ timeout: 30000 });
check(await page.getByRole("dialog").getByRole("link", { name: /SAL-ORD-2026-00003/ }).isVisible(), "linked Sales Orders listed");
await page.keyboard.press("Escape");

step("Customize opens Customize Form for this DocType");
await page.getByRole("button", { name: "More actions" }).click();
await page.getByRole("menuitem", { name: "Customize" }).click();
await page.waitForURL(/Customize%20Form/, { timeout: 30000 });
const dt = page.getByRole("combobox", { name: /^Enter Form Type/ }).first();
await page.waitForFunction(() => [...document.querySelectorAll("input")].some((i) => i.value === "Customer"), null, { timeout: 60000 }).catch(() => {});
check((await dt.inputValue()) === "Customer", `doc_type applied (${await dt.inputValue()})`);

step("cleanup");
await cleanup();
await t.finish();
