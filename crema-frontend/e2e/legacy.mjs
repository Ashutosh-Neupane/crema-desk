// Legacy page host (L4): ERPNext's POS (jQuery/Vue Desk page) runs in a same-origin frame with Desk chrome
// hidden; Form navigation inside a framed page opens in Crema.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/legacy.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, errors } = t;

step("sidebar POS → framed Point of Sale");
// ERPNext's pos_controller.js asks check_opening_entry first: with an open POS Opening Entry for this user it
// builds the POS app (.point-of-sale-app → .items-selector), otherwise it opens "Create POS Opening Entry".
// Expect whichever the site's own data calls for.
const opening = (await (await page.request.post(`${BASE}/api/frappe/api/method/erpnext.selling.page.point_of_sale.point_of_sale.check_opening_entry`, { data: { user: process.env.CREMA_USER ?? "Administrator" } })).json()).message ?? [];
await page.goto(`${BASE}/desk/point-of-sale`, { waitUntil: "domcontentloaded", timeout: 180000 });
const frame = page.frameLocator('iframe[title="Frappe page point-of-sale"]');
if (opening.length) {
  await frame.locator(".point-of-sale-app .items-selector").waitFor({ timeout: 90000 });
  check(true, `POS app rendered by ERPNext's own page code (open entry ${opening[0].name})`);
} else {
  await frame.getByText("Create POS Opening Entry").waitFor({ timeout: 90000 });
  check(true, "POS opening dialog rendered by ERPNext's own page code (no open entry)");
}
// the framed page's own title becomes Crema's heading ("Point of Sale", or the POS app's current
// "New Sales Invoice …" once an opening entry is open — Desk shows the same title)
await page.waitForFunction(() => {
  const f = document.querySelector('iframe[title="Frappe page point-of-sale"]');
  const title = f?.contentDocument?.title?.trim();
  return !!title && [...document.querySelectorAll("h1, h2, [role=heading]")].some((h) => h.textContent?.trim() === title);
}, null, { timeout: 30000 });
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
// any customer of this site
const CUSTOMER = (await (await page.request.post(`${BASE}/api/frappe/api/method/frappe.client.get_list`, { data: { doctype: "Customer", fields: ["name"], limit_page_length: 1 } })).json()).message?.[0]?.name ?? "Guest Customer";
await inner.evaluate((c) => window.frappe.set_route("Form", "Customer", c), CUSTOMER).catch(() => {});
await page.waitForURL(new RegExp(`/desk/customer/${encodeURIComponent(CUSTOMER).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), { timeout: 30000 });
check(true, "navigated to Crema's Customer form");

check(!errors.some((e) => /socket\.io|ERR_CONNECTION_REFUSED/.test(e)), "no socket errors from the framed page");
await t.finish();
