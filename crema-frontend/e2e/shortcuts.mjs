// Keyboard shortcuts, as in Desk (ui/keyboard.js, form/toolbar.js, form/form.js, list/list_view.js):
//  form   Ctrl+Z / Ctrl+Y undo and redo what the user typed; Ctrl+E opens the email composer; Shift+? lists the
//         form, grid and global shortcuts
//  dialog Ctrl+S presses the dialog's primary button (not the form's Save behind it)
//  list   ↓ / ↑ focus rows, Space selects, Enter opens
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/shortcuts.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const MOD = "ControlOrMeta";
await page.setViewportSize({ width: 1280, height: 900 });

step("form: Ctrl+Z / Ctrl+Y undo and redo typing");
await page.goto(`${BASE}/desk/customer/new`, { waitUntil: "domcontentloaded" });
const name = page.getByRole("textbox", { name: /^Customer Name/ }).first();
await name.waitFor({ timeout: 60000 });
await name.click();
await name.pressSequentially("Undo Me", { delay: 20 });
await page.waitForTimeout(1500);
await name.pressSequentially(" Twice", { delay: 20 });
await page.waitForTimeout(300);
await page.keyboard.press(`${MOD}+z`);
await page.waitForTimeout(300);
check((await name.inputValue()) === "Undo Me", `Ctrl+Z undoes the last edit ("${await name.inputValue()}")`);
await page.keyboard.press(`${MOD}+z`);
await page.waitForTimeout(300);
check((await name.inputValue()) === "", `Ctrl+Z again empties the field ("${await name.inputValue()}")`);
await page.keyboard.press(`${MOD}+y`);
await page.waitForTimeout(300);
check((await name.inputValue()) === "Undo Me", `Ctrl+Y redoes ("${await name.inputValue()}")`);
await page.keyboard.press(`Shift+${MOD}+z`);
await page.waitForTimeout(300);
check((await name.inputValue()) === "Undo Me Twice", `Shift+Ctrl+Z redoes too ("${await name.inputValue()}")`);

step("Shift+? lists form, grid and global shortcuts");
await page.locator("body").click({ position: { x: 5, y: 300 } });
await page.keyboard.press("Shift+?");
const dlg = page.getByRole("dialog", { name: "Keyboard shortcuts" });
await dlg.waitFor({ timeout: 10000 });
const text = await dlg.innerText();
for (const s of ["Undo last change", "Redo last change", "Add a row below", "Save", "Open awesomebar"]) check(text.includes(s), `shortcuts dialog lists "${s}"`);
await shot("shortcuts_dialog", false);
await page.keyboard.press("Escape");

step("dialog: Ctrl+S presses the dialog's primary button");
await page.goto(`${BASE}/desk/sales-order/new`, { waitUntil: "domcontentloaded" });
const cust = page.getByRole("combobox", { name: /^Customer/ }).first();
await cust.waitFor({ timeout: 60000 });
const newName = `zz key ${Date.now().toString(36)}`;
await cust.click();
await cust.fill(newName);
await page.getByRole("option", { name: /Create a new Customer/ }).click();
const qe = page.getByRole("dialog").first();
await qe.waitFor({ timeout: 15000 });
await page.waitForTimeout(500);
await page.keyboard.press(`${MOD}+s`);
await qe.waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
const made = (await api(`api/resource/Customer?filters=${encodeURIComponent(JSON.stringify([["customer_name", "=", newName]]))}`)).data ?? [];
check(made.length === 1, `Ctrl+S in the quick entry created the Customer (${made.length})`);
check(page.url().endsWith("/new"), "the Sales Order behind it was not saved");

step("form: Ctrl+E opens the email composer (not on a cancelled document, like Desk)");
const so = (await api(`api/resource/Sales Order?limit_page_length=1&order_by=modified%20desc&filters=${encodeURIComponent(JSON.stringify([["docstatus", "<", 2]]))}`)).data?.[0]?.name;
await page.goto(`${BASE}/desk/sales-order/${encodeURIComponent(so)}`, { waitUntil: "domcontentloaded" });
await page.getByRole("tablist").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await page.locator("body").click({ position: { x: 5, y: 300 } });
await page.keyboard.press(`${MOD}+e`);
const composer = page.getByRole("dialog").filter({ hasText: /Subject|To/ }).first();
check(await composer.waitFor({ timeout: 10000 }).then(() => true).catch(() => false), "Ctrl+E opens the email composer");
await shot("shortcuts_email", false);
await page.keyboard.press("Escape");

step("list: ↓ / ↑ focus rows, Space selects, Enter opens");
await page.goto(`${BASE}/desk/sales-order`, { waitUntil: "domcontentloaded" });
const rows = page.locator("tbody tr[data-row]");
await rows.nth(1).waitFor({ timeout: 60000 });
await page.locator("body").click({ position: { x: 5, y: 500 } });
const focused = () => page.evaluate(() => document.activeElement?.closest("tr[data-row]")?.getAttribute("data-row") ?? null);
const r0 = await rows.nth(0).getAttribute("data-row");
const r1 = await rows.nth(1).getAttribute("data-row");
await page.keyboard.press("ArrowDown");
check((await focused()) === r0, `↓ focuses the first row (${await focused()})`);
await page.keyboard.press("ArrowDown");
check((await focused()) === r1, `↓ again focuses the second row (${await focused()})`);
await page.keyboard.press("ArrowUp");
check((await focused()) === r0, "↑ goes back");
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Space");
check(await rows.nth(1).locator("input[type=checkbox]").isChecked(), "Space selects the row");
await page.keyboard.press("Space");
await page.keyboard.press("Enter");
await page.waitForURL((u) => decodeURIComponent(u.pathname).endsWith(r1), { timeout: 30000 }).catch(() => {});
check(decodeURIComponent(new URL(page.url()).pathname).endsWith(r1), `Enter opens the row (${page.url()})`);

await t.finish();
