// Screenshots for the README, against a live ERPNext site.
//   BASE=http://localhost:3001 OUT=../docs/screenshots REDACT="Real Co=Demo Company;- RC=- DC" node e2e/readme-shots.mjs
// REDACT replaces text (and input values) before each shot, e.g. to keep a real company name out of the images.
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page } = t;
const pairs = (process.env.REDACT ?? "").split(";").filter(Boolean).map((p) => p.split("="));
const redactIn = (frame) => frame.evaluate((pairs) => {
  const fix = (s) => pairs.reduce((a, [f, r]) => a.split(f).join(r), s);
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode()); ) n.nodeValue = fix(n.nodeValue);
  for (const i of document.querySelectorAll("input")) i.value = fix(i.value);
  document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"));
}, pairs).catch(() => {});
const shot = async (n) => {
  for (const f of page.frames()) await redactIn(f);
  await page.screenshot({ path: `${process.env.OUT}/${n}.png` });
};
const api = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const settle = () => page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
const open = async (path, ready) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await ready().catch((e) => console.log(`  (${path}: ${e.message.split("\n")[0]})`));
  await settle();
  await page.waitForTimeout(1500);
};

await open("/desk/selling", () => page.locator("#main-content").getByText(/Sales Order/).first().waitFor({ timeout: 90000 }));
await shot("workspace");

await open("/desk/doctype/Sales%20Order", () => page.getByLabel("List settings").waitFor({ timeout: 90000 }));
await shot("list");

const so = (await api("frappe.client.get_list", { doctype: "Sales Order", filters: { docstatus: 1 }, fields: ["name"], limit_page_length: 1 }))?.[0]?.name;
if (so) {
  await open(`/desk/doctype/Sales%20Order/${encodeURIComponent(so)}`, () => page.getByRole("region", { name: "Activity" }).waitFor({ timeout: 90000 }));
  await shot("form");
  await open(`/desk/print/Sales%20Order/${encodeURIComponent(so)}`, () => page.locator("iframe").first().waitFor({ timeout: 90000 }));
  await page.waitForTimeout(3000);
  await shot("print");
}

await open("/desk/query-report/Stock%20Ledger", () => page.locator("#main-content table, #main-content canvas, #main-content svg").first().waitFor({ timeout: 90000 }));
await shot("report");



await open("/desk/doctype/Sales%20Order", () => page.getByLabel("List settings").waitFor({ timeout: 90000 }));
await page.keyboard.press("Meta+k");
await page.keyboard.type("new sales", { delay: 40 });
await page.waitForTimeout(1500);
await shot("awesomebar");

await t.finish();
