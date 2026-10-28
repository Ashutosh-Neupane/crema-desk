// Print Format Builder host (GAPS § 2.19 A): `?ui=desk` opens Desk's v16 builder full screen in Crema with one
// header, the frame follows Crema's light / dark theme, an emptied section can be removed (Desk hides the section
// toolbar in preview mode; Crema keeps it on the selected section), the letter head zone explains itself, and
// Save & Apply writes format_data.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/pfbuilder.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const PF = "Crema Test Builder";

const layout = {
  sections: [
    { label: "", columns: [{ label: "", fields: [{ label: "Customer", fieldname: "customer", fieldtype: "Link" }] }] },
    { label: "", columns: [{ label: "", fields: [{ label: "Note", fieldname: "custom_html_crema1", fieldtype: "HTML", html: "<p>Hello block</p>", custom: 1 }] }] },
  ],
  header: { columns: [{ label: "", fields: [] }] },
  footer: { columns: [{ label: "", fields: [] }] },
};
await post("frappe.client.delete", { doctype: "Print Format", name: PF }).catch(() => {});
await post("frappe.client.insert", {
  doc: { doctype: "Print Format", name: PF, doc_type: "Sales Order", standard: "No", print_format_builder_beta: 1, format_data: JSON.stringify(layout) },
});

step("?ui=desk → Desk's builder full screen");
await page.goto(`${BASE}/desk/print-format-builder/${encodeURIComponent(PF)}?ui=desk`, { waitUntil: "domcontentloaded", timeout: 180000 });
check(true, `opened ${decodeURIComponent(new URL(page.url()).pathname)}`);
const heading = page.getByRole("heading", { name: new RegExp(`Print Format Builder · ${PF}`) });
await heading.waitFor({ timeout: 90000 }).catch(() => {});
check(await heading.isVisible(), "one slim header with the format name");
check(!(await page.getByText("Frappe page", { exact: true }).count()), "no generic Frappe page bar");
const frame = page.frameLocator("iframe").first();
const hello = frame.getByText("Hello block").first();
await hello.waitFor({ timeout: 90000 });
await page.waitForTimeout(1500); // the builder wires its keyboard handler after the canvas renders

step("theme follows Crema");
const frameTheme = () => page.locator("iframe").first().evaluate((f) => f.contentDocument.documentElement.getAttribute("data-theme"));
for (const th of ["dark", "light"]) {
  await page.evaluate((v) => document.documentElement.setAttribute("data-theme", v), th);
  await page.waitForTimeout(300);
  check((await frameTheme()) === th, `frame is ${th} when Crema is ${th}`);
}

step("delete a block, then its emptied section");
// body sections only (header / footer zones can't be removed)
const bodySections = frame.locator(".sections-container .print-format-section-container");
const before = await bodySections.count();
await hello.click();
await page.keyboard.press("Delete");
await page.waitForTimeout(500);
const frameText = () => page.locator("iframe").first().evaluate((f) => f.contentDocument.body.innerText);
check(!(await frameText()).includes("Hello block"), "block removed");
// the emptied section is the last body section; select it by clicking its frame
const empty = bodySections.last();
await empty.click({ position: { x: 8, y: 8 } });
await page.waitForTimeout(400);
const remove = empty.getByTitle("Remove section");
check(await remove.isVisible(), "selected section shows its Remove button (preview mode)");
await shot("pfbuilder_section_selected", false);
await remove.click();
await page.waitForTimeout(500);
check((await bodySections.count()) === before - 1, `section removed (${before} → ${await bodySections.count()})`);

step("letter head zone explains itself");
const lh = frame.locator(".pfb-header-area .lh-zone").first();
if (await lh.count()) {
  await lh.click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(300);
  const after = await lh.evaluate((el) => getComputedStyle(el, "::after").content);
  check(/Letter Head/.test(after), "hint says it comes from the Letter Head");
} else check(true, "no letter head zone on this site");

step("Save & Apply → format_data");
await frame.getByRole("button", { name: "Save & Apply" }).click();
await page.waitForTimeout(3000);
const saved = (await api(`api/resource/Print Format/${encodeURIComponent(PF)}`)).data;
const data = JSON.parse(saved?.format_data || "{}");
check(data.sections?.length === 1 && !JSON.stringify(data).includes("Hello block"), `applied: ${data.sections?.length} section(s), block gone`);

step("back to the form");
await page.getByRole("link", { name: `Back to ${PF}` }).click();
await page.waitForURL(/\/desk\/doctype\/Print%20Format\//, { timeout: 30000 });
check(true, "back on the Print Format form");

step("cleanup");
await post("frappe.client.delete", { doctype: "Print Format", name: PF });
await t.finish();
