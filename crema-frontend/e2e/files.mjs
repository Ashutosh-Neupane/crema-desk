// File manager: new folder, upload into it, move a file between folders, delete — verified on the backend.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/files.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const tag = `Crema FM ${Date.now() % 100000}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crema-fm-"));
const f1 = path.join(dir, `fm-${Date.now() % 100000}.txt`);
fs.writeFileSync(f1, "file manager");

step("Home → New Folder");
await page.goto(`${BASE}/desk/files`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("button", { name: "Attachments" }).waitFor({ timeout: 90000 });
await page.getByRole("button", { name: "New Folder" }).click();
await page.getByLabel("Folder name").fill(tag);
await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
await page.getByRole("button", { name: tag }).waitFor({ timeout: 20000 });
check(!!(await post("frappe.client.get_value", { doctype: "File", filters: { name: `Home/${tag}` }, fieldname: ["is_folder"] }))?.is_folder, "folder created");

step("open folder → upload");
await page.getByRole("button", { name: tag }).click();
await page.getByRole("navigation", { name: "Folder path" }).getByText(tag).waitFor({ timeout: 20000 });
await page.getByLabel("Upload files").setInputFiles(f1);
const fname = path.basename(f1);
await page.getByRole("link", { name: fname }).waitFor({ timeout: 30000 });
const fdoc = (await post("frappe.client.get_list", { doctype: "File", filters: { file_name: fname }, fields: ["name", "folder"] }))?.[0];
check(fdoc?.folder === `Home/${tag}`, `uploaded into the folder (${fdoc?.folder})`);

step("move to parent");
await page.getByRole("checkbox", { name: `Select ${fname}` }).check();
await page.getByRole("button", { name: "Move to…" }).click();
await page.getByRole("dialog").getByRole("button", { name: /Parent folder/ }).click();
await page.waitForTimeout(2000);
const moved = await post("frappe.client.get_value", { doctype: "File", filters: { name: fdoc.name }, fieldname: ["folder"] });
check(moved?.folder === "Home", `moved to Home (${moved?.folder})`);

step("delete file + folder");
await page.getByRole("navigation", { name: "Folder path" }).getByRole("button", { name: "Home" }).click();
await page.getByRole("checkbox", { name: `Select ${fname}` }).check();
await page.getByRole("checkbox", { name: `Select ${tag}` }).check();
await page.getByRole("button", { name: "Delete" }).click();
await page.waitForTimeout(2500);
const left = await post("frappe.client.get_list", { doctype: "File", filters: [["name", "in", [fdoc.name, `Home/${tag}`]]], fields: ["name"] });
check(!left?.length, "both deleted");
await t.finish();
