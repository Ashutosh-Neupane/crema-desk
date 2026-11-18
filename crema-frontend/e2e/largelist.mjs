// Large lists stay responsive (GAPS 2.14 / M7): on the site's biggest list (Comment, Version, Activity Log …)
// the 500-row page renders quickly, "Load more" adds another page of the chosen size (Desk base_list.js: start +=
// page_length), scrolling through 1000+ rows never blocks the main thread for long, and select-all is quick.
// Long tasks are read with PerformanceObserver("longtask").
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/largelist.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;

// the biggest listable DocType on this site with at least 600 rows
let DT = null;
let total = 0;
for (const dt of ["Comment", "Version", "Activity Log", "Deleted Document", "Error Log"]) {
  const n = (await api(`api/method/frappe.client.get_count?doctype=${encodeURIComponent(dt)}`)).message ?? 0;
  if (n > total) [DT, total] = [dt, n];
}
if (total < 600) {
  console.log(`SKIPPED: no list with 600+ rows (largest ${DT}: ${total})`);
  await t.finish();
  process.exit(0);
}
console.log(`  data: ${DT}, ${total} rows`);
const rows = page.locator("main table tbody tr");
const waitRows = async (n) => page.waitForFunction((n) => document.querySelectorAll("main table tbody tr").length >= n, n, { timeout: 60000 });

// reset this list's saved settings (page length, filters) so the run starts from Desk's defaults
await api("api/method/frappe.model.utils.user_settings.save", { data: { doctype: DT, user_settings: JSON.stringify({ List: {} }) } });
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}?view=list`, { waitUntil: "domcontentloaded", timeout: 180000 });
await rows.first().waitFor({ timeout: 90000 });
await page.evaluate(() => {
  window.__long = [];
  new PerformanceObserver((l) => window.__long.push(...l.getEntries().map((e) => e.duration))).observe({ type: "longtask", buffered: false });
});
const longest = () => page.evaluate(() => Math.round(Math.max(0, ...window.__long.splice(0))));

step("500-row page renders quickly");
let t0 = Date.now();
await page.getByRole("button", { name: "500", exact: true }).click();
await waitRows(500);
const ms500 = Date.now() - t0;
check(ms500 < 4000, `500 rows on screen in ${ms500} ms (fetch + render)`);
const block500 = await longest();
check(block500 < 400, `longest main-thread block ${block500} ms`);

step("Load more adds another page of 500 (Desk: start += page_length)");
t0 = Date.now();
await page.getByRole("button", { name: "Load more" }).click();
const want = Math.min(1000, total);
await waitRows(want);
check((await rows.count()) >= want, `${await rows.count()} rows after Load more (${Date.now() - t0} ms)`);
const blockMore = await longest();
check(blockMore < 600, `longest block while adding rows ${blockMore} ms`);

step("scrolling through 1000+ rows stays smooth");
await longest();
const frames = await page.evaluate(async () => {
  const el = document.scrollingElement;
  const gaps = [];
  let last = performance.now();
  for (let y = 0; y < el.scrollHeight; y += 400) {
    el.scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    gaps.push(now - last);
    last = now;
  }
  gaps.sort((a, b) => a - b);
  return { n: gaps.length, p95: Math.round(gaps[Math.floor(gaps.length * 0.95)]), max: Math.round(gaps.at(-1)) };
});
const blockScroll = await longest();
check(frames.p95 < 50, `frame gaps while scrolling: p95 ${frames.p95} ms, max ${frames.max} ms over ${frames.n} steps`);
check(blockScroll < 200, `longest block while scrolling ${blockScroll} ms`);

step("select all is quick");
t0 = Date.now();
await page.getByRole("checkbox", { name: /select all/i }).first().click();
await page.waitForFunction(() => [...document.querySelectorAll("main table tbody input[type=checkbox]")].every((c) => c.checked), null, { timeout: 30000 });
check(Date.now() - t0 < 1500, `${await rows.count()} rows selected in ${Date.now() - t0} ms`);
await page.getByRole("checkbox", { name: /select all/i }).first().click();
await shot("largelist", false);

await api("api/method/frappe.model.utils.user_settings.save", { data: { doctype: DT, user_settings: JSON.stringify({ List: {} }) } });
await t.finish();
