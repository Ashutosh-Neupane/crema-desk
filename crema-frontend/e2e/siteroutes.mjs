// Paths Frappe serves outside Desk reach the site through Crema (app/[...path]/route.ts → lib/frappe/sitePassthrough.ts):
// other apps' own frontends registered with website_route_rules (ERPNext's /banking, /hrms, /crm …), /api/v2, and
// Frappe's redirects and 404s. A sidebar URL item such as Accounts → Banking is a plain page load, as in Desk
// (ui/sidebar/sidebar_item.js renders link_type "URL" as <a href>).
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/siteroutes.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const origin = new URL(BASE).origin;

step("/api/v2 goes through to the site with the session");
const v2 = await page.request.get(`${BASE}/api/v2/method/frappe.auth.get_logged_user`);
check(v2.status() === 200 && (await v2.json()).data === "Administrator", `GET /api/v2 → ${v2.status()}`);

step("an app's own frontend loads through Crema (ERPNext /banking when the site has it)");
const banking = await page.request.get(`${BASE}/banking`, { maxRedirects: 0 });
if (banking.status() === 404) {
  console.log("  SKIP /banking: this site's ERPNext has no Banking app (Frappe answers 404 too)");
} else {
  check(banking.status() === 200, `/banking → ${banking.status()}`);
  const html = await banking.text();
  check(/\/assets\/erpnext\/banking\//.test(html), "page loads ERPNext's banking bundle from /assets");

  step("Accounts sidebar → Banking is a page load to the app");
  // the Banking item sits in the Accounts module's sidebar, shown on its workspace
  await page.goto(`${BASE}/desk/accounting`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const link = page.locator('a[href="/banking"]').first();
  await link.waitFor({ state: "attached", timeout: 60000 });
  check((await link.evaluate((a) => a.tagName)) === "A", "Banking renders as a plain link");
  await Promise.all([page.waitForURL(`${origin}/banking**`, { timeout: 60000 }), link.click()]);
  await page.waitForFunction(() => /Banking/i.test(document.title), null, { timeout: 60000 });
  check(true, `landed on ${new URL(page.url()).pathname} (${await page.title()})`);
  // the app mounts into its own root element (#root / #app) and renders its UI
  await page.waitForFunction(() => (document.querySelector("#root, #app")?.children.length ?? 0) > 0 && document.body.innerText.trim().length > 20, null, { timeout: 60000 });
  check(true, "Banking app rendered");
  await shot("siteroutes_banking", false);
}

step("Frappe's redirects stay on Crema's origin; unknown paths get the site's 404");
const apps = await page.request.get(`${BASE}/apps`, { maxRedirects: 0 });
const loc = apps.headers()["location"];
check(apps.status() < 300 || (!!loc && loc.startsWith("/")), `/apps → ${apps.status()}${loc ? ` ${loc}` : ""}`);
const missing = await page.request.get(`${BASE}/crema-no-such-page-${Date.now()}`);
check(missing.status() === 404, `unknown path → ${missing.status()} from the site`);

step("Crema's own routes still win");
const desk = await page.request.get(`${BASE}/desk`);
check(desk.status() === 200 && /<html/i.test(await desk.text()), "/desk is rendered by Crema");

await t.finish();
