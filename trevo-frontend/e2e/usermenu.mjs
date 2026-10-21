// User menu (Desk v16 sidebar_header.js + Navbar Settings rows): standard items, Help rows with conditions,
// About, Session Defaults (saved on the server), theme saved to User.desk_theme, and Desk URLs (slugs,
// workspaces, shells, standard routes) resolved like Desk's router.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/usermenu.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const SD = "frappe.core.doctype.session_default_settings.session_default_settings";
const sessionDefaults = async () => JSON.parse((await post(`${SD}.get_session_default_values`)) ?? "[]");
const company = (await post("frappe.client.get_list", { doctype: "Company", fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
const original = (await sessionDefaults()).find((f) => f.fieldname === "company")?.default ?? "";
const originalTheme = (await post("frappe.client.get_value", { doctype: "User", filters: "Administrator", fieldname: "desk_theme" }))?.desk_theme ?? "Light";
const openMenu = async () => {
  await page.getByRole("button", { name: "User menu" }).click().catch(() => page.getByLabel("User menu").click());
  await page.getByRole("menuitem", { name: "Log out" }).waitFor({ timeout: 10000 });
};

step("menu items");
await page.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded", timeout: 180000 });
await openMenu();
// site rows (Navbar Settings) arrive with the shell settings, shortly after the page
await page.getByRole("menuitem", { name: "About", exact: true }).waitFor({ timeout: 20000 });
for (const item of ["My Settings", "Session Defaults", "Reload", "View Website", "Apps", "About", "System Health", "Log out"]) {
  check(await page.getByRole("menuitem", { name: item, exact: true }).isVisible(), `${item} in the menu`);
}
check(!(await page.getByRole("menuitem", { name: "Delete Demo Data" }).count()), "row hidden by its condition (no demo company)");
check((await page.getByRole("menuitem", { name: "About", exact: true }).count()) === 1, "About listed once");
await shot("user_menu", false);

step("About (Navbar Settings action → frappe.ui.toolbar.show_about)");
await page.getByRole("menuitem", { name: "About", exact: true }).click();
const about = page.getByRole("dialog", { name: "About" });
await about.getByText(/Frappe Framework/).waitFor({ timeout: 20000 });
check(await about.getByText(/ERPNext/).isVisible(), "installed apps with versions");
await page.keyboard.press("Escape");

step("Help route → Desk URL resolved");
await openMenu();
await page.getByRole("menuitem", { name: "System Health", exact: true }).click();
await page.waitForURL(/\/desk\/doctype\/System%20Health%20Report\/System%20Health%20Report/, { timeout: 60000 });
check(true, "/desk/system-health-report → the System Health Report single");

step("My Settings");
await openMenu();
await page.getByRole("menuitem", { name: "My Settings" }).click();
await page.waitForURL(/\/desk\/doctype\/User\/Administrator/, { timeout: 60000 });
check(true, "opens the user's own User form");

step("Session Defaults");
await post(`${SD}.set_session_default_values`, { default_values: { company: "" } });
await page.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded" });
await openMenu();
await page.getByRole("menuitem", { name: "Session Defaults" }).click();
const sd = page.getByRole("dialog", { name: "Session Defaults" });
const field = sd.getByLabel("Default Company");
await field.waitFor({ timeout: 20000 });
check((await field.inputValue()) === "", "loads the current (cleared) default");
check(await sd.getByRole("link", { name: "Configure" }).isVisible(), "Configure link for System Manager");
await field.fill(company);
await page.getByRole("option", { name: company }).first().click();
await sd.getByRole("button", { name: "Save" }).click();
await page.waitForLoadState("load");
await page.waitForTimeout(1500);
check((await sessionDefaults()).find((f) => f.fieldname === "company")?.default === company, `company default saved (${company})`);

step("theme saved on the user");
await page.getByRole("button", { name: "Theme" }).click().catch(() => page.getByLabel("Theme").click());
await page.getByRole("button", { name: "Dark" }).click();
await page.waitForTimeout(1500);
check((await post("frappe.client.get_value", { doctype: "User", filters: "Administrator", fieldname: "desk_theme" }))?.desk_theme === "Dark", "User.desk_theme = Dark");
check(await page.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark"), "dark theme applied");

step("Desk URLs resolved like Desk's router");
const cases = [
  ["/desk/sales-invoice/new", /\/desk\/doctype\/Sales%20Invoice\/new$/],
  ["/desk/user/view/report", /\/desk\/doctype\/User\/view\/report$/],
  ["/desk/user/Administrator", /\/desk\/doctype\/User\/Administrator$/],
  ["/desk/buying", /\/desk\/workspace\/Buying$/],
  ["/desk/stock/item", /\/desk\/doctype\/Item$/],
  ["/desk/List/User", /\/desk\/doctype\/User$/],
  ["/desk/permission-manager/ToDo", /\/desk\/page\/permission-manager\/ToDo$/],
  ["/desk/todo?status=Open", /\/desk\/doctype\/ToDo\?status=Open$/],
];
for (const [from, to] of cases) {
  await page.goto(`${BASE}${from}`, { waitUntil: "domcontentloaded" });
  const ok = await page.waitForURL(to, { timeout: 60000 }).then(() => true, () => false);
  check(ok, `${from} → ${ok ? new URL(page.url()).pathname + new URL(page.url()).search : page.url()}`);
}

step("restore");
await post(`${SD}.set_session_default_values`, { default_values: { company: original } });
await post("frappe.core.doctype.user.user.switch_theme", { theme: originalTheme });
await page.evaluate(() => localStorage.removeItem("trevo-ui"));
await t.finish();
