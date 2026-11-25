// Phase 2 foundation (docs/GAPS.md § 3.2): tokens, crema-ui primitives, per-user "New layout" + density prefs.
// Drives /desk/ui-kit: keyboard, Escape, focus trap / return, bottom sheet at 390px, AA contrast of the tokens.
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step } = t;

// WCAG relative luminance contrast of each pill's computed text / background colour
async function pillContrasts() {
  return page.evaluate(() => {
    const parse = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const x = lum(parse(a));
      const y = lum(parse(b));
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    return [...document.querySelectorAll('[data-testid="demo-comfortable"] [data-tone]')].map((el) => {
      const s = getComputedStyle(el);
      return { tone: el.getAttribute("data-tone"), text: el.textContent, ratio: ratio(s.color, s.backgroundColor), hasIcon: !!el.querySelector("svg") };
    });
  });
}

// clean prefs for a deterministic start (server copy + local cache)
await t.api("api/method/frappe.model.utils.user_settings.save", { data: { doctype: "Crema UI", user_settings: JSON.stringify({ newLayout: false, density: "comfortable" }) } });
await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("crema:ui-prefs:")).forEach((k) => localStorage.removeItem(k)));

step("ui-kit renders every primitive in both densities");
await page.goto(`${BASE}/desk/ui-kit`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { level: 1, name: "UI kit" }).waitFor({ timeout: 120000 });
for (const d of ["Comfortable", "Compact"]) {
  check(await page.getByRole("heading", { level: 1, name: `SAL-ORD-0001 (${d})` }).isVisible(), `PageHeader h1 (${d})`);
  check(await page.getByRole("navigation", { name: `Order progress (${d})` }).isVisible(), `Stepper nav (${d})`);
  check((await page.getByRole("navigation", { name: `Order progress (${d})` }).locator('[aria-current="step"]').innerText()).includes("Pending approval"), `Stepper aria-current (${d})`);
  check(await page.getByRole("region", { name: `Unsaved changes (${d})` }).isVisible(), `BottomBar region (${d})`);
  check(await page.getByRole("heading", { name: "No Sales Orders yet" }).nth(d === "Compact" ? 1 : 0).isVisible(), `EmptyState (${d})`);
}
const heights = await page.evaluate(() =>
  ["comfortable", "compact"].map((d) => getComputedStyle(document.querySelector(`[data-testid="demo-${d}"]`)).getPropertyValue("--density-control-height").trim()),
);
check(heights[0] === "40px" && heights[1] === "28px", `density control heights 40/28 (${heights})`);
const btnH = await page.evaluate(() => ["comfortable", "compact"].map((d) => document.querySelector(`[data-testid="demo-${d}"] header button`).getBoundingClientRect().height));
check(btnH[0] >= 39 && btnH[1] <= 29, `buttons follow density (${btnH})`);
const h1Size = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-testid="demo-comfortable"] h1')).fontSize));
check(h1Size >= 18 && h1Size <= 22, `h1 uses clamp() type scale (${h1Size}px)`);

step("StatusPill: word + icon + AA contrast");
const pills = await pillContrasts();
check(pills.length >= 6 && pills.every((p) => p.hasIcon && p.text.trim()), "every pill has a word and an icon");
for (const p of pills) check(p.ratio >= 4.5, `pill ${p.tone} "${p.text}" contrast ${p.ratio.toFixed(2)} ≥ 4.5`);
check(pills.find((p) => p.text === "Completed")?.tone === "success", "indicator=green → success tone");

step("Section collapses with keyboard");
const more = page.getByRole("button", { name: "More details (Comfortable)" });
check((await more.getAttribute("aria-expanded")) === "false", "collapsed by default");
await more.focus();
await page.keyboard.press("Enter");
check((await more.getAttribute("aria-expanded")) === "true", "Enter expands");
check(await page.getByText("Optional fields stay out of the way").first().isVisible(), "body shown");
const ring = await more.evaluate((el) => getComputedStyle(el).boxShadow);
check(ring && ring !== "none", `visible focus ring (${ring.slice(0, 40)})`);

