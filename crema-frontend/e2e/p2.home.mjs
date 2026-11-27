// Phase 2 dynamic home (docs/PHASE2_DESIGN.md § 4.1), New layout on: cards come from permissions and usage, Needs you
// first, nothing outside the user's can_read; filter, pin / hide / restore / reset saved in user_settings
// "Crema Home"; a stock-only user gets a different home; the switch off keeps the classic apps grid. Screenshots at
// 390 / 1280 / 1920 / 2560. Creates a test user and removes it at the end.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/p2.home.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, browser, check, step, shot, api } = t;
const post = (method, data, p = page) => p.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const stamp = Date.now().toString(36);
const STOCK_USER = `crema-home-${stamp}@example.com`;
const STOCK_PASS = `Crema-${stamp}-Home!9`;

const setLayout = async (on, p = page, user = "Administrator") => {
  await post("frappe.model.utils.user_settings.save", { doctype: "Crema UI", user_settings: JSON.stringify({ newLayout: on, density: "comfortable" }) }, p);
  await p.evaluate(([u, v]) => localStorage.setItem(`crema:ui-prefs:${u}`, JSON.stringify({ newLayout: v, density: "comfortable" })), [user, on]);
  await p.context().addCookies([{ name: "crema_ui", value: `${encodeURIComponent(user)}~${on ? 1 : 0}~r`, url: BASE }]);
};
const resetHome = (p = page) => post("frappe.model.utils.user_settings.save", { doctype: "Crema Home", user_settings: JSON.stringify({ pinned: [], hidden: [] }) }, p);

async function openHome(p = page) {
  await p.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.getByTestId("dynamic-home").waitFor({ timeout: 90000 });
  await p.getByRole("list", { name: "Home cards" }).waitFor({ timeout: 60000 });
  // let the late cards (KPIs, status counts, charts) arrive and the order settle
  await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(800);
}
const showAll = async (p = page) => {
  const more = p.getByRole("button", { name: /^Show more/ });
  if (await more.isVisible().catch(() => false)) await more.click();
};
const cardIds = (p = page) => p.locator('[aria-label="Home cards"] > li[data-card]').evaluateAll((els) => els.map((e) => e.getAttribute("data-card")));

async function cleanup() {
  await post("frappe.client.delete", { doctype: "User", name: STOCK_USER }).catch(() => {});
  await resetHome().catch(() => {});
  await setLayout(false).catch(() => {});
}

