// Saved desk theme seeds a new browser (User.desk_theme → data-theme) and the user menu's
// Toggle Full Width widens the content container and persists in localStorage.container_fullwidth.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/fullwidth.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
// wide viewport so the content cap (1290px) is below the available width
await page.setViewportSize({ width: 1920, height: 1000 });
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const SWITCH_THEME = "frappe.core.doctype.user.user.switch_theme";
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
const width = () => page.locator("#main-container").evaluate((el) => Math.round(el.getBoundingClientRect().width));
const fullFlag = () => page.evaluate(() => localStorage.getItem("container_fullwidth"));

try {
  step("saved desk theme applies to a browser with no stored choice");
  await post(SWITCH_THEME, { theme: "Dark" });
  await page.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.evaluate(() => localStorage.removeItem("trevo-ui"));
  await page.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByLabel("User menu").waitFor({ timeout: 60000 });
  const dark = await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark", null, { timeout: 30000 }).then(() => true, () => false);
  check(dark, 'data-theme="dark" on <html> from User.desk_theme = Dark');
  await page.waitForTimeout(500);
  check(await page.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark"), "theme still dark after the seed settles");
  await shot("fullwidth_dark", false);

  step("Toggle Full Width (user menu)");
  await page.evaluate(() => localStorage.removeItem("container_fullwidth"));
  await page.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded" });
  await page.locator("#main-container").waitFor({ timeout: 60000 });
  await openMenu();
  check(await page.getByRole("menuitem", { name: "Toggle Full Width", exact: true }).isVisible(), "Toggle Full Width in the menu");
  const before = await width();
  await page.getByRole("menuitem", { name: "Toggle Full Width", exact: true }).click();
  await page.waitForTimeout(500);
  const after = await width();
  check((await page.locator("#main-container").getAttribute("data-fullwidth")) === "true", "container switched to full width");
  check(after > before, `content width grows (${before}px → ${after}px)`);
  check((await fullFlag()) === "true", "localStorage.container_fullwidth = true");
  await shot("fullwidth_on", false);

  step("full width persists across reload");
  await page.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded" });
  await page.locator("#main-container").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.getElementById("main-container")?.dataset.fullwidth === "true", null, { timeout: 20000 }).then(() => check(true, "still full width after reload"), () => check(false, "still full width after reload"));
  check((await width()) === after, `same width after reload (${after}px)`);

  step("toggling again restores the capped width");
  await openMenu();
  await page.getByRole("menuitem", { name: "Toggle Full Width", exact: true }).click();
  await page.waitForTimeout(500);
  check((await width()) === before, `width back to ${before}px`);
  check((await fullFlag()) === "false", "localStorage.container_fullwidth = false");
  await page.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded" });
  await page.locator("#main-container").waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  check((await page.locator("#main-container").getAttribute("data-fullwidth")) === "false", "capped after reload");
} finally {
  step("restore");
  await post(SWITCH_THEME, { theme: originalTheme });
  await page.evaluate(() => {
    localStorage.removeItem("trevo-ui");
    localStorage.removeItem("container_fullwidth");
  });
  await t.finish();
}
