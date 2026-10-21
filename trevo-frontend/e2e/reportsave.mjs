// Query report "Save As" (query_report.save_report → Custom Report) + "PDF" (report_to_pdf).
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/reportsave.mjs
import fs from "node:fs";
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const BASE_REPORT = "Sales Order Analysis";
const NAME = `Trevo Saved ${Date.now() % 100000}`;
const enc = encodeURIComponent;
const del = async (n) => page.request.delete(`${BASE}/api/frappe/api/resource/Report/${enc(n)}`).catch(() => null);
const getReport = async (n) => (await page.request.get(`${BASE}/api/frappe/api/resource/Report/${enc(n)}`)).json();

// clean leftovers from earlier runs
const old = await (await page.request.get(`${BASE}/api/frappe/api/resource/Report?filters=${enc(JSON.stringify([["name", "like", "Trevo Saved %"]]))}&limit_page_length=100`)).json();
for (const r of old.data ?? []) await del(r.name);

try {
  step(`open ${BASE_REPORT}, set a filter`);
  await page.goto(`${BASE}/desk/query-report/${enc(BASE_REPORT)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("heading", { name: BASE_REPORT, exact: true }).waitFor({ timeout: 90000 });
  await page.locator("tbody tr").first().waitFor({ timeout: 90000 });
  const from = page.getByLabel("From Date").first();
  await from.fill("2026-01-01");
  await from.press("Enter");
  await page.waitForTimeout(2500);

  step("Save As");
  await page.getByRole("button", { name: "Save As" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Report Name").fill(NAME);
  await dlg.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(new RegExp(`/desk/query-report/${enc(NAME).replace(/%20/g, "(%20|\\+)")}`), { timeout: 60000 });
  check(true, "routed to the new custom report");

  const rep = (await getReport(NAME)).data;
  check(rep?.report_type === "Custom Report", `report_type = ${rep?.report_type}`);
  check(rep?.reference_report === BASE_REPORT, `reference_report = ${rep?.reference_report}`);
  check(rep?.is_standard === "No", `is_standard = ${rep?.is_standard}`);
  const json = JSON.parse(rep?.json ?? "{}");
  check(json.filters?.from_date === "2026-01-01", `saved filters.from_date = ${json.filters?.from_date}`);
  check(Array.isArray(json.columns) && json.columns.length > 3, `saved columns (${json.columns?.length})`);

  step("saved report opens with its filters applied");
  await page.getByRole("heading", { name: NAME, exact: true }).waitFor({ timeout: 60000 });
  await page.locator("tbody tr").first().waitFor({ timeout: 90000 });
  await page.waitForFunction(() => document.querySelector("#qr-filter-from_date")?.value || document.querySelector("input[aria-label='From Date'], input[id*='from_date']")?.value, null, { timeout: 30000 }).catch(() => {});
  check((await page.getByLabel("From Date").first().inputValue()) === "2026-01-01", "From Date filter restored from the saved report");
  check((await page.locator("tbody tr").count()) > 0, "rows rendered for the custom report");
  await shot("report_saved_custom");

  step("PDF");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const pdlg = page.getByRole("dialog");
  await pdlg.getByText("PDF Settings").waitFor();
  check(await pdlg.getByLabel("Orientation").isVisible(), "orientation choice shown");
  const [resp, dl] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("report_to_pdf"), { timeout: 120000 }),
    page.waitForEvent("download", { timeout: 120000 }),
    pdlg.getByRole("button", { name: "Download PDF" }).click(),
  ]);
  check(resp.status() === 200 && /pdf/.test(resp.headers()["content-type"] ?? ""), `report_to_pdf -> ${resp.status()} ${resp.headers()["content-type"]}`);
  const buf = fs.readFileSync(await dl.path());
  check(buf.subarray(0, 5).toString() === "%PDF-" && buf.length > 2000, `PDF file ${dl.suggestedFilename()} (${buf.length} bytes)`);
  fs.writeFileSync(`${process.env.OUT ?? "."}/report_saved.pdf`, buf);
} finally {
  await del(NAME);
  const gone = await page.request.get(`${BASE}/api/frappe/api/resource/Report/${enc(NAME)}`);
  check(gone.status() === 404, "saved Report deleted");
}

await t.finish();
