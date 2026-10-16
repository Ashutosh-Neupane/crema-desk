// Client Script + Server Script behaviour on Sales Order through Trevo, verified on the server.
// Creates the scripts, exercises them in the UI, then removes them.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/scripts.salesorder.mjs
// Requires `server_script_enabled: 1` in the site config.
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const CS = "Trevo E2E SO Client";
const SS_SET = "Trevo E2E SO Before Validate";
const SS_BLOCK = "Trevo E2E SO Block";

async function cleanup() {
  for (const [dt, n] of [["Client Script", CS], ["Server Script", SS_SET], ["Server Script", SS_BLOCK]]) {
    await post("frappe.client.delete", { doctype: dt, name: n }).catch(() => {});
  }
}
await cleanup();

step("create Client Script + Server Scripts on the backend");
const clientJs = `
frappe.ui.form.on("Sales Order", {
  refresh(frm) {
    frm.set_intro("Trevo client script active");
    frm.add_custom_button("Ping", () => frappe.msgprint("pong from client script"), "Trevo");
  },
  customer(frm) {
    if (frm.doc.customer) frm.set_value("po_no", "CS-" + frm.doc.customer.slice(0, 3).toUpperCase());
  },
  validate(frm) {
    if (frm.doc.po_no === "BLOCK") frappe.throw("PO BLOCK is not allowed (client validate)");
  },
});
frappe.ui.form.on("Sales Order Item", {
  qty(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    if (row.qty > 100) {
      frappe.model.set_value(cdt, cdn, "qty", 100);
      frappe.show_alert("Max 100 per line");
    }
  },
});`;
let r = await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: "Sales Order", view: "Form", enabled: 1, script: clientJs } });
check(r.ok(), `Client Script created (${r.status()})`);
r = await post("frappe.client.insert", {
  doc: {
    doctype: "Server Script", name: SS_SET, script_type: "DocType Event", reference_doctype: "Sales Order",
    doctype_event: "Before Validate", enabled: 1,
    script: "if doc.po_no and not doc.po_date:\n    doc.po_date = frappe.utils.nowdate()\n",
  },
});
check(r.ok(), `Server Script (Before Validate) created (${r.status()})`);
r = await post("frappe.client.insert", {
  doc: {
    doctype: "Server Script", name: SS_BLOCK, script_type: "DocType Event", reference_doctype: "Sales Order",
    doctype_event: "Before Save", enabled: 1,
    script: "if doc.po_no == 'SERVER':\n    frappe.throw('Blocked by server script')\n",
  },
});
check(r.ok(), `Server Script (Before Save) created (${r.status()})`);

step("new Sales Order: refresh handler ran");
await page.goto(`${BASE}/desk/doctype/Sales%20Order/new`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "New Sales Order" }).waitFor({ timeout: 90000 });
await page.waitForTimeout(1500);
check(await page.getByText("Trevo client script active").isVisible(), "frm.set_intro shown");
await page.getByRole("button", { name: /^Trevo/ }).click();
await page.getByRole("menuitem", { name: "Ping" }).click();
await page.waitForTimeout(800);
check(await page.getByText("pong from client script").first().isVisible(), "custom button → frappe.msgprint");

step("customer change handler sets po_no");
const cust = page.getByRole("combobox", { name: /^Customer/ }).first();
await cust.click();
await cust.fill("Pokhara");
await page.getByRole("option", { name: /Pokhara Supplies/ }).first().click();
await page.waitForTimeout(2500);
// po_no lives on another tab — Ctrl/⌘+J (jump to field) switches to it
const jumpTo = async (label) => {
  await page.keyboard.press("Meta+j");
  await page.getByPlaceholder("Jump to field…").fill(label);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
};
await jumpTo("Customer's Purchase Order");
const po = page.getByRole("textbox", { name: /^Customer's Purchase Order$/ }).first();
check((await po.inputValue()) === "CS-POK", `po_no = ${await po.inputValue()}`);
const backToDetails = () => page.getByRole("tab", { name: "Details" }).click();
await backToDetails();

step("child qty handler caps at 100");
const dd = page.getByRole("textbox", { name: /^Delivery Date/ }).first();
await dd.click();
await dd.fill(new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10));
await dd.press("Enter");
const row = page.locator("[aria-label^='Select row']").first().locator("xpath=ancestor::div[contains(@class,'grid')][1]");
const item = row.locator("input").nth(1);
await item.click();
await item.fill("SUGAR");
await page.getByRole("option", { name: /SUGAR-1/ }).first().click();
await page.waitForTimeout(2500);
const qty = page.getByLabel("Quantity", { exact: true }).first();
await qty.click();
await qty.fill("150");
await qty.press("Enter");
await page.waitForTimeout(1500);
check((await qty.inputValue()) === "100", `qty clamped to ${await qty.inputValue()}`);
check(await page.getByText("Max 100 per line").first().isVisible(), "frappe.show_alert shown");

step("client validate blocks save");
await jumpTo("Customer's Purchase Order");
await po.fill("BLOCK");
await po.press("Tab");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForTimeout(1500);
check(await page.getByText(/PO BLOCK is not allowed/).first().isVisible(), "frappe.throw message shown");
check(page.url().endsWith("/new"), "not saved");

step("server Before Save blocks save");
await jumpTo("Customer's Purchase Order");
await po.fill("SERVER");
await po.press("Tab");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForTimeout(2500);
const serverMsg = await page.getByText(/Blocked by server script/).first().isVisible();
if (!serverMsg) {
  await shot("so_server_block_debug", false);
  console.log("TOASTS:", await page.locator("[data-sonner-toast]").allInnerTexts());
  console.log("DIALOGS:", await page.locator("[role=dialog]").allInnerTexts());
}
check(serverMsg, "server frappe.throw message shown");
check(page.url().endsWith("/new"), "still not saved");

step("valid save → server Before Validate sets po_date");
await jumpTo("Customer's Purchase Order");
await po.fill("CS-POK");
await po.press("Tab");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForURL(/Sales%20Order\/SAL-ORD-/, { timeout: 30000 });
const name = decodeURIComponent(page.url().split("/").pop());
const so = (await api(`api/resource/Sales Order/${encodeURIComponent(name)}`)).data;
const today = new Date().toISOString().slice(0, 10);
check(so?.po_no === "CS-POK", `saved po_no ${so?.po_no}`);
check(!!so?.po_date, `po_date set by server script (${so?.po_date}, today ${today})`);
check(so?.items?.[0]?.qty === 100, `server kept clamped qty ${so?.items?.[0]?.qty}`);
await shot("so_scripts_saved");

step("cleanup");
await post("frappe.client.delete", { doctype: "Sales Order", name });
await cleanup();
await t.finish();
