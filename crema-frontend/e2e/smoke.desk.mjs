// Desk smoke run against a live backend: logs in, visits key pages, reports
// console errors + screenshots. Usage:
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/smoke.desk.mjs [path ...]
// Credentials come from CREMA_USER / CREMA_PASS (default: the local dev site's admin).
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3001";
const OUT = process.env.OUT ?? "./smoke-shots";
const USER = process.env.CREMA_USER ?? "Administrator";
const PASS = process.env.CREMA_PASS ?? "admin";
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/desk"];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().startsWith("Failed to load resource") && !m.text().includes("socket.io")) errors.push(`[${page.url()}] ${m.text().slice(0, 300)}`);
});
page.on("response", async (r) => {
  if (r.status() < 400 || r.url().includes("socket.io")) return;
  let body = "";
  try {
    body = (await r.text()).replace(/\s+/g, " ");
    const m = body.match(/"exception":"([^"]{0,200})/) ?? body.match(/"error":"([^"]{0,200})/) ?? body.match(/"message":"([^"]{0,200})/);
    body = m ? m[1] : body.slice(0, 160);
  } catch {}
  errors.push(`HTTP ${r.status()} ${r.request().method()} ${decodeURIComponent(r.url().replace(BASE, "")).slice(0, 160)} :: ${body}`);
});
page.on("pageerror", (e) => errors.push(`[${page.url()}] pageerror: ${e.message.slice(0, 300)}`));

await page.goto(`${BASE}/login`);
await page.fill("input:not([type=password])", USER);
await page.fill("input[type=password]", PASS);
await page.click("button[type=submit]");
await page.waitForURL(/\/desk/, { timeout: 30000 });

for (const p of paths) {
  const [path, action] = p.split("#");
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  } catch (e) {
    // a server/client redirect can abort the first navigation — note it and keep going
    errors.push(`goto ${path}: ${String(e.message).split("\n")[0]}`);
  }
  errors.push(`--- ${path} -> ${page.url().replace(BASE, "")}`);
  await page.waitForTimeout(5000); // not networkidle: the realtime socket keeps the network busy
  if (action?.startsWith("k=")) {
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(300);
    await page.keyboard.type(decodeURIComponent(action.slice(2)));
    await page.waitForTimeout(1500);
  }
  const file = `${OUT}/${(path + (action ? "_" + action : "")).replace(/[^a-z0-9]+/gi, "_")}.png`;
  await page.screenshot({ path: file });
  console.log(`shot ${file}`);
}
console.log(`ERRORS (${errors.length})`);
for (const e of errors) console.log(e);
await browser.close();
