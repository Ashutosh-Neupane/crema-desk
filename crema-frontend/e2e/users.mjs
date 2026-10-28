// User + roles: create a user in the form, assign roles and block a module with the native
// RoleEditor / ModuleEditor (Desk's jQuery widgets), save → Has Role / Block Module rows on the server.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/users.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const EMAIL = `crema.user.${Date.now() % 100000}@example.com`;
const PROFILE = `Crema E2E Profile ${Date.now() % 100000}`;
await post("frappe.client.delete", { doctype: "Role Profile", name: PROFILE });

step("create the user in the form");
await page.goto(`${BASE}/desk/doctype/User/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: "New User" }).waitFor({ timeout: 90000 });
await page.getByRole("textbox", { name: /^Email/ }).first().fill(EMAIL);
await page.getByRole("textbox", { name: /^First Name/ }).first().fill("Crema Tester");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForURL(new RegExp(`/User/${encodeURIComponent(EMAIL).replace(/\./g, "\\.")}`), { timeout: 60000 });
check(true, `user ${EMAIL} created`);

step("roles + modules editors");
await page.getByRole("tab", { name: /Roles/ }).first().click();
const roles = page.getByRole("group", { name: "Roles" });
await roles.waitFor({ timeout: 60000 });
await roles.getByLabel("Filter roles").fill("Sales User");
await roles.getByRole("checkbox", { name: "Sales User", exact: true }).check();
await roles.getByLabel("Filter roles").fill("Stock User");
await roles.getByRole("checkbox", { name: "Stock User", exact: true }).check();
const modules = page.getByRole("group", { name: "Modules" });
await modules.getByLabel("Filter modules").fill("Assets");
await modules.getByRole("checkbox", { name: "Assets", exact: true }).uncheck();
await shot("user_roles", false);
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForTimeout(3000);
const u = await post("frappe.client.get", { doctype: "User", name: EMAIL });
const r = (u?.roles ?? []).map((x) => x.role);
check(r.includes("Sales User") && r.includes("Stock User"), `roles saved (${r.join(", ")})`);
check((u?.block_modules ?? []).some((x) => x.module === "Assets"), "Assets module blocked");
check(u?.user_type === "System User", `user type ${u?.user_type}`);

step("unassign a role");
await roles.getByLabel("Filter roles").fill("Stock User");
await roles.getByRole("checkbox", { name: "Stock User", exact: true }).uncheck();
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForTimeout(3000);
const u2 = await post("frappe.client.get", { doctype: "User", name: EMAIL });
check(!(u2?.roles ?? []).some((x) => x.role === "Stock User"), "Stock User removed");

step("Role Profile with the same editor");
await page.goto(`${BASE}/desk/doctype/Role%20Profile/new`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "New Role Profile" }).waitFor({ timeout: 90000 });
await page.getByRole("textbox", { name: /^Role Name/ }).first().fill(PROFILE);
const pr = page.getByRole("group", { name: "Roles" });
await pr.getByLabel("Filter roles").fill("Accounts User");
await pr.getByRole("checkbox", { name: "Accounts User", exact: true }).check();
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForTimeout(3000);
const p = await post("frappe.client.get", { doctype: "Role Profile", name: PROFILE });
check((p?.roles ?? []).some((x) => x.role === "Accounts User"), "Role Profile saved with its role");

step("cleanup");
await post("frappe.client.delete", { doctype: "User", name: EMAIL });
await post("frappe.client.delete", { doctype: "Role Profile", name: PROFILE });
await t.finish();