try {
  step("New layout: /desk is the dynamic home");
  await setLayout(true);
  await resetHome();
  await openHome();
  const ids = await cardIds();
  check(ids[0] === "needs-you", `Needs you is the first card (${ids.slice(0, 6).join(", ")})`);
  check(ids.includes("quick-create"), "Quick create shown (the user can create documents)");
  check(!(await page.getByText("Framework", { exact: true }).isVisible().catch(() => false)), "apps grid folded into All workspaces");
  const ctx = await (await page.request.get(`${BASE}/api/desk/context`)).json();
  const canRead = new Set(ctx.perms?.can_read ?? []);
  const canCreate = new Set(ctx.perms?.can_create ?? []);
  const qc = await page.getByRole("list", { name: "Quick create" }).getByRole("link").allInnerTexts();
  check(qc.length > 0 && qc.every((d) => canCreate.has(d.trim())), `Quick create only offers creatable DocTypes (${qc.join(", ")})`);
  await shot("p2-home-1280-admin");

  step("usage: a record opened in Crema shows under Recent");
  const so = (await api(`api/resource/Sales%20Order?limit_page_length=1&fields=["name"]&order_by=modified%20desc`))?.data?.[0]?.name;
  if (so && canRead.has("Sales Order")) {
    await page.goto(`${BASE}/desk/sales-order/${encodeURIComponent(so)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 90000 });
    await page.waitForTimeout(1500);
    await openHome();
    await showAll();
    const recent = page.locator('[data-card="recent"]');
    check(await recent.getByRole("link", { name: new RegExp(so) }).first().isVisible().catch(() => false), `${so} listed under Recent`);
  } else check(true, "no Sales Order to open (skipped)");

  step("filter this page");
  await showAll();
  const all = await cardIds();
  const filter = page.getByRole("searchbox", { name: "Filter this page" });
  await filter.fill("zzz-no-card-matches");
  check(await page.getByText("Nothing on this page matches").isVisible(), "no match: says so, with Clear filter");
  await page.getByRole("button", { name: "Clear filter" }).click();
  check((await cardIds()).length === all.length, "all cards back after clearing");
  if (qc[0]) {
    await filter.fill(qc[0]);
    const kept = await cardIds();
    check(kept.includes("quick-create") && kept.length < all.length, `"${qc[0]}" keeps the cards that mention it (${kept.length} of ${all.length}: ${kept.join(", ")})`);
    await filter.fill("");
  }

  step("edit: hide, restore, pin, reset (saved per user)");
  await page.getByRole("button", { name: "Edit" }).click();
  const victim = (await cardIds()).find((id) => id !== "needs-you");
  const title = await page.locator(`[data-card="${victim}"] h2, [data-card="${victim}"] h3`).first().innerText();
  const saved = page.waitForResponse((r) => r.url().includes("user_settings.save"));
  await page.getByRole("button", { name: `Hide ${title}` }).click();
  await saved;
  check(!(await cardIds()).includes(victim), `${victim} hidden`);
  await openHome();
  check(!(await cardIds()).includes(victim), "still hidden after reload (user_settings)");
  await page.getByText(/Hidden cards \(\d+\)/).click();
  await page.getByRole("button", { name: `Show ${title}` }).click();
  await page.waitForTimeout(500);
  check((await cardIds()).includes(victim), "restored from Hidden cards");
  await page.getByRole("button", { name: "Edit" }).click();
  const last = (await cardIds()).at(-1);
  const lastTitle = await page.locator(`[data-card="${last}"] h2, [data-card="${last}"] h3`).first().innerText();
  await page.getByRole("button", { name: `Pin ${lastTitle}` }).click();
  await page.waitForTimeout(500);
  check((await cardIds())[1] === last, `pinned ${last} moves right after Needs you`);
  await shot("p2-home-1280-edit");
  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForTimeout(500);
  check((await cardIds())[1] !== last || ids[1] === last, "Reset returns to the learned order");
  await page.getByRole("button", { name: "Done" }).click();

  step("no empty chart cards");
  await showAll();
  const emptyCharts = await page.locator('[data-card^="chart:"]:visible').filter({ hasText: "No data for this period" }).count();
  check(emptyCharts === 0, "charts without data are left out");

  step("accessibility");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600); // the Edit button's colours transition back after Done
  await t.axeCheck("home", '[data-testid="dynamic-home"]');

  step("screenshots at 390 / 1920 / 2560");
  for (const [w, h] of [[390, 844], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width: w, height: h });
    await openHome();
    await shot(`p2-home-${w}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  step("a stock-only user gets a different home, and nothing they can't read");
  let r = await post("frappe.client.insert", {
    doc: { doctype: "User", email: STOCK_USER, first_name: "Crema", last_name: "Stock", send_welcome_email: 0, new_password: STOCK_PASS, roles: [{ role: "Stock User" }, { role: "Stock Manager" }] },
  });
  check(r.ok(), `test user created (${r.status()})`);
  const other = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await other.goto(`${BASE}/login`);
  await other.fill("input:not([type=password])", STOCK_USER);
  await other.fill("input[type=password]", STOCK_PASS);
  await other.click("button[type=submit]");
  await other.waitForURL(/\/desk/, { timeout: 120000 });
  await setLayout(true, other, STOCK_USER);
  await openHome(other);
  const otherCtx = await (await other.request.get(`${BASE}/api/desk/context`)).json();
  const otherRead = new Set(otherCtx.perms?.can_read ?? []);
  const otherQc = await other.getByRole("list", { name: "Quick create" }).getByRole("link").allInnerTexts().catch(() => []);
  check(otherQc.every((d) => otherRead.has(d.trim())), `stock user's Quick create is readable to them (${otherQc.join(", ")})`);
  check(otherQc.join() !== qc.join(), "different Quick create from the System Manager's");
  check(!otherRead.has("Sales Invoice") && !otherQc.includes("Sales Invoice"), "no Sales Invoice (outside their permissions)");
  const links = await other.locator('[data-testid="dynamic-home"] a[href^="/desk/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check(!links.some((h) => /^\/desk\/sales-invoice(\/|$|\?)/.test(h ?? "")), "no link to the Sales Invoice list anywhere on their home");
  await other.screenshot({ path: `${process.env.OUT ?? "./smoke-shots"}/p2-home-1280-stock.png`, fullPage: true });
  await other.close();

  step("switch off: classic apps grid");
  await setLayout(false);
  await page.goto(`${BASE}/desk`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 90000 });
  check(!(await page.getByTestId("dynamic-home").isVisible().catch(() => false)), "no dynamic home with the switch off");
  check(await page.getByRole("heading", { level: 2, name: "Recently viewed" }).isVisible().catch(() => false), "classic home shown");

  const errs = t.errors.filter((e) => !/HTTP 40[34]/.test(e));
  check(!errs.length, `no page errors${errs.length ? `: ${errs.slice(0, 3).join(" | ")}` : ""}`);
} finally {
  await cleanup();
}
await t.finish();
