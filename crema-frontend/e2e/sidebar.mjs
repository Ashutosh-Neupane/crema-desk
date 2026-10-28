// Form sidebar: assign, attach, tag, share, follow, like (and undo each), verified on the backend.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/sidebar.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const USER = "crema.e2e.share@example.com";
const tag = `sb${Date.now() % 100000}`;

// a second user to share with (created once, removed at the end)
await post("frappe.client.delete", { doctype: "User", name: USER });
await post("frappe.client.insert", { doc: { doctype: "User", email: USER, first_name: "Crema Share", send_welcome_email: 0, user_type: "Website User" } });
const todo = (await post("frappe.client.insert", { doc: { doctype: "ToDo", description: `Crema sidebar ${tag}` } })).name;
const docinfo = async () => (await page.request.get(`${BASE}/api/frappe/api/method/frappe.desk.form.load.getdoc?doctype=ToDo&name=${todo}`).then((r) => r.json())).docinfo;
const field = async (f) => (await post("frappe.client.get_value", { doctype: "ToDo", filters: { name: todo }, fieldname: [f] }))?.[f];

await page.goto(`${BASE}/desk/doctype/ToDo/${todo}`, { waitUntil: "domcontentloaded", timeout: 180000 });
const side = page.getByRole("complementary", { name: "Document sidebar" });
await side.waitFor({ timeout: 90000 });

step("assign");
await side.getByRole("button", { name: "Add assignment" }).click();
await side.getByPlaceholder("Assign to user").fill("Administrator");
await page.getByRole("option", { name: /Administrator/ }).first().click();
await side.getByRole("button", { name: "Remove assignment Administrator" }).waitFor({ timeout: 20000 });
check(String(await field("_assign")).includes("Administrator"), "assigned on the server");

step("attach");
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "crema-sb-")), `side-${tag}.txt`);
fs.writeFileSync(f, "sidebar");
await side.getByLabel("Attachment file").setInputFiles(f);
await side.getByRole("link", { name: `side-${tag}.txt` }).waitFor({ timeout: 20000 });
check(((await docinfo()).attachments ?? []).some((a) => a.file_name === `side-${tag}.txt`), "file attached to the doc");

step("tag");
await side.getByRole("button", { name: "Add tag" }).click();
await side.getByLabel("New tag").fill(tag);
await side.getByLabel("New tag").press("Enter");
await side.getByRole("button", { name: `Remove tag ${tag}` }).waitFor({ timeout: 20000 });
check(String(await field("_user_tags")).includes(tag), "tag saved");

step("share");
await side.getByRole("button", { name: "Share" }).click();
await side.getByPlaceholder("Share with user").fill("crema.e2e");
await page.getByRole("option", { name: /Crema Share|crema\.e2e\.share/ }).first().click();
await side.getByRole("button", { name: `Stop sharing with ${USER}` }).waitFor({ timeout: 20000 });
check(((await docinfo()).shared ?? []).some((s) => s.user === USER), "DocShare created");

step("follow hidden (Frappe can't follow ToDo / as Administrator) + like");
check(!(await side.getByRole("button", { name: "Follow" }).isVisible()), "no Follow button for ToDo");
await side.getByRole("button", { name: "Like" }).click();
await side.getByRole("button", { name: "Unlike" }).waitFor({ timeout: 20000 });
check(String(await field("_liked_by")).includes("Administrator"), "liked");
await shot("sidebar_full", false);

step("undo everything");
await side.getByRole("button", { name: "Remove assignment Administrator" }).click();
await side.getByText("Nobody").waitFor({ timeout: 20000 });
await side.getByRole("button", { name: `Remove attachment side-${tag}.txt` }).click();
await side.getByRole("region", { name: "Attachments" }).getByText("None").waitFor({ timeout: 20000 });
await side.getByRole("button", { name: `Remove tag ${tag}` }).click();
await side.getByText("No tags").waitFor({ timeout: 20000 });
await side.getByRole("button", { name: `Stop sharing with ${USER}` }).click();
await side.getByText("Not shared").waitFor({ timeout: 20000 });
await side.getByRole("button", { name: "Unlike" }).click();
await side.getByRole("button", { name: "Like" }).waitFor({ timeout: 20000 });
const info = await docinfo();
check(!(info.attachments ?? []).length && !(info.shared ?? []).length, "attachments and shares removed");
check(!String((await field("_assign")) ?? "").includes("Administrator") && !String((await field("_user_tags")) ?? "").includes(tag), "assignment and tag removed");

step("cleanup");
const todos = await post("frappe.client.get_list", { doctype: "ToDo", filters: [["reference_name", "=", todo]], fields: ["name"] });
for (const d of todos ?? []) await post("frappe.client.delete", { doctype: "ToDo", name: d.name });
await post("frappe.client.delete", { doctype: "ToDo", name: todo });
await post("frappe.client.delete", { doctype: "Tag", name: tag });
await post("frappe.client.delete", { doctype: "User", name: USER });
await t.finish();
