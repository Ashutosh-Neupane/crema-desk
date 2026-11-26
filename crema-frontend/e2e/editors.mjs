// Code-type controls like Desk (form/controls/code.js, markdown_editor.js, html_editor.js, json.js):
// 300px with Expand / Collapse; Markdown Preview through frappe.markdown (showdown + Desk's sanitizer) and HTML
// Preview without scripts; JSON shows parse errors and saves the text; read-only Code has Copy to Clipboard;
// set_df_property(f, "autocompletions", …) offers completions; frappe.markdown works in app scripts.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/editors.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Crema Editors Doc";
const SCRIPT = "Crema Editors Script";
const mod = process.platform === "darwin" ? "Meta" : "Control";

async function cleanup() {
  await post("frappe.client.delete", { doctype: "Client Script", name: SCRIPT });
  const docs = await api(`api/resource/${encodeURIComponent(DT)}?limit_page_length=100`).catch(() => null);
  for (const d of docs?.data ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();

step("setup: Code (Python), Markdown, HTML, JSON, read-only Code; a script adding completions and using frappe.markdown");
let r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash",
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
      { fieldname: "code", label: "Code", fieldtype: "Code", options: "Python" },
      { fieldname: "md", label: "Notes", fieldtype: "Markdown Editor" },
      { fieldname: "page_html", label: "Page HTML", fieldtype: "HTML Editor" },
      { fieldname: "settings_json", label: "Settings JSON", fieldtype: "JSON" },
      { fieldname: "md_out", label: "Markdown Out", fieldtype: "Small Text" },
      { fieldname: "snippet", label: "Snippet", fieldtype: "Code", read_only: 1, default: "print('hello')" },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
check(r.ok(), `DocType (${r.status()})`);
r = await post("frappe.client.insert", {
  doc: {
    doctype: "Client Script", name: SCRIPT, dt: DT, view: "Form", enabled: 1,
    script: `frappe.ui.form.on(${JSON.stringify(DT)}, {
  onload(frm) {
    frm.set_df_property("code", "autocompletions", ["frappe.db.get_value", "frappe.db.set_value", { value: "frappe.qb", meta: "query builder" }]);
    if (frm.is_new()) frm.set_value("md_out", frappe.markdown("**x** <script>y</script>"));
  },
});`,
  },
});
check(r.ok(), `Client Script (${r.status()})`);
await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });

await page.goto(`${BASE}/desk/${slug(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${DT}` }).waitFor({ timeout: 90000 });
await page.getByRole("textbox", { name: /^Title/ }).fill("Editors");
const box = (f) => page.locator(`[data-fieldname="${f}"] .cm-content`);
const editor = (f) => page.locator(`[data-fieldname="${f}"] .cm-editor`);
await box("code").waitFor({ timeout: 30000 });

step("Code: 300px, Expand → 600px, Collapse");
const h = async (f) => Math.round((await editor(f).boundingBox()).height);
check(Math.abs((await h("code")) - 300) <= 2, `300px (${await h("code")})`);
const expand = page.locator('[data-code-field="code"]').getByRole("button", { name: "Expand" });
await expand.click();
check(Math.abs((await h("code")) - 600) <= 2, `Expand → 600px (${await h("code")})`);
await page.locator('[data-code-field="code"]').getByRole("button", { name: "Collapse" }).click();

step("Code: completions from the script (set_df_property autocompletions)");
await box("code").click();
await page.keyboard.type("frappe.db.g");
const ac = page.locator(".cm-tooltip-autocomplete");
await ac.waitFor({ timeout: 10000 });
check((await ac.innerText()).includes("frappe.db.get_value"), `offered frappe.db.get_value (${(await ac.innerText()).replace(/\n/g, " | ")})`);
await page.keyboard.press("Enter");
await page.keyboard.insertText("('User', 'Administrator')");
check((await box("code").innerText()).includes("frappe.db.get_value('User', 'Administrator')"), "completion inserted");

