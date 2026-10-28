// Role Permissions Manager (native rebuild of Desk's permission-manager page): add a rule, tick rights,
// Only if Creator, filter by role, users of a role, remove, restore originals — each verified via the API.
// Also frappe.set_route from a Client Script: Desk page routes and route_options.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/permissions.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const PM = "frappe.core.page.permission_manager.permission_manager";
const DT = "Crema Perm Test";
const CS = "Crema Perm Test CS";
const ROLE = "Accounts User";
const rules = async () => (await post(`${PM}.get_permissions`, { doctype: DT })) ?? [];
const rule = async (role) => (await rules()).find((r) => r.role === role && !r.permlevel);
async function cleanup() {
  await post("frappe.client.delete", { doctype: "Client Script", name: CS });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
  // Custom DocPerm rows outlive a deleted DocType
  for (const d of (await post("frappe.client.get_list", { doctype: "Custom DocPerm", filters: { parent: DT }, fields: ["name"], limit_page_length: 0 })) ?? []) await post("frappe.client.delete", { doctype: "Custom DocPerm", name: d.name });
}
await cleanup();
await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", fields: [
  { fieldname: "qty", label: "Qty", fieldtype: "Int", in_standard_filter: 1 },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });

step("open with a doctype in the route");
await page.goto(`${BASE}/desk/page/permission-manager/${encodeURIComponent(DT)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: "Role Permissions Manager" }).waitFor({ timeout: 90000 });
const table = page.getByRole("table", { name: "Permission rules" });
await table.waitFor({ timeout: 30000 });
check(await table.getByRole("row", { name: `${DT} System Manager level 0` }).isVisible(), "System Manager rule listed");
check(await page.getByRole("combobox", { name: "Document Type" }).inputValue() === DT, "Document Type picker shows the route doctype");
await shot("perm_manager");

step("add a new rule");
await page.getByRole("button", { name: "Add A New Rule" }).click();
const dlg = page.getByRole("dialog");
check(await dlg.getByLabel("Document Type").isDisabled(), "doctype fixed to the selected one");
await dlg.getByLabel("Role").selectOption(ROLE);
await dlg.getByRole("button", { name: "Add", exact: true }).click();
const row = table.getByRole("row", { name: `${DT} ${ROLE} level 0` });
await row.waitFor({ timeout: 20000 });
check(!!(await rule(ROLE)), `${ROLE} rule saved`);

step("tick rights");
const rights = row.getByRole("group", { name: `${ROLE} rights` });
check(!(await rights.getByLabel("Submit").count()), "no Submit for a non-submittable doctype");
await rights.getByLabel("Read", { exact: true }).check();
await page.waitForTimeout(800);
await rights.getByLabel("Write", { exact: true }).check();
await page.waitForTimeout(800);
await rights.getByLabel("Report", { exact: true }).check();
await page.waitForTimeout(1200);
let r = await rule(ROLE);
check(r?.read === 1 && r?.write === 1 && r?.report === 1, "read + write + report saved");

step("only if creator hides Report");
await row.getByLabel("Only if Creator").check();
await page.waitForTimeout(1500);
r = await rule(ROLE);
check(r?.if_owner === 1 && !r?.report, "if_owner set, report cleared on the server");
check(!(await rights.getByLabel("Report", { exact: true }).count()), "Report checkbox hidden");

step("untick a right");
await rights.getByLabel("Write", { exact: true }).uncheck();
await page.waitForTimeout(1500);
check(!(await rule(ROLE))?.write, "write cleared");

step("users with a role");
await row.getByRole("button", { name: ROLE, exact: true }).click();
await page.getByRole("dialog").getByText(/with the role|No user has the role/).waitFor({ timeout: 15000 });
check(true, "users dialog");
await page.keyboard.press("Escape");

step("filter by role");
await page.goto(`${BASE}/desk/page/permission-manager/${encodeURIComponent(DT)}?role=${encodeURIComponent(ROLE)}`, { waitUntil: "domcontentloaded" });
await table.waitFor({ timeout: 30000 });
check((await table.getByRole("row").count()) === 2, "only the role's rule shown (header + 1)");

step("remove the rule");
await table.getByRole("button", { name: `Remove ${ROLE} level 0` }).click();
await page.getByText("No Permissions set for this criteria.").waitFor({ timeout: 20000 });
check(!(await rule(ROLE)), "rule removed on the server");

step("restore original permissions");
await page.goto(`${BASE}/desk/page/permission-manager/${encodeURIComponent(DT)}`, { waitUntil: "domcontentloaded" });
await table.waitFor({ timeout: 30000 });
await table.getByRole("row", { name: `${DT} System Manager level 0` }).getByRole("group").getByLabel("Delete", { exact: true }).uncheck();
await page.waitForTimeout(1500);
check(!(await rule("System Manager"))?.delete, "System Manager delete cleared (custom perms)");
await page.getByRole("button", { name: "Restore Original Permissions" }).click();
const rd = page.getByRole("dialog");
await rd.getByText("System Manager").waitFor({ timeout: 15000 });
check(await rd.getByText(/Read, Write, Create, Delete/).isVisible(), "standard permissions listed");
await rd.getByRole("button", { name: "Reset" }).click();
await rd.waitFor({ state: "detached", timeout: 15000 });
await page.waitForTimeout(1000);
check((await rule("System Manager"))?.delete === 1, "delete restored after reset");

step("frappe.set_route from a script");
await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: DT, view: "Form", enabled: 1, script: `
frappe.ui.form.on("${DT}", {
  refresh(frm) {
    frm.add_custom_button("Open Permissions", () => frappe.set_route("permission-manager", frm.doctype));
    frm.add_custom_button("Qty 5 List", () => { frappe.route_options = { qty: 5 }; frappe.set_route("List", frm.doctype); });
  },
});` } });
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Open Permissions" }).click({ timeout: 60000 });
await page.waitForURL(/\/desk\/page\/permission-manager\/Crema/, { timeout: 30000 });
check(true, "set_route(page, doctype) → native Permission Manager");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Qty 5 List" }).click({ timeout: 60000 });
await page.waitForURL(/\/desk\/doctype\/Crema%20Perm%20Test\?qty=5$/, { timeout: 30000 });
check(true, "route_options → list filter in the URL");

step("cleanup");
await cleanup();
await t.finish();
