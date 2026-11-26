// Text / Small Text / Long Text, Button, Heading and the dialog Comment control like Desk (form/controls/text.js,
// button.js, heading.js, comment.js), on a throwaway submittable DocType:
//  - Small Text 150px, Text / Long Text 300px, max_height caps; read-only text keeps line breaks and indentation
//  - Heading is an <h4>; Button colour from button_color, title tooltip
//  - a Button runs its form handler; without one, the method in `options` (run_doc_method); it stays clickable
//    on a submitted document
//  - a dialog Comment field: "Comment" shows once there's text, Ctrl+Enter / the button hand the value to on_submit
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/controls4.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Crema Controls Four";
const q = (o) => encodeURIComponent(JSON.stringify(o));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function cleanup() {
  for (const d of (await api(`api/resource/${encodeURIComponent(DT)}?fields=${q(["name", "docstatus"])}&limit_page_length=50`).catch(() => null))?.data ?? []) {
    if (d.docstatus === 1) await post("frappe.client.cancel", { doctype: DT, name: d.name });
    await post("frappe.client.delete", { doctype: DT, name: d.name });
  }
  for (const d of (await api(`api/resource/Client Script?filters=${q([["dt", "=", DT]])}`).catch(() => null))?.data ?? []) await post("frappe.client.delete", { doctype: "Client Script", name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();

step("setup: submittable DocType + Form client script");
let r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, is_submittable: 1, autoname: "hash",
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data" },
      { fieldname: "shipping_heading", label: "Shipping Notes", fieldtype: "Heading" },
      { fieldname: "small_note", label: "Small Note", fieldtype: "Small Text" },
      { fieldname: "long_note", label: "Long Note", fieldtype: "Long Text", max_height: "120px" },
      { fieldname: "text_note", label: "Text Note", fieldtype: "Text" },
      { fieldname: "mark_done", label: "Mark Done", fieldtype: "Button", button_color: "Success" },
      { fieldname: "run_method", label: "Run Method", fieldtype: "Button", options: "crema_e2e_method" },
      { fieldname: "open_reply", label: "Open Reply", fieldtype: "Button" },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1 }],
  },
});
check(r.ok(), `DocType (${r.status()})`);
r = await post("frappe.client.insert", {
  doc: {
    doctype: "Client Script", name: `${DT} Form`, dt: DT, view: "Form", enabled: 1,
    script: `frappe.ui.form.on(${JSON.stringify(DT)}, {
  mark_done(frm) { frappe.show_alert({ message: "Mark Done ran on docstatus " + frm.doc.docstatus, indicator: "green" }); },
  open_reply(frm) {
    const d = new frappe.ui.Dialog({ title: "Reply", fields: [{ fieldtype: "Comment", fieldname: "reply", label: "Reply" }] });
    d.fields_dict.reply.on_submit = (v) => { frappe.show_alert({ message: "Replied: " + String(v).replace(/<[^>]+>/g, "").trim() }); d.hide(); };
    d.show();
  },
});`,
  },
});
check(r.ok(), `Client Script (${r.status()})`);

step("new document: text heights, heading, button look");
await page.goto(`${BASE}/desk/${slug(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("button", { name: "Mark Done" }).waitFor({ timeout: 90000 });
const h = async (label) => page.getByLabel(label, { exact: true }).evaluate((el) => Math.round(el.getBoundingClientRect().height));
check(Math.abs((await h("Small Note")) - 150) <= 2, `Small Text is 150px (${await h("Small Note")})`);
check(Math.abs((await h("Text Note")) - 300) <= 2, `Text is 300px (${await h("Text Note")})`);
check(Math.abs((await h("Long Note")) - 120) <= 2, `Long Text capped by max_height 120px (${await h("Long Note")})`);
check((await page.locator("h4", { hasText: "Shipping Notes" }).count()) === 1, "Heading renders as <h4>");
check((await page.getByRole("button", { name: "Mark Done" }).getAttribute("data-button-color")) === "Success", "button_color Success");
check((await page.getByRole("button", { name: "Mark Done" }).getAttribute("title")) === "Mark Done", "button title = label");
await shot("controls4_new");

step("Button with a form handler runs it");
await page.getByRole("button", { name: "Mark Done" }).click();
await page.getByText("Mark Done ran on docstatus 0").first().waitFor({ timeout: 15000 }).catch(() => {});
check(await page.getByText("Mark Done ran on docstatus 0").first().isVisible().catch(() => false), "mark_done handler ran");

step("Button without a handler calls its options method (run_doc_method)");
const call = page.waitForRequest((req) => req.url().includes("run_doc_method") && req.method() === "POST", { timeout: 15000 }).catch(() => null);
await page.getByRole("button", { name: "Run Method" }).click();
const req = await call;
const body = req ? req.postData() ?? "" : "";
check(!!req && body.includes("crema_e2e_method"), "run_doc_method called with method = options");

step("submitted document: text keeps whitespace, buttons stay clickable");
const text = "first line\n    indented line\nlast line";
const doc = (await (await post("frappe.client.insert", { doc: { doctype: DT, title: "Shown", small_note: text, long_note: Array.from({ length: 30 }, (_, i) => `row ${i + 1}`).join("\n") } })).json()).message;
await post("frappe.client.submit", { doc });
await page.goto(`${BASE}/desk/${slug(DT)}/${doc.name}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("button", { name: "Mark Done" }).waitFor({ timeout: 90000 });
const shown = page.getByRole("document", { name: "Small Note" });
check((await shown.innerText()) === text, "read-only Small Text keeps line breaks and indentation");
check((await shown.evaluate((el) => getComputedStyle(el).whiteSpace)) === "pre-wrap", "white-space pre-wrap");
const longBox = page.getByRole("document", { name: "Long Note" });
check((await longBox.evaluate((el) => el.scrollHeight > el.clientHeight && Math.round(el.getBoundingClientRect().height) <= 122)), "read-only Long Text capped by max_height and scrolls");
check(await page.getByRole("button", { name: "Mark Done" }).isEnabled(), "Button shown and enabled on a submitted doc");
await page.getByRole("button", { name: "Mark Done" }).click();
await page.getByText("Mark Done ran on docstatus 1").first().waitFor({ timeout: 15000 }).catch(() => {});
check(await page.getByText("Mark Done ran on docstatus 1").first().isVisible().catch(() => false), "handler runs on the submitted doc");
await shot("controls4_submitted");

step("dialog Comment control");
await page.getByRole("button", { name: "Open Reply" }).click();
const dialog = page.getByRole("dialog");
await dialog.waitFor({ timeout: 15000 });
check((await dialog.getByRole("button", { name: "Comment", exact: true }).count()) === 0, "no Comment button while empty");
const editor = dialog.locator(".ql-editor").first();
await editor.click();
await page.keyboard.type("Looks good");
await dialog.getByRole("button", { name: "Comment", exact: true }).waitFor({ timeout: 5000 }).catch(() => {});
check(await dialog.getByRole("button", { name: "Comment", exact: true }).isVisible().catch(() => false), "Comment button appears with text");
await page.keyboard.press("Control+Enter");
await page.getByText("Replied: Looks good").first().waitFor({ timeout: 10000 }).catch(() => {});
check(await page.getByText("Replied: Looks good").first().isVisible().catch(() => false), "Ctrl+Enter hands the value to on_submit");
check(!(await dialog.isVisible().catch(() => false)), "dialog closed by the handler");

check(errors.length === 0, `no page errors${errors.length ? ": " + errors.slice(0, 2).join(" | ") : ""}`);

step("cleanup");
await cleanup();
await t.finish();
