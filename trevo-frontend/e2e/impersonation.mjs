// Site banners + impersonation (Desk site_banners.js, user.js impersonate prompt, list_view.js menu items).
// Impersonate a new user → Trevo shows that user + "You are impersonating <user>." banner; Desk has no stop
// method, the impersonated session ends with Log out, then Administrator signs in again. ToDo list menu →
// User Permissions / Role Permissions Manager (System Manager only).
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/impersonation.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json();
const EMAIL = `trevo.imp.${Date.now() % 100000}@example.com`;
const main = page.locator("#main-content");
const ctxUser = async () => (await (await page.request.get(`${BASE}/api/desk/context`)).json());
const logout = async () => {
  for (let i = 0; i < 2; i++) {
    await page.getByLabel("User menu").click();
    const item = page.getByRole("menuitem", { name: "Log out" });
    if (await item.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
      await item.click();
      return;
    }
  }
};
const loginAdmin = async () => {
  await page.goto(`${BASE}/login`);
  await page.fill("input:not([type=password])", "Administrator");
  await page.fill("input[type=password]", "admin");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/desk/, { timeout: 120000 });
};
const cleanup = async () => {
  await post("frappe.client.delete", { doctype: "User", name: EMAIL });
};
try {
  await cleanup();
  await post("frappe.client.insert", { doc: { doctype: "User", email: EMAIL, first_name: "Imp", send_welcome_email: 0, roles: [{ role: "Sales User" }] } });

  step("no banner for Administrator");
  await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByLabel("List settings").waitFor({ timeout: 90000 });
  check((await ctxUser()).user === "Administrator", "session is Administrator");
  check(!(await page.getByTestId("site-banners").count()), "no site banner");

  step("ToDo list menu (System Manager)");
  await page.getByLabel("List settings").click();
  await page.getByRole("menuitem", { name: "User Permissions" }).click();
  await page.waitForURL(/\/desk\/doctype\/User%20Permission\?allow=ToDo/, { timeout: 30000 });
  check(true, "User Permissions → /desk/doctype/User%20Permission?allow=ToDo");
  await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByLabel("List settings").click();
  await page.getByRole("menuitem", { name: "Role Permissions Manager" }).click();
  await page.waitForURL(/\/desk\/page\/permission-manager\/ToDo/, { timeout: 30000 });
  check(true, "Role Permissions Manager → /desk/page/permission-manager/ToDo");

  step("Impersonate");
  await page.goto(`${BASE}/desk/doctype/User/${encodeURIComponent(EMAIL)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await main.getByRole("button", { name: "Impersonate", exact: true }).waitFor({ timeout: 90000 });
  await main.getByRole("button", { name: "Impersonate", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: `Impersonate as ${EMAIL}` });
  await dlg.waitFor({ timeout: 15000 });
  await dlg.getByLabel(/Reason for impersonating/).fill("e2e check");
  await Promise.all([page.waitForEvent("load", { timeout: 120000 }), dlg.getByRole("button", { name: "Confirm" }).click()]);
  await page.getByTestId("site-banners").waitFor({ timeout: 120000 });
  const c = await ctxUser();
  check(c.user === EMAIL, `desk context user is the impersonated user (${c.user})`);
  check(c.impersonated_by === "Administrator", `impersonated_by = ${c.impersonated_by}`);
  check((await page.getByTestId("site-banners").innerText()).includes(`You are impersonating ${EMAIL}.`), "banner: You are impersonating <user>.");
  await shot("impersonating", false);
  await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByLabel("List settings").waitFor({ timeout: 90000 });
  await page.getByLabel("List settings").click();
  check(!(await page.getByRole("menuitem", { name: "User Permissions" }).count()), "list menu hides User Permissions for a non-System Manager");
  await page.keyboard.press("Escape");

  step("End impersonation (Log out) and sign in as Administrator");
  await logout();
  await page.waitForURL(/\/login/, { timeout: 30000 });
  await loginAdmin();
  const a = await ctxUser();
  check(a.user === "Administrator" && !a.impersonated_by, "back to Administrator, not impersonated");
  await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByLabel("List settings").waitFor({ timeout: 90000 });
  check(!(await page.getByTestId("site-banners").count()), "banner gone");
} finally {
  // always leave the browser session as Administrator
  try {
    if ((await ctxUser()).user !== "Administrator") {
      await logout();
      await page.waitForURL(/\/login/, { timeout: 30000 });
      await loginAdmin();
    }
    await cleanup();
  } catch (e) {
    console.log("cleanup error:", e.message);
  }
}
await t.finish();
