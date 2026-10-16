// Shared helpers for the e2e scripts (login, checks, error capture).
import { chromium } from "@playwright/test";
import fs from "node:fs";

export const BASE = process.env.BASE ?? "http://localhost:3001";
export const OUT = process.env.OUT ?? "./smoke-shots";

export async function start() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|socket\.io/.test(m.text()) && errors.push(`console: ${m.text().slice(0, 300)}`));
  page.on("response", async (r) => {
    if (r.status() < 400 || r.url().includes("socket.io")) return;
    let body = "";
    try {
      body = (await r.text()).replace(/\s+/g, " ").slice(0, 200);
    } catch {}
    errors.push(`HTTP ${r.status()} ${r.request().method()} ${decodeURIComponent(r.url().replace(BASE, "")).slice(0, 140)} :: ${body}`);
  });
  await page.goto(`${BASE}/login`);
  await page.fill("input:not([type=password])", process.env.TREVO_USER ?? "Administrator");
  await page.fill("input[type=password]", process.env.TREVO_PASS ?? "admin");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/desk/, { timeout: 120000 });
  let failures = 0;
  return {
    browser,
    page,
    errors,
    check(cond, msg) {
      console.log(`  ${cond ? "PASS" : "FAIL"} ${msg}`);
      if (!cond) failures++;
    },
    step: (m) => console.log(`• ${m}`),
    shot: (n, full = true) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full }),
    api: async (path, init) => {
      const r = init ? await page.request.post(`${BASE}/api/frappe/${path}`, init) : await page.request.get(`${BASE}/api/frappe/${path}`);
      return r.json();
    },
    async finish() {
      console.log(`\n${failures ? "FAILED" : "ALL PASSED"} (${failures} failures)`);
      errors.forEach((e) => console.log(e));
      await browser.close();
      process.exit(failures ? 1 : 0);
    },
  };
}
