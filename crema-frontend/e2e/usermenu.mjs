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
  const logout = page.getByRole("menuitem", { name: "Log out" });
  // the shell can still be hydrating right after a navigation: click again if the menu didn't open
  for (let i = 0; i < 2; i++) {
    await page.getByLabel("User menu").click();
    if (await logout.waitFor({ timeout: 15000 }).then(() => true, () => false)) return;
  }
  await logout.waitFor({ timeout: 5000 });
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
await page.waitForURL(/\/desk\/system-health-report\/System%20Health%20Report/, { timeout: 60000 });
check(true, "/desk/system-health-report → the System Health Report single");

step("My Settings");
await openMenu();
await page.getByRole("menuitem", { name: "My Settings" }).click();
await page.waitForURL(/\/desk\/user\/Administrator/, { timeout: 60000 });
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

step("Desk URLs open in place (Desk's router, served by proxy.ts)");
const cases = [
  ["/desk/sales-invoice/new", "New Sales Invoice"],
  ["/desk/user/view/report", "User"],
  ["/desk/user/Administrator", "Administrator"],
  ["/desk/buying", "Buying"],
  ["/desk/stock/item", "Item"],
  ["/desk/todo?status=Open", "ToDo"],
];
for (const [url, title] of cases) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  const ok = await page
    .waitForFunction((t) => document.title.includes(t) || [...document.querySelectorAll("h1, h2")].some((h) => h.textContent?.includes(t)), title, { timeout: 60000 })
    .then(() => true, () => false);
  const now = new URL(page.url());
  check(ok && `${now.pathname}${now.search}`.startsWith(url.split("?")[0]), `${url} → "${await page.title()}" at ${now.pathname}${now.search}`);
}

step("restore");
await post(`${SD}.set_session_default_values`, { default_values: { company: original } });
await post("frappe.core.doctype.user.user.switch_theme", { theme: originalTheme });
await page.evaluate(() => localStorage.removeItem("crema-ui"));
await t.finish();
