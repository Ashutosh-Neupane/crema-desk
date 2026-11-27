// Phase 2 list record preview (docs/PHASE2_DESIGN.md § 3.8): on a wide screen in the New layout, clicking a list row
// previews the record beside the list; ↓ / ↑ move to the next / previous row, Esc closes, "Open" goes to the form,
// ⌘/Ctrl-click still opens, and switching preview off makes a click open the record again.
//   BASE=http://localhost:3001 NEW_LAYOUT=1 OUT=/tmp/shots node e2e/p2.preview.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
await page.setViewportSize({ width: 1920, height: 1080 });

const pane = page.locator("[data-pane=list-preview]");
const rows = page.locator("tbody tr[data-row]");
const toggle = page.getByRole("button", { name: "Preview records on click" });

step("Sales Order list: preview mode on");
await page.goto(`${BASE}/desk/sales-order`, { waitUntil: "domcontentloaded" });
await rows.first().waitFor({ timeout: 60000 });
await toggle.waitFor({ timeout: 15000 });
if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
check((await toggle.getAttribute("aria-pressed")) === "true", "preview mode on");

step("click a row: preview, no navigation");
const first = await rows.nth(0).getAttribute("data-row");
const second = await rows.nth(1).getAttribute("data-row");
await rows.nth(0).locator("td").nth(3).click();
await pane.waitFor({ timeout: 15000 });
check(/\/desk\/sales-order\/?$/.test(new URL(page.url()).pathname), `still on the list (${page.url()})`);
await pane.getByRole("heading").waitFor({ timeout: 15000 });
check((await pane.getAttribute("aria-label")) === `Preview of ${first}`, `previews ${first}`);
check((await rows.nth(0).getAttribute("aria-current")) === "true", "previewed row marked current");
check((await pane.locator("dt").count()) >= 3, "shows field values");
await shot("p2_preview", false);

step("↓ moves to the next row, ↑ back, Esc closes");
await page.keyboard.press("ArrowDown");
await page.waitForFunction((n) => document.querySelector("[data-pane=list-preview]")?.getAttribute("aria-label") === `Preview of ${n}`, second, { timeout: 10000 });
check(true, `↓ previews ${second}`);
await page.keyboard.press("ArrowUp");
await page.waitForFunction((n) => document.querySelector("[data-pane=list-preview]")?.getAttribute("aria-label") === `Preview of ${n}`, first, { timeout: 10000 });
check(true, `↑ back to ${first}`);
await page.keyboard.press("Escape");
await pane.waitFor({ state: "detached", timeout: 10000 });
check(true, "Esc closes the preview");

step("title link previews; Open goes to the form");
await rows.nth(1).getByRole("link").first().click();
await pane.waitFor({ timeout: 15000 });
check(/\/desk\/sales-order\/?$/.test(new URL(page.url()).pathname), "title link previewed instead of navigating");
await pane.getByRole("link", { name: /Open/ }).click();
await page.waitForURL((u) => u.pathname.includes(encodeURIComponent(second)) || u.pathname.includes(second), { timeout: 30000 });
check(true, "Open goes to the record");

step("preview off: a row click opens the record");
await page.goto(`${BASE}/desk/sales-order`, { waitUntil: "domcontentloaded" });
await rows.first().waitFor({ timeout: 60000 });
await toggle.click();
check((await toggle.getAttribute("aria-pressed")) === "false", "preview mode off");
await rows.nth(0).locator("td").nth(3).click();
await page.waitForURL((u) => !/\/desk\/sales-order\/?$/.test(u.pathname), { timeout: 30000 });
check(true, "row click navigates with preview off");
// leave preview on for the user
await page.goto(`${BASE}/desk/sales-order`, { waitUntil: "domcontentloaded" });
await toggle.waitFor({ timeout: 60000 });
await toggle.click();

step("narrow screen: no preview toggle");
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(500);
check(!(await toggle.isVisible().catch(() => false)), "no preview toggle at 1280");

await t.finish();
