// User form actions from Frappe's own user.js, running in Trevo's runtime: Permissions ▾ (Set User Permissions,
// View Permitted Documents, View Doctype Permissions), Password ▾ (Change Password, Reset Password), Impersonate
// prompt, Generate Keys (a Button field → form event) — each checked by URL or on the server.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/useractions.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, browser, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const EMAIL = `trevo.actions.${Date.now() % 100000}@example.com`;
const NEW_PASS = `Tv-${Date.now().toString(36)}-x9Q!`;
await post("frappe.client.insert", { doc: { doctype: "User", email: EMAIL, first_name: "Actions", send_welcome_email: 0, roles: [{ role: "Sales User" }] } });
const main = page.locator("#main-content");
const FORM = `${BASE}/desk/doctype/User/${encodeURIComponent(EMAIL)}`;
const openForm = async () => {
  await page.goto(FORM, { waitUntil: "domcontentloaded", timeout: 180000 });
  await main.getByRole("button", { name: "Password", exact: true }).waitFor({ timeout: 90000 });
};
const menu = async (group, item) => {
  await main.getByRole("button", { name: group, exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
};

step("custom buttons from user.js");
await openForm();
for (const b of ["Permissions", "Password", "Impersonate"]) check(await main.getByRole("button", { name: b, exact: true }).isVisible(), `${b} button`);
await shot("user_actions");

step("Permissions ▾");
await menu("Permissions", "Set User Permissions");
await page.waitForURL(/\/desk\/doctype\/User%20Permission\?user=/, { timeout: 30000 });
check(decodeURIComponent(page.url()).endsWith(`user=${EMAIL}`), "Set User Permissions → User Permission list filtered by user");
await openForm();
await menu("Permissions", "View Permitted Documents");
await page.waitForURL(/\/desk\/query-report\/Permitted%20Documents%20For%20User\?user=/, { timeout: 30000 });
check(true, "View Permitted Documents → report with user filter");
await openForm();
await menu("Permissions", "View Doctype Permissions");
await page.waitForURL(/\/desk\/query-report\/User%20Doctype%20Permissions\?user=/, { timeout: 30000 });
check(true, "View Doctype Permissions → report with user filter");

step("Password ▾ Change Password");
await openForm();
await menu("Password", "Change Password");
const dlg = page.getByRole("dialog", { name: "Change Password" });
await dlg.waitFor({ timeout: 15000 });
await dlg.getByLabel(/Set New Password/).fill(NEW_PASS);
await dlg.getByRole("button", { name: "Change Password" }).click();
await dlg.waitFor({ state: "detached", timeout: 20000 });
const ctx = await browser.newContext();
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/login`);
await p2.fill("input:not([type=password])", EMAIL);
await p2.fill("input[type=password]", NEW_PASS);
await p2.click("button[type=submit]");
const loggedIn = await p2.waitForURL(/\/desk/, { timeout: 60000 }).then(() => true, () => false);
check(loggedIn, "new password logs in through Trevo's login page");
await ctx.close();

step("Password ▾ Reset Password");
const reset = page.waitForResponse((r) => r.url().includes("frappe.core.doctype.user.user.reset_password"), { timeout: 20000 });
await menu("Password", "Reset Password");
const rr = await reset;
check(rr.ok(), `reset_password called (${rr.status()})`);

step("Impersonate prompt");
await main.getByRole("button", { name: "Impersonate", exact: true }).click();
const imp = page.getByRole("dialog", { name: `Impersonate as ${EMAIL}` });
await imp.waitFor({ timeout: 15000 });
check(await imp.getByLabel(/Reason for impersonating/).isVisible(), "prompt asks for a reason");
await page.keyboard.press("Escape");

step("Generate Keys (Button field)");
await page.getByRole("tab", { name: "Settings" }).click();
await main.getByRole("button", { name: "API Access" }).click();
await page.getByRole("button", { name: "Generate Keys" }).click();
const keys = page.getByRole("dialog", { name: "API Keys" });
await keys.waitFor({ timeout: 20000 });
const apiKey = (await post("frappe.client.get_value", { doctype: "User", filters: { name: EMAIL }, fieldname: "api_key" }))?.api_key;
check(!!apiKey, "api_key generated on the server");
check(await keys.getByText(/won't be displayed again/).isVisible(), "secret warning shown (dialog.show_message)");
await shot("user_api_keys");
await page.keyboard.press("Escape");

step("cleanup");
await post("frappe.client.delete", { doctype: "User", name: EMAIL });
await t.finish();
