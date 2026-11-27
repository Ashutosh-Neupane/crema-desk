// Shared helpers for the e2e scripts (login, checks, error capture).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { createRequire } from "node:module";

export const BASE = process.env.BASE ?? "http://localhost:3001";
/** Desk's URL slug for a doctype or workspace (router.slug): "Sales Invoice" → "sales-invoice", URL-encoded */
// a calendar date (YYYY-MM-DD) in this machine's timezone, n days from today. Not toISOString(): that is the UTC date,
// which differs from the site's date for part of the day (e.g. 00:00–05:45 in Kathmandu).
export const localDate = (n = 0) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA");
export const slug = (name) => encodeURIComponent(String(name).toLowerCase().replace(/ /g, "-"));
export const OUT = process.env.OUT ?? "./smoke-shots";
/**
 * NEW_LAYOUT=1 runs a suite with the phase 2 "New layout" switch on, NEW_LAYOUT=0 with it off; unset leaves the
 * user's saved choice alone. The switch is stored like the app stores it: user_settings "Crema UI", the
 * localStorage cache and the crema_ui cookie the server renders from (lib/ui/prefs.ts, prefsCookie.ts).
 */
const NEW_LAYOUT = process.env.NEW_LAYOUT === undefined ? undefined : process.env.NEW_LAYOUT === "1";

async function applyLayoutSwitch(page, user) {
  if (NEW_LAYOUT === undefined) return;
  const prefs = { newLayout: NEW_LAYOUT, density: "comfortable" };
  await page.request.post(`${BASE}/api/frappe/api/method/frappe.model.utils.user_settings.save`, {
    data: { doctype: "Crema UI", user_settings: JSON.stringify(prefs) },
  });
  await page.evaluate(([u, p]) => localStorage.setItem(`crema:ui-prefs:${u}`, JSON.stringify(p)), [user, prefs]);
  await page.context().addCookies([{ name: "crema_ui", value: `${encodeURIComponent(user)}~${NEW_LAYOUT ? 1 : 0}~r`, url: BASE }]);
  await page.reload({ waitUntil: "domcontentloaded" });
}

/** axe-core's source, injected into the page by t.axe() */
let axeSource;
const axeScript = () => (axeSource ??= fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8"));

export async function start() {
  fs.mkdirSync(OUT, { recursive: true });
  // PW_CHANNEL=chrome uses the installed Google Chrome when Playwright's own Chromium isn't downloaded
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
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
  await page.fill("input:not([type=password])", process.env.CREMA_USER ?? "Administrator");
  await page.fill("input[type=password]", process.env.CREMA_PASS ?? "admin");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/desk/, { timeout: 120000 });
  await applyLayoutSwitch(page, process.env.CREMA_USER ?? "Administrator");
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
    /**
     * axe-core (WCAG 2.0/2.1 A + AA) on the current page, or on `selector`. Returns the violations;
     * `t.axeCheck(label)` turns serious / critical ones into a failed check.
     */
    async axe(selector) {
      await page.addScriptTag({ content: axeScript() });
      return page.evaluate(
        async (sel) => (await window.axe.run(sel ? document.querySelector(sel) : document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, first: v.nodes[0]?.target?.join(" ") })),
        selector ?? null,
      );
    },
    async axeCheck(label, selector) {
      const bad = (await this.axe(selector)).filter((v) => v.impact === "serious" || v.impact === "critical");
      this.check(!bad.length, `${label}: no serious accessibility problems${bad.length ? ` (${bad.map((v) => `${v.id} ×${v.nodes} at ${v.first}`).join("; ")})` : ""}`);
      return bad;
    },
    async finish() {
      console.log(`\n${failures ? "FAILED" : "ALL PASSED"} (${failures} failures)`);
      errors.forEach((e) => console.log(e));
      await browser.close();
      process.exit(failures ? 1 : 0);
    },
  };
}

/** The site's default company (Global Defaults), or CREMA_COMPANY; for suites that post ERPNext transactions. */
export async function defaultCompany(page) {
  if (process.env.CREMA_COMPANY) return process.env.CREMA_COMPANY;
  const r = await page.request.post(`${BASE}/api/frappe/api/method/frappe.client.get_value`, {
    data: { doctype: "Global Defaults", fieldname: "default_company", filters: "Global Defaults" },
  });
  return (await r.json()).message?.default_company;
}
