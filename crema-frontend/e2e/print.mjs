// Print view: open from the form, switch print format + letterhead, preview renders, PDF downloads.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/print.mjs
import fs from "node:fs";
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const SO = "SAL-ORD-2026-00003";

step("form → Print");
await page.goto(`${BASE}/desk/doctype/Sales%20Order/${SO}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("link", { name: "Print" }).click({ timeout: 90000 });
await page.waitForURL(/\/desk\/print\/Sales%20Order\//, { timeout: 30000 });
const preview = page.frameLocator(`iframe[title="Print preview of ${SO}"]`);
const body = preview.locator("body");
await body.waitFor({ timeout: 60000 });
await page.waitForFunction(() => /SAL-ORD-/.test(document.querySelector("iframe")?.contentDocument?.body?.innerText ?? ""), null, { timeout: 60000 });
check((await body.innerText()).includes(SO), "standard print shows the document");
const styled = await page.evaluate(() => [...(document.querySelector("iframe")?.contentDocument?.styleSheets ?? [])].some((s) => { try { return s.href?.includes("/assets/") && s.cssRules.length > 0; } catch { return false; } }));
check(styled, "Frappe print CSS loaded through /assets");

step("switch format + letterhead");
await page.getByLabel("Print format").selectOption("Sales Order Classic");
await page.getByLabel("Letter head").selectOption("Company Letterhead");
await page.waitForTimeout(3000);
check((await body.innerText()).includes(SO), "Classic format renders");
await shot("print_view", false);

step("PDF: a format whose generator is missing shows the server error");
await page.getByRole("button", { name: "PDF" }).click();
await page.getByText(/PDF failed:/).first().waitFor({ timeout: 60000 });
check(true, `error shown: ${(await page.getByText(/PDF failed:/).first().innerText()).slice(0, 80)}`);

step("PDF download (Standard + letterhead)");
await page.getByLabel("Print format").selectOption("Standard");
await page.waitForTimeout(1500);
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.getByRole("button", { name: "PDF" }).click()]);
const file = await dl.path();
const head = fs.readFileSync(file).subarray(0, 5).toString();
check(head === "%PDF-", `PDF file (${dl.suggestedFilename()}, ${fs.statSync(file).size} bytes)`);

await t.finish();
