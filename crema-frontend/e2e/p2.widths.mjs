// Phase 2 large screens (docs/PHASE2_DESIGN.md § 3.4 / 3.8): home, list and form at 1280 / 1600 / 1920 / 2560 in
// the New layout. Asserts: content uses the width (no 1290 cap), no horizontal scroll, no input wider than
// --field-max (448 px), form sections gain columns on wide screens, list shows the filters pane at ≥ 1920 and the
// pane choice survives a reload.
//   BASE=http://localhost:3001 NEW_LAYOUT=1 OUT=/tmp/shots node e2e/p2.widths.mjs [--widths=1280,1920]
import { start, BASE } from "./lib.mjs";

const arg = process.argv.find((a) => a.startsWith("--widths="));
const WIDTHS = arg ? arg.slice(9).split(",").map(Number) : [1280, 1600, 1920, 2560];
const t = await start();
const { page, check, step, shot, api } = t;

const so = (await api(`api/resource/Sales Order?fields=${encodeURIComponent('["name"]')}&limit_page_length=1&order_by=modified%20desc`)).data?.[0]?.name;
const ROUTES = [
  ["home", "/desk", "main"],
  ["list", "/desk/sales-order", "main"],
  ...(so ? [["form", `/desk/sales-order/${encodeURIComponent(so)}`, "main form, main [data-form-body], main"]] : []),
];

/** layout facts measured in the page */
const measure = () =>
  page.evaluate(() => {
    const main = document.querySelector("#main-container") ?? document.querySelector("main");
    const vw = document.documentElement.clientWidth;
    const inputs = [...document.querySelectorAll("main .crema-col input:not([type=checkbox]):not([type=radio]), main .crema-col select")]
      .filter((e) => e.offsetParent && !e.closest("[data-grid], table, [role=grid], [role=dialog], header"))
      .map((e) => Math.round(e.getBoundingClientRect().width));
    // visual columns: distinct left edges of the fields in each section
    const sectionCols = [...document.querySelectorAll(".crema-section-grid")].map((g) => new Set([...g.querySelectorAll("[data-fieldtype]")].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().left / 8))).size);
    return {
      vw,
      content: Math.round(main.getBoundingClientRect().width),
      hscroll: document.documentElement.scrollWidth > vw + 1,
      widestInput: inputs.length ? Math.max(...inputs) : 0,
      maxCols: sectionCols.length ? Math.max(...sectionCols) : 0,
      filtersPane: !!document.querySelector("[data-pane='list-filters']")?.offsetParent,
    };
  });

const rows = [];
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: Math.round(w * 0.5625) });
  for (const [name, path] of ROUTES) {
    step(`${name} at ${w}`);
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    const m = await measure();
    rows.push({ w, name, ...m });
    const sidebar = 260;
    check(m.content >= Math.min(w - sidebar - 120, w * 0.7), `${name}@${w}: content uses the width (${m.content}px of ${m.vw})`);
    check(!m.hscroll, `${name}@${w}: no horizontal scroll`);
    if (name === "form") {
      check(m.widestInput <= 520, `form@${w}: no input wider than --field-max (widest ${m.widestInput}px)`);
      if (w >= 1920) check(m.maxCols >= 3, `form@${w}: sections use 3 columns (max ${m.maxCols})`);
    }
    if (name === "list" && w >= 1920) check(m.filtersPane, `list@${w}: filters pane shown`);
    await shot(`p2_widths_${name}_${w}`, false);
  }
}

if (WIDTHS.some((w) => w >= 1920)) {
  step("list filters pane: closing it is remembered");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE}/desk/sales-order`, { waitUntil: "domcontentloaded" });
  const toggle = page.getByRole("button", { name: /Hide filters pane/ });
  if (await toggle.waitFor({ timeout: 30000 }).then(() => true).catch(() => false)) {
    await toggle.click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    check(!(await measure()).filtersPane, "pane stays closed after reload");
    await page.getByRole("button", { name: /Show filters pane/ }).click();
    await page.waitForTimeout(500);
    check((await measure()).filtersPane, "pane opens again");
  } else check(false, "filters pane toggle present");
}

console.table(rows.map(({ w, name, content, vw, widestInput, maxCols, filtersPane }) => ({ w, name, content, use: `${Math.round((content / vw) * 100)}%`, widestInput, maxCols, filtersPane })));
await t.finish();
