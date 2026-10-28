// Form dashboard for scripts (Desk form/dashboard.js + layout.show_message): set_intro (replaces its own), headlines
// (permanent / dismissible / add_comment that expires), add_indicator, add_progress, add_section (a real node the
// script fills with jQuery), reset on every refresh (no duplicates after save), and Desk's "Submit this document
// to confirm" for a saved draft of a submittable doctype.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/dashboard.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const DT = "Crema Dash Test";
const CS = "Crema Dash Test CS";
async function cleanup() {
  await post("frappe.client.delete", { doctype: "Client Script", name: CS });
  for (const d of (await post("frappe.client.get_list", { doctype: DT, fields: ["name", "docstatus"] }).catch(() => [])) ?? []) {
    if (d.docstatus === 1) await post("frappe.client.cancel", { doctype: DT, name: d.name });
    await post("frappe.client.delete", { doctype: DT, name: d.name });
  }
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();
await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, is_submittable: 1, autoname: "hash", fields: [
  { fieldname: "qty", label: "Qty", fieldtype: "Int" },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1 }] } });
await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: DT, view: "Form", enabled: 1, script: `
frappe.ui.form.on("${DT}", { refresh(frm) {
  if (frm.is_new()) return;
  frm.set_intro("Intro one", "yellow");
  frm.set_intro("Intro two", "orange");
  frm.dashboard.set_headline("Permanent alert", "red", true);
  frm.dashboard.add_comment("Temporary comment", "green");
  frm.dashboard.add_indicator(__("Qty: {0}", [frm.doc.qty]), frm.doc.qty > 5 ? "green" : "red");
  frm.dashboard.add_progress("Delivered", 40, "40% delivered");
  const $body = frm.dashboard.add_section("<div class='crema-sec'>Section body</div>", "Custom Info");
  $body.find(".crema-sec").css("font-weight", "700");
  $body.append("<span class='crema-js'>added by jQuery</span>");
  frm.add_custom_button("Bump", () => { frm.set_value("qty", (frm.doc.qty || 0) + 10); frm.save(); });
} });` } });
const rec = await post("frappe.client.insert", { doc: { doctype: DT, qty: 3 } });
const main = page.locator("#main-content");

step("headlines");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/${rec.name}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await main.getByText("Intro two").waitFor({ timeout: 90000 });
check(!(await main.getByText("Intro one").count()), "set_intro replaces its previous intro");
check(await main.getByText("Submit this document to confirm").isVisible(), "Desk's submit message for a saved draft");
const permanent = main.getByRole("status").filter({ hasText: "Permanent alert" });
check(await permanent.isVisible() && !(await permanent.getByRole("button", { name: "Dismiss message" }).count()), "permanent headline has no dismiss");
check((await permanent.getAttribute("class"))?.includes("red") ?? false, "headline colour (red)");
check(await main.getByText("Temporary comment").isVisible(), "add_comment shown");

step("indicators, progress, section");
const dash = main.getByRole("region", { name: "Dashboard" });
check((await dash.getByRole("list", { name: "Indicators" }).innerText()).includes("Qty: 3"), "indicator text");
check((await dash.locator("li span.bg-red-500").count()) === 1, "indicator colour (red for qty ≤ 5)");
const bar = dash.getByRole("progressbar", { name: "Delivered" });
check((await bar.getAttribute("aria-valuenow")) === "40", "progress 40%");
check(await dash.getByText("40% delivered").isVisible(), "progress message");
check(await dash.getByText("Custom Info").isVisible() && (await dash.getByText("Section body").isVisible()), "section label + body");
check((await dash.locator(".crema-sec").evaluate((el) => getComputedStyle(el).fontWeight)) === "700", "script styled its section with jQuery");
check(await dash.getByText("added by jQuery").isVisible(), "script appended into its section");
await shot("form_dashboard");

step("dismiss and expiry");
await main.getByRole("status").filter({ hasText: "Intro two" }).getByRole("button", { name: "Dismiss message" }).click();
check(!(await main.getByText("Intro two").count()), "intro dismissed");
await page.waitForTimeout(10_500);
check(!(await main.getByText("Temporary comment").count()), "add_comment cleared after 10 s");

step("refresh after save resets the dashboard");
await main.getByRole("button", { name: "Bump", exact: true }).click();
await page.waitForFunction(() => document.querySelector("#main-content")?.textContent?.includes("Qty: 13"), null, { timeout: 30000 });
check((await dash.locator("ul[aria-label=Indicators] li").count()) === 1, "one indicator after save (no duplicates)");
check((await dash.locator("li span.bg-emerald-500").count()) === 1, "indicator now green (qty 13)");
check((await dash.getByRole("progressbar").count()) === 1 && (await dash.getByText("Custom Info").count()) === 1, "one progress bar, one section");
check((await main.getByText("Intro two").count()) === 1, "intro set again by the refresh");

step("submitted: no submit message");
const doc = await post("frappe.client.get", { doctype: DT, name: rec.name });
await post("frappe.client.submit", { doc });
await page.reload({ waitUntil: "domcontentloaded" });
await main.getByText("Intro two").waitFor({ timeout: 60000 });
check(!(await main.getByText("Submit this document to confirm").count()), "message gone once submitted");

step("cleanup");
await cleanup();
await t.finish();
