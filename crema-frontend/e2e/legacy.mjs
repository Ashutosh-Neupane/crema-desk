// Legacy page host (L4): ERPNext's POS (jQuery/Vue Desk page) runs in a same-origin frame with Desk chrome
// hidden; Form navigation inside a framed page opens in Crema.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/legacy.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, errors } = t;

step("sidebar POS → framed Point of Sale");
await page.goto(`${BASE}/desk/page/point-of-sale`, { waitUntil: "domcontentloaded", timeout: 180000 });
const frame = page.frameLocator('iframe[title="Frappe page point-of-sale"]');
await frame.getByText("Create POS Opening Entry").waitFor({ timeout: 90000 });
check(true, "POS opening dialog rendered by ERPNext's own page code");
await page.getByRole("heading", { name: "Point of Sale" }).waitFor({ timeout: 15000 });
check(true, "title bridged to Crema");
const innerFrame = () => page.frames().find((f) => f !== page.mainFrame());
const chromeHidden = await innerFrame()?.evaluate(() => {
  const nav = document.querySelector(".navbar");
  return !nav || getComputedStyle(nav).display === "none";
});
check(chromeHidden === true, "Desk navbar hidden inside the frame");
await shot("legacy_pos", false);

step("Form route inside a framed page opens natively in Crema");
const inner = innerFrame();
await inner.waitForFunction(() => window.__cremaBridgeReady === true, null, { timeout: 30000 });
// Crema navigates away and unmounts the frame, so the evaluate call may end with "Frame was detached"
await inner.evaluate(() => window.frappe.set_route("Form", "Customer", "Everest Foods")).catch(() => {});
await page.waitForURL(/\/desk\/doctype\/Customer\/Everest%20Foods/, { timeout: 30000 });
check(true, "navigated to Crema's Customer form");

check(!errors.some((e) => /socket\.io|ERR_CONNECTION_REFUSED/.test(e)), "no socket errors from the framed page");
await t.finish();
