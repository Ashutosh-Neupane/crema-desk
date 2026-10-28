// Crema's Print Format Builder (GAPS § 2.19 B): "Edit Format" opens it; Delete removes a block and its emptied
// section in one go, with Undo / Redo; fields and blocks add from the left panel; the inspector edits them;
// columns change; edits autosave to the server draft (not printing) until Save & Apply; the preview is the
// server's own rendering of the draft; the sheet stays white in dark mode; Desk's builder stays one link away.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/pfnative.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const PF = "Crema Test Native";
const getPF = async () => (await api(`api/resource/Print Format/${encodeURIComponent(PF)}`)).data;

const layout = {
  sections: [
    { label: "", columns: [{ label: "", fields: [{ label: "Customer", fieldname: "customer", fieldtype: "Link", options: "Customer" }] }] },
    { label: "", columns: [{ label: "", fields: [{ label: "Note", fieldname: "custom_html_crema2", fieldtype: "HTML", html: "<p>Hello block</p>", custom: 1 }] }] },
  ],
  header: { columns: [{ label: "", fields: [] }] },
  footer: { columns: [{ label: "", fields: [] }] },
};
await post("frappe.client.delete", { doctype: "Print Format", name: PF }).catch(() => {});
await post("frappe.client.insert", {
  doc: { doctype: "Print Format", name: PF, doc_type: "Sales Order", standard: "No", print_format_builder_beta: 1, format_data: JSON.stringify(layout) },
});

const paper = page.getByRole("document", { name: "Print layout" });
const body = paper.locator('[data-pfb-section]:not([data-pfb-section="header"]):not([data-pfb-section="footer"])');
const status = page.getByRole("status").filter({ hasText: /Saved|Draft|Unsaved|Saving|Not saved/ });

step("Edit Format → Crema's builder");
await page.goto(`${BASE}/desk/doctype/Print%20Format/${encodeURIComponent(PF)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("button", { name: "Edit Format" }).click({ timeout: 90000 });
await page.waitForURL(/\/desk\/print-format-builder\/[^?]+$/, { timeout: 30000 });
await paper.waitFor({ timeout: 90000 });
check(await page.getByRole("heading", { name: new RegExp(`Print Format Builder · ${PF}`) }).isVisible(), "one header with the format name");
check(!(await page.locator("iframe").count()), "no Desk frame");
check((await body.count()) === 2, `two body sections (${await body.count()})`);
check((await paper.getByText("Hello block").isVisible()) && !(await paper.getByText("<p>").count()), "HTML block renders, no raw tags");
await shot("pfnative_open", false);

step("Delete removes the block and its emptied section; Undo / Redo");
await page.getByRole("option", { name: "Field Note" }).click();
check(await page.getByText("Field · HTML").isVisible(), "inspector shows the selected HTML block");
await page.keyboard.press("Delete");
await page.waitForTimeout(300);
check((await body.count()) === 1, "block and its section removed");
check(await page.getByText("Field and its empty section removed").isVisible(), "toast says what happened");
await page.keyboard.press("Control+z");
await page.waitForTimeout(300);
check((await body.count()) === 2 && (await paper.getByText("Hello block").isVisible()), "Ctrl+Z brings both back");
await page.keyboard.press("Control+Shift+z");
await page.waitForTimeout(300);
check((await body.count()) === 1 && !(await paper.getByText("Hello block").count()), "Ctrl+Shift+Z removes them again");

step("add a field and a text block");
await page.getByRole("option", { name: "Field Customer" }).click();
await page.getByRole("textbox", { name: "Search fields" }).fill("delivery date");
await page.getByRole("button", { name: /^Delivery Date/ }).first().click();
check(await page.getByRole("option", { name: "Field Delivery Date" }).isVisible(), "Delivery Date added after the selected field");
await page.getByRole("tab", { name: "blocks" }).click();
await page.getByRole("button", { name: /^Text Fixed text/ }).click();
await page.getByRole("textbox", { name: "Text", exact: true }).fill("Thank you for your order");
check(await paper.getByText("Thank you for your order").isVisible(), "text block shows the typed text");

step("columns");
await body.first().click({ position: { x: 6, y: 6 } });
await page.getByRole("button", { name: "2 columns" }).click();
check((await page.getByRole("button", { name: "2 columns" }).getAttribute("aria-pressed")) === "true", "section has 2 columns");

step("page settings");
await page.keyboard.press("Escape");
await page.getByRole("spinbutton", { name: "Margin top" }).fill("20");
const pad = await paper.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
check(Math.abs(pad - 75.6) < 1, `top margin 20mm on the sheet (${pad}px)`);

step("autosave → draft, not printing");
await page.waitForTimeout(2500);
check(/Draft saved/.test(await status.innerText()), `status: ${await status.innerText()}`);
let pf = await getPF();
check(String(pf.draft_data).includes("Thank you for your order"), "draft_data has the edit");
check(!String(pf.format_data).includes("Thank you") && String(pf.format_data).includes("Hello block"), "format_data (what prints) unchanged");

step("dark mode keeps the sheet white");
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await page.waitForTimeout(400);
check((await paper.evaluate((el) => getComputedStyle(el).backgroundColor)) === "rgb(255, 255, 255)", "paper is white");
await shot("pfnative_dark", false);
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));

step("preview = the server's rendering of the draft");
await page.getByRole("tab", { name: "Preview" }).click();
const preview = page.frameLocator('iframe[title="Print preview"]');
const hasSO = !(await page.getByText(/No Sales Order to preview/).count());
if (hasSO) {
  await preview.getByText("Thank you for your order").waitFor({ timeout: 60000 });
  check(true, "preview shows the unsaved text block");
  await shot("pfnative_preview", false);
} else check(true, "no Sales Order on this site to preview with");
await page.getByRole("tab", { name: "Edit" }).click();

step("Save & Apply");
await page.getByRole("button", { name: "Save & Apply" }).click();
await page.getByText("Applied: prints use this layout now").waitFor({ timeout: 30000 });
pf = await getPF();
const fd = JSON.parse(pf.format_data || "{}");
const flat = JSON.stringify(fd);
check(flat.includes("Thank you for your order") && flat.includes("delivery_date") && !flat.includes("Hello block"), "format_data has the new layout");
check(fd.sections?.[0]?.columns?.length === 2, "two columns saved");
check(Number(pf.margin_top) === 20, `margin_top saved (${pf.margin_top})`);
check(!pf.draft_data, "draft cleared");

step("reload keeps it; Desk builder one link away");
await page.reload({ waitUntil: "domcontentloaded" });
await paper.getByText("Thank you for your order").waitFor({ timeout: 90000 });
check(/^Saved/.test(await status.innerText()), "reopened as Saved");
await page.getByRole("link", { name: /Desk builder/ }).click();
await page.waitForURL(/ui=desk/, { timeout: 30000 });
await page.locator("iframe").first().waitFor({ timeout: 60000 });
check(true, "?ui=desk frames Desk's builder");

step("cleanup");
await post("frappe.client.delete", { doctype: "Print Format", name: PF });
await t.finish();
