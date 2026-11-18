// Text Editor like Desk (form/controls/text_editor.js, Quill 2): Desk's toolbar with named buttons, bold, bullet
// list saved as <ul>, table (table-bordered), paste cleaned by Quill's clipboard (no script / Word styles), image
// inserted inline and turned into a File by Frappe on save, the value wrapped in .ql-editor.read-mode like Desk;
// opening a saved document doesn't make it dirty; read-only shows the HTML.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/texteditor.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Crema Note Doc";
const mod = process.platform === "darwin" ? "Meta" : "Control";

async function cleanup() {
  const docs = await api(`api/resource/${encodeURIComponent(DT)}?limit_page_length=100`).catch(() => null);
  for (const d of docs?.data ?? []) {
    const files = await api(`api/resource/File?filters=${encodeURIComponent(JSON.stringify([["attached_to_doctype", "=", DT], ["attached_to_name", "=", d.name]]))}`).catch(() => null);
    for (const f of files?.data ?? []) await post("frappe.client.delete", { doctype: "File", name: f.name });
    await post("frappe.client.delete", { doctype: DT, name: d.name });
  }
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();

step("setup: a DocType with an editable and a read-only Text Editor");
const r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash",
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
      { fieldname: "body", label: "Body", fieldtype: "Text Editor" },
      { fieldname: "terms", label: "Terms", fieldtype: "Text Editor", read_only: 1, default: "<p>Pay within <strong>30 days</strong></p><ul><li>Net</li></ul>" },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
check(r.ok(), `DocType (${r.status()})`);

await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${DT}` }).waitFor({ timeout: 90000 });
await page.getByRole("textbox", { name: /^Title/ }).fill("Rich note");
const body = page.getByRole("textbox", { name: "Body" });
await body.waitFor({ timeout: 30000 });
const bar = page.getByRole("toolbar", { name: "Body formatting" });

step("Desk's toolbar, with names");
for (const name of ["Text style", "Font size", "Bold", "Italic", "Underline", "Strikethrough", "Clear formatting", "Text color", "Quote", "Code block", "Insert link", "Insert image", "Numbered list", "Bullet list", "Checklist", "Align", "Increase indent", "Table"]) {
  check((await bar.getByRole("button", { name, exact: true }).count()) >= 1, `toolbar: ${name}`);
}

step("bold a word, then a bullet list");
await body.click();
await page.keyboard.type("Hello world");
await page.keyboard.press("Shift+Alt+ArrowLeft");
await bar.getByRole("button", { name: "Bold", exact: true }).click();
await page.keyboard.press("End");
await page.keyboard.press("Enter");
await bar.getByRole("button", { name: "Bullet list", exact: true }).click();
await page.keyboard.type("first");
await page.keyboard.press("Enter");
await page.keyboard.type("second");
await page.keyboard.press("Enter");
await page.keyboard.press("Enter"); // leaves the list
check((await body.locator("strong").innerText()) === "world", "bold applied");

step("paste from Word: cleaned by Quill's clipboard");
await body.press(`${mod}+End`);
await page.keyboard.press("Enter");
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.setData("text/html", '<html><body><!--StartFragment--><p class="MsoNormal" style="mso-margin-top-alt:auto"><span style="font-family:Calibri;mso-bidi-font-family:Arial">Pasted <b>strong</b> text</span></p><script>window.__pwned = 1</script><!--EndFragment--></body></html>');
  dt.setData("text/plain", "Pasted strong text");
  document.activeElement.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(500);
const inner = await body.innerHTML();
check(/Pasted <strong>strong<\/strong> text/.test(inner), "pasted text with its bold");
check(!/mso-|MsoNormal|<script|__pwned/i.test(inner) && !(await page.evaluate(() => window.__pwned)), "no Word styles, no script (not run, not kept as text)");

step("insert an image (inline until saved)");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crema-te-"));
const png = path.join(dir, "dot.png");
fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
await page.keyboard.press("Enter");
const chooser = page.waitForEvent("filechooser", { timeout: 10000 });
await bar.getByRole("button", { name: "Insert image", exact: true }).click();
await (await chooser).setFiles(png);
await body.locator("img").first().waitFor({ timeout: 10000 });
check((await body.locator("img").getAttribute("src")).startsWith("data:image/png"), "image inserted inline");
step("insert a table and type in it");
// Quill turns the current line into the first cell (Desk too): start a new line
await body.locator("img").first().click();
await page.keyboard.press("End");
await page.keyboard.press("Enter");
await bar.getByRole("button", { name: "Table", exact: true }).click();
await bar.getByRole("button", { name: "Insert Table" }).click();
// Quill leaves the cursor where it was (Desk too): click into the first cell
await body.locator("table td").first().click();
await page.keyboard.type("cell A");
check((await body.locator("table td").count()) === 4, `2×2 table (${await body.locator("table td").count()} cells)`);

await shot("texteditor_filled", false);

step("save → Desk's format; the image becomes a File");
await page.keyboard.press(`${mod}+s`);
await page.waitForURL(new RegExp(`${encodeURIComponent(DT)}/(?!new)`), { timeout: 30000 });
const name = decodeURIComponent(page.url().split("/").pop());
const saved = (await api(`api/resource/${encodeURIComponent(DT)}/${name}`)).data?.body ?? "";
console.log("  saved:", saved.slice(0, 200), "…");
check(saved.startsWith('<div class="ql-editor read-mode">'), "wrapped in .ql-editor.read-mode");
check(/Hello <strong>world<\/strong>/.test(saved), "bold saved");
check(/<ul><li data-list="bullet"><span class="ql-ui" contenteditable="false"><\/span>first<\/li>/.test(saved), "bullet list saved as <ul>");
check(/<table class="table table-bordered">.*<td[^>]*>cell A<\/td>/.test(saved), "table saved with Desk's classes, text in its cell");
check(/<img src="\/(private\/)?files\/[^"]+\.png(\?fid=\w+)?"/.test(saved) && !saved.includes("data:image"), "image extracted to a file by Frappe");
const files = (await api(`api/resource/File?filters=${encodeURIComponent(JSON.stringify([["attached_to_doctype", "=", DT], ["attached_to_name", "=", name]]))}`)).data ?? [];
check(files.length === 1, `File attached to the document (${files.length})`);

step("reopen: content back, not dirty");
await page.reload({ waitUntil: "domcontentloaded" });
await body.waitFor({ timeout: 90000 });
await body.locator("strong", { hasText: "world" }).waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
check(!(await page.getByText("Not Saved").isVisible()), "opening the saved note leaves it clean");
// Quill holds bullets as <ol><li data-list="bullet"> while editing; saved as <ul>
check((await body.locator("li[data-list=bullet]").count()) === 2 && (await body.locator("table").count()) === 1, "list and table loaded back");

step("read-only Text Editor shows the HTML");
const terms = page.getByRole("document", { name: "Terms" });
check((await terms.locator("strong").innerText()) === "30 days" && (await terms.locator("li").count()) === 1, "read-only renders bold and list");
await shot("texteditor_saved", false);

step("cleanup");
await cleanup();
await t.finish();
