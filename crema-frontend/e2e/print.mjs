// Print view: open from the form, switch print format + letterhead, preview renders, PDF downloads.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/print.mjs
import fs from "node:fs";
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
// any Sales Order and Letter Head on the site; skipped when there is none
const SO = (await api("api/resource/Sales%20Order?limit_page_length=1&order_by=creation%20desc")).data?.[0]?.name;
const LH = (await api("api/resource/Letter%20Head?limit_page_length=1")).data?.[0]?.name;
const formats = ((await api(`api/resource/Print%20Format?filters=${encodeURIComponent(JSON.stringify([["doc_type", "=", "Sales Order"], ["disabled", "=", 0]]))}&limit_page_length=20`)).data ?? []).map((f) => f.name);
if (!SO) {
  console.log("SKIPPED: no Sales Order on this site");
  await t.finish();
  process.exit(0);
}
console.log(`  data: ${SO}, formats ${JSON.stringify(formats)}, letter head ${LH}`);

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

const FMT = formats[0];
step(`switch format (${FMT ?? "none"}) + letterhead (${LH ?? "none"})`);
if (FMT) await page.getByLabel("Print format").selectOption(FMT);
if (LH) await page.getByLabel("Letter head").selectOption(LH);
await page.waitForTimeout(3000);
check((await body.innerText()).includes(SO), `${FMT ?? "Standard"} format renders`);
await shot("print_view", false);

if (FMT) {
  step(`PDF of ${FMT}: a file, or the server's error shown (a format may need a PDF generator the site lacks)`);
  const outcome = await Promise.race([
    page.waitForEvent("download", { timeout: 90000 }).then(async (d) => `pdf:${fs.readFileSync(await d.path()).subarray(0, 5).toString()}`),
    page.getByText(/PDF failed:/).first().waitFor({ timeout: 90000 }).then(async () => `error:${(await page.getByText(/PDF failed:/).first().innerText()).slice(0, 80)}`),
    page.getByRole("button", { name: "PDF" }).click().then(() => new Promise(() => {})),
  ]);
  check(outcome === "pdf:%PDF-" || outcome.startsWith("error:PDF failed:"), `outcome ${outcome}`);
}

step("PDF download (Standard + letterhead)");
await page.getByLabel("Print format").selectOption("Standard");
await page.waitForTimeout(1500);
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.getByRole("button", { name: "PDF" }).click()]);
const file = await dl.path();
const head = fs.readFileSync(file).subarray(0, 5).toString();
check(head === "%PDF-", `PDF file (${dl.suggestedFilename()}, ${fs.statSync(file).size} bytes)`);

await t.finish();