step("Markdown: Preview through frappe.markdown, scripts removed; Edit returns");
await box("md").click();
await page.keyboard.insertText("# Notes\n\nSome **bold** and a [link](https://example.com)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>window.__md = 1</script>");
const mdWrap = page.locator(`[data-code-field="md"]`);
await mdWrap.getByRole("button", { name: "Preview" }).click();
const prev = page.getByRole("document", { name: "Notes preview" });
check((await prev.locator("h1").innerText()) === "Notes" && (await prev.locator("strong").innerText()) === "bold", "heading and bold rendered");
check((await prev.locator("a").getAttribute("target")) === "_blank" && (await prev.locator("table td").count()) === 2, "link opens a new tab; table rendered");
check(!(await prev.innerHTML()).includes("<script") && !(await page.evaluate(() => window.__md)), "script not kept, not run");
await shot("editors_md_preview", false);
await mdWrap.getByRole("button", { name: "Edit" }).click();
await box("md").waitFor({ timeout: 5000 });

step("HTML Editor: code, Preview without scripts");
await box("page_html").click();
await page.keyboard.insertText('<h2>Hi</h2><p style="color:red">there</p><script>window.__html = 1</script>');
const htmlWrap = page.locator(`[data-code-field="page_html"]`);
await htmlWrap.getByRole("button", { name: "Preview" }).click();
const hp = page.getByRole("document", { name: "Page HTML preview" });
check((await hp.locator("h2").innerText()) === "Hi" && !(await hp.innerHTML()).includes("<script") && !(await page.evaluate(() => window.__html)), "rendered, script removed");
await htmlWrap.getByRole("button", { name: "Edit" }).click();

step("JSON: parse error shown, then fixed");
await box("settings_json").click();
await page.keyboard.insertText('{"a": 1,');
const jsonAlert = page.locator('[data-code-field="settings_json"]').getByRole("alert");
await jsonAlert.waitFor({ timeout: 5000 });
check((await jsonAlert.innerText()).startsWith("Invalid JSON"), `error shown (${await jsonAlert.innerText()})`);
await page.keyboard.press("Backspace");
await page.keyboard.insertText("}");
await page.waitForTimeout(300);
check(!(await jsonAlert.count()), "error gone once valid");

step("frappe.markdown in a script");
const mdOut = await page.getByRole("textbox", { name: "Markdown Out" }).inputValue();
check(mdOut.includes("<strong>x</strong>") && !mdOut.includes("<script"), `frappe.markdown → ${mdOut}`);

step("read-only Code: Copy to Clipboard");
await page.getByRole("button", { name: "Copy to Clipboard" }).click();
check((await page.evaluate(() => navigator.clipboard.readText())) === "print('hello')", "copied");
await shot("editors_filled", false);

step("save → text stored as typed");
await page.keyboard.press(`${mod}+s`);
await page.waitForURL(new RegExp(`${slug(DT)}/(?!new)`), { timeout: 30000 });
const name = decodeURIComponent(page.url().split("/").pop());
const d = (await api(`api/resource/${encodeURIComponent(DT)}/${name}`)).data;
check(d.code === "frappe.db.get_value('User', 'Administrator')", `code (${JSON.stringify(d.code)})`);
check(d.md.startsWith("# Notes\n\nSome **bold**"), "markdown saved as markdown");
check(d.page_html.startsWith("<h2>Hi</h2>"), "HTML saved as code");
check(JSON.stringify(typeof d.settings_json === "string" ? JSON.parse(d.settings_json) : d.settings_json) === '{"a":1}', `JSON saved (${JSON.stringify(d.settings_json)})`);

step("reopen: not dirty");
await page.reload({ waitUntil: "domcontentloaded" });
await box("code").waitFor({ timeout: 90000 });
await page.waitForTimeout(1500);
check(!(await page.getByText("Not Saved").isVisible()), "opening leaves it clean");

step("cleanup");
await cleanup();
await t.finish();
