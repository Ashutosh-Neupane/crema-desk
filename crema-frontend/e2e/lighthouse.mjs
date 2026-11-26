// Lighthouse for Crema's main routes, logged in, on a production build (docs/PHASE2_DESIGN.md § 6.1, S7).
// Runs each route 3× per preset (desktop, mobile) and keeps the median by performance score, then prints a Markdown
// table for the PR and writes the medians as JSON. DESK=1 also measures the same screens in Frappe Desk.
//   BASE=http://localhost:3001 OUT=/tmp/lh node e2e/lighthouse.mjs [home,list,form,new,report] [--runs=3] [--preset=desktop,mobile]
// Lighthouse runs through npx at a pinned version (not a project dependency); Chrome comes from CHROME_PATH or the
// installed Google Chrome. NEW_LAYOUT=1 / 0 measures with the phase 2 switch on / off (see e2e/lib.mjs).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LIGHTHOUSE = "lighthouse@12.6.1";
const BASE = process.env.BASE ?? "http://localhost:3001";
const DESK = process.env.DESK_BASE ?? process.env.FRAPPE_BACKEND_URL ?? "http://localhost:8050";
const SITE = process.env.FRAPPE_SITE_NAME;
const OUT = path.join(process.env.OUT ?? "./lighthouse-out", new Date().toISOString().slice(0, 10));
const USER = process.env.CREMA_USER ?? "Administrator";
const PASS = process.env.CREMA_PASS ?? "admin";
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const RUNS = Number(arg("runs") ?? 3);
const PRESETS = (arg("preset") ?? "desktop,mobile").split(",");
const wanted = process.argv.slice(2).find((a) => !a.startsWith("--"))?.split(",");

async function login(base, hostHeader) {
  const r = await fetch(`${base}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(hostHeader ? { "X-Frappe-Site-Name": hostHeader } : {}) },
    body: JSON.stringify({ usr: USER, pwd: PASS }),
    redirect: "manual",
  });
  const cookies = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter((c) => !c.endsWith("="));
  if (!cookies.some((c) => c.startsWith("sid="))) throw new Error(`login failed at ${base} (${r.status})`);
  return cookies;
}

const json = (cookies, base) => async (method, data) => {
  const r = await fetch(`${base}/api/method/${method}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookies.join("; ") }, body: JSON.stringify(data) });
  return (await r.json()).message;
};

// Crema's login goes through its own proxy (/api/method/login → Frappe), so the cookies are Crema's
const cremaCookies = await login(`${BASE}/api/frappe`);
const call = json(cremaCookies, `${BASE}/api/frappe`);
if (process.env.NEW_LAYOUT !== undefined) {
  const on = process.env.NEW_LAYOUT === "1";
  await call("frappe.model.utils.user_settings.save", { doctype: "Crema UI", user_settings: JSON.stringify({ newLayout: on, density: "comfortable" }) });
  cremaCookies.push(`crema_ui=${encodeURIComponent(USER)}~${on ? 1 : 0}~r`);
}
const so = (await call("frappe.client.get_list", { doctype: "Sales Order", filters: [["docstatus", "<", 2]], fields: ["name"], order_by: "modified desc", limit_page_length: 1 }))?.[0]?.name;

// [name, Crema path, Desk path]
const ROUTES = [
  ["home", "/desk", "/desk"],
  ["list", "/desk/sales-order", "/desk/sales-order"],
  ...(so ? [["form", `/desk/sales-order/${encodeURIComponent(so)}`, `/desk/sales-order/${encodeURIComponent(so)}`]] : []),
  ["new", "/desk/sales-order/new", "/desk/sales-order/new"],
  ["report", "/desk/query-report/General%20Ledger", "/desk/query-report/General%20Ledger"],
].filter(([n]) => !wanted || wanted.includes(n));

const targets = [["crema", BASE, cremaCookies]];
if (process.env.DESK === "1") targets.push(["desk", DESK, await login(DESK, SITE)]);

fs.mkdirSync(OUT, { recursive: true });
const chromeFlags = "--headless=new --no-first-run --no-default-browser-check";
const rows = [];
for (const [who, base, cookies] of targets) {
  for (const [name, cremaPath, deskPath] of ROUTES) {
    for (const preset of PRESETS) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const file = path.join(OUT, `${who}_${name}_${preset}_${i}.json`);
        const headers = JSON.stringify({ Cookie: cookies.join("; "), ...(who === "desk" && SITE ? { "X-Frappe-Site-Name": SITE } : {}) });
        try {
          execFileSync("npx", ["-y", LIGHTHOUSE, `${base}${who === "desk" ? deskPath : cremaPath}`, "--quiet", "--output=json", `--output-path=${file}`, `--extra-headers=${headers}`, `--chrome-flags=${chromeFlags}`, "--only-categories=performance,accessibility", ...(preset === "desktop" ? ["--preset=desktop"] : [])], { stdio: ["ignore", "ignore", "pipe"], timeout: 240000 });
        } catch (e) {
          console.error(`  ${who} ${name} ${preset} run ${i + 1} failed: ${String(e.stderr ?? e.message).slice(0, 300)}`);
          continue;
        }
        const r = JSON.parse(fs.readFileSync(file, "utf8"));
        const a = r.audits;
        runs.push({
          perf: Math.round(r.categories.performance.score * 100),
          a11y: Math.round(r.categories.accessibility.score * 100),
          lcp: a["largest-contentful-paint"].numericValue / 1000,
          cls: a["cumulative-layout-shift"].numericValue,
          tbt: Math.round(a["total-blocking-time"].numericValue),
          requests: a["network-requests"]?.details?.items?.length ?? null,
          kb: Math.round((a["total-byte-weight"]?.numericValue ?? 0) / 1024),
          finalUrl: r.finalDisplayedUrl,
        });
      }
      if (!runs.length) continue;
      runs.sort((x, y) => x.perf - y.perf);
      const m = runs[Math.floor(runs.length / 2)];
      rows.push({ who, name, preset, ...m });
      console.log(`${who.padEnd(5)} ${name.padEnd(6)} ${preset.padEnd(7)} perf ${m.perf} a11y ${m.a11y} LCP ${m.lcp.toFixed(2)}s CLS ${m.cls.toFixed(3)} TBT ${m.tbt}ms ${m.requests} req ${m.kb} KB`);
    }
  }
}

fs.writeFileSync(path.join(OUT, "medians.json"), JSON.stringify(rows, null, 2));
console.log(`\n| Screen | Preset | ${targets.map(([w]) => `${w} perf | ${w} a11y | ${w} LCP | ${w} CLS`).join(" | ")} |`);
console.log(`|---|---|${targets.map(() => "---|---|---|---").join("|")}|`);
for (const [name] of ROUTES) {
  for (const preset of PRESETS) {
    const cells = targets.map(([w]) => {
      const r = rows.find((x) => x.who === w && x.name === name && x.preset === preset);
      return r ? `${r.perf} | ${r.a11y} | ${r.lcp.toFixed(2)} s | ${r.cls.toFixed(3)}` : "– | – | – | –";
    });
    console.log(`| ${name} | ${preset} | ${cells.join(" | ")} |`);
  }
}
console.log(`\nmedian of ${RUNS} runs; files in ${OUT}`);
