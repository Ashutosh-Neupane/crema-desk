// Attach / Attach Image: upload on a new doc, save, value + File record attached; preview via /files proxy.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/attach.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Trevo Attach Doc";

async function cleanup() {
  const docs = await api(`api/resource/${encodeURIComponent(DT)}?limit_page_length=50`).catch(() => null);
  for (const d of docs?.data ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();
let r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", image_field: "photo",
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
      { fieldname: "photo", label: "Photo", fieldtype: "Attach Image" },
      { fieldname: "doc_file", label: "Document", fieldtype: "Attach" },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
check(r.ok(), `DocType created (${r.status()})`);

// 1x1 PNG + a text file
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trevo-attach-"));
const png = path.join(dir, "pixel.png");
fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
const txt = path.join(dir, "notes.txt");
fs.writeFileSync(txt, "hello trevo");

step("new doc: upload image + file, save");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${DT}` }).waitFor({ timeout: 90000 });
await page.getByRole("textbox", { name: /^Title/ }).fill("With files");
await page.getByLabel("Photo", { exact: true }).setInputFiles(png);
await page.getByRole("link", { name: "pixel.png" }).waitFor({ timeout: 30000 });
check(true, "image uploaded and shown");
await page.getByLabel("Document", { exact: true }).setInputFiles(txt);
await page.getByRole("link", { name: "notes.txt" }).waitFor({ timeout: 30000 });
const img = page.locator("img[alt='Photo']");
await page.waitForFunction(() => { const el = document.querySelector("img[alt='Photo']"); return !!el && el.complete && el.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
check(await img.evaluate((el) => el.complete && el.naturalWidth > 0), "preview loads through /files proxy");
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForURL(new RegExp(`${encodeURIComponent(DT)}/(?!new)`), { timeout: 30000 });
const name = decodeURIComponent(page.url().split("/").pop());
const d = (await api(`api/resource/${encodeURIComponent(DT)}/${name}`)).data;
check(/^\/files\/pixel.*\.png$/.test(d?.photo ?? ""), `photo saved (${d?.photo})`);
check(/^\/private\/files\/notes.*\.txt$/.test(d?.doc_file ?? ""), `file saved private (${d?.doc_file})`);
const files = (await (await post("frappe.client.get_list", { doctype: "File", filters: { attached_to_doctype: DT, attached_to_name: name }, fields: ["file_url"] })).json()).message ?? [];
check(files.length === 2, `both files attached to the doc (${files.length})`);
const priv = await page.request.get(`${BASE}${d.doc_file}`);
check(priv.ok() && (await priv.text()) === "hello trevo", "private file served to the session");
await shot("attach_saved", false);

step("clear the attachment");
await page.getByRole("button", { name: "Clear Document" }).click();
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForTimeout(2500);
const d2 = (await api(`api/resource/${encodeURIComponent(DT)}/${name}`)).data;
check(!d2?.doc_file, `doc_file cleared (${d2?.doc_file ?? "empty"})`);

step("cleanup");
await cleanup();
await t.finish();