step("SidePanel: focus trap, Esc, focus return (desktop drawer)");
const opener = page.getByRole("button", { name: "Open panel (Comfortable)" });
await opener.focus();
await page.keyboard.press("Enter");
const dialog = page.getByRole("dialog", { name: "Preview (Comfortable)" });
await dialog.waitFor();
check((await dialog.getAttribute("aria-modal")) === "true", "role=dialog aria-modal");
check(await page.evaluate(() => document.activeElement?.hasAttribute("data-autofocus")), "data-autofocus element focused");
let box = await dialog.boundingBox();
check(box && Math.round(box.x + box.width) === 1440 && box.height > 900, `drawer on the right (${JSON.stringify(box)})`);
const inside = [];
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("Tab");
  inside.push(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
}
check(inside.every(Boolean), "Tab cycles inside the panel");
await page.keyboard.press("Shift+Tab");
check(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), "Shift+Tab stays inside");
await page.keyboard.press("Escape");
await dialog.waitFor({ state: "detached" });
check(await opener.evaluate((el) => el === document.activeElement), "Esc closes and focus returns to opener");

step("LayoutSwitch + DensitySwitch persist per user (Frappe user_settings)");
const sw = page.getByRole("switch", { name: "New layout" });
check((await sw.getAttribute("aria-checked")) === "false", "switch off initially");
const saved = page.waitForResponse((r) => r.url().includes("user_settings.save"));
await sw.click();
await saved;
check((await sw.getAttribute("aria-checked")) === "true", "switch on");
check((await page.evaluate(() => document.documentElement.dataset.layout)) === "new", "<html data-layout=new>");
await page.getByRole("radio", { name: "Compact" }).click();
check((await page.evaluate(() => document.documentElement.dataset.density)) === "compact", "<html data-density=compact>");
await page.waitForTimeout(800);
const server = await t.api("api/method/frappe.model.utils.user_settings.get?doctype=Crema%20UI");
const parsed = JSON.parse(server.message || "{}");
check(parsed.newLayout === true && parsed.density === "compact", `saved on the server (${server.message})`);
// a fresh browser (no local cache) picks it up from the server
await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("crema:ui-prefs:")).forEach((k) => localStorage.removeItem(k)));
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("heading", { level: 1, name: "UI kit" }).waitFor({ timeout: 120000 });
await page.waitForFunction(() => document.querySelector('[role="switch"]')?.getAttribute("aria-checked") === "true", null, { timeout: 15000 }).catch(() => {});
check((await sw.getAttribute("aria-checked")) === "true", "new layout restored from the server");
check((await page.getByTestId("current-density").innerText()).includes("compact"), "density restored from the server");
// reload with the cache: right on first paint (attribute set before hydration finishes)
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("heading", { level: 1, name: "UI kit" }).waitFor({ timeout: 120000 });
check((await page.evaluate(() => document.documentElement.dataset.density)) === "compact", "density from localStorage cache on reload");

step("high contrast + dark keep AA");
await page.getByLabel("High contrast").check();
for (const p of await pillContrasts()) check(p.ratio >= 7, `high-contrast pill ${p.tone} ${p.ratio.toFixed(2)} ≥ 7`);
await page.getByLabel("High contrast").uncheck();
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
for (const p of await pillContrasts()) check(p.ratio >= 4.5, `dark pill ${p.tone} ${p.ratio.toFixed(2)} ≥ 4.5`);
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));

step("bottom sheet at 390px");
await page.setViewportSize({ width: 390, height: 844 });
const op2 = page.getByRole("button", { name: "Open panel (Compact)" });
await op2.scrollIntoViewIfNeeded();
await op2.click();
const sheet = page.getByRole("dialog", { name: "Preview (Compact)" });
await sheet.waitFor();
await page.waitForTimeout(400);
box = await sheet.boundingBox();
check(box && box.x === 0 && Math.round(box.width) === 390 && Math.round(box.y + box.height) === 844 && box.height < 844 * 0.9, `bottom sheet full width at the bottom (${JSON.stringify(box)})`);
const closeBox = await sheet.getByRole("button", { name: "Close" }).boundingBox();
check(closeBox && closeBox.width >= 40 && closeBox.height >= 40, `close target ≥ 40px (${closeBox?.width}x${closeBox?.height})`);
await t.shot("p2-foundation-390", false);
await page.mouse.click(200, 40); // backdrop
await sheet.waitFor({ state: "detached" });
check(true, "backdrop closes the sheet");
await page.setViewportSize({ width: 1440, height: 1000 });

// restore defaults so other suites see the classic layout
await t.api("api/method/frappe.model.utils.user_settings.save", { data: { doctype: "Crema UI", user_settings: JSON.stringify({ newLayout: false, density: "comfortable" }) } });
await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("crema:ui-prefs:")).forEach((k) => localStorage.removeItem(k)));
await t.shot("p2-foundation-1440");
await t.finish();
