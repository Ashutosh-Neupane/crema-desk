// Phase 2 form, PR 5a (docs/PHASE2_DESIGN.md § 4.3), New layout: a summary card of the document's key facts from the
// meta, sections as cards, a saved document's empty optional fields folded into "More fields (n)" and its empty
// optional sections folded, tabs past four in a "More" menu, and a new document that shows every field.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/p2.form.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start({ newLayout: true });
const { page, check, step, shot, api } = t;
await page.setViewportSize({ width: 1440, height: 1000 });

const DT = "Sales Order";
const rows = (await api(`api/resource/${encodeURIComponent(DT)}?fields=${encodeURIComponent('["name","docstatus"]')}&filters=${encodeURIComponent('[["docstatus","<",2]]')}&order_by=modified%20desc&limit_page_length=1`)).data ?? [];

try {
  step("saved Sales Order: summary card");
  if (!rows.length) throw new Error("no Sales Order on this site");
  const name = rows[0].name;
  await page.goto(`${BASE}/desk/${slug(DT)}/${encodeURIComponent(name)}`, { waitUntil: "domcontentloaded" });
  const summary = page.getByRole("region", { name: "Summary" });
  await summary.waitFor({ timeout: 60000 });
  const facts = await summary.locator("dt").allInnerTexts();
  check(facts.length >= 2 && facts.length <= 6, `summary shows ${facts.length} facts (${facts.join(", ")})`);
  check(!facts.some((f) => /^status$/i.test(f)), "status stays in the header pill, not the card");

  step("sections are cards; empty optional fields fold");
  const sections = page.locator(".crema-form-body section[aria-label]:not([aria-label=Summary])");
  check((await sections.count()) >= 2, `sections drawn as cards (${await sections.count()})`);
  const more = page.getByRole("button", { name: /^More fields \(\d+ empty\)$/ });
  const folded = page.locator(".crema-form-body section button[aria-expanded=false]");
  check((await more.count()) + (await folded.count()) > 0, `something folded (${await more.count()} More fields, ${await folded.count()} folded sections)`);
  if (await more.count()) {
    const section = page.locator(".crema-form-body section").filter({ has: more.first() });
    const before = await section.locator("[data-fieldtype]").count();
    await more.first().click();
    const after = await section.locator("[data-fieldtype]").count();
    check(after > before, `More fields opens the rest (${before} → ${after} fields)`);
    await section.getByRole("button", { name: "Fewer fields" }).click();
    check((await section.locator("[data-fieldtype]").count()) === before, "Fewer fields folds them again");
  }
  check(!(await page.locator(".crema-form-body").getByRole("button", { name: /^Items\b/ }).count()), "Items heading stays open above the item grid");
  await shot("p2_form_saved", false);

  step("tabs past four go into More");
  const tabs = page.getByRole("tablist").first().getByRole("tab");
  const n = await tabs.count();
  const moreTabs = page.getByRole("tablist").first().getByRole("button", { name: /^More/ });
  if (await moreTabs.isVisible().catch(() => false)) {
    check(n <= 5, `${n} tabs in the bar`);
    await moreTabs.click();
    const item = page.getByRole("menuitem").first();
    const label = (await item.innerText()).trim();
    await item.click();
    await page.getByRole("tab", { name: label, selected: true }).waitFor({ timeout: 5000 }).then(() => check(true, `menu opens tab ${label}`), () => check(false, `menu opens tab ${label}`));
  } else check(n <= 5, `${n} tabs, no overflow needed`);
  await t.axeCheck("saved form", ".crema-form-body");

  step("new Sales Order: no summary yet, nothing folded");
  await page.goto(`${BASE}/desk/${slug(DT)}/new`, { waitUntil: "domcontentloaded" });
  await page.locator(".crema-form-body [data-fieldtype]").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  check(!(await page.getByRole("button", { name: /^More fields/ }).count()), "no More fields on a new document");
  const sum = page.getByRole("region", { name: "Summary" });
  const sumFacts = (await sum.count()) ? await sum.locator("dt").allInnerTexts() : [];
  check(sumFacts.length <= 1, `new document: summary waits for values (${sumFacts.join(", ") || "no card"})`);
  await shot("p2_form_new", false);
} finally {
  await t.finish();
}
