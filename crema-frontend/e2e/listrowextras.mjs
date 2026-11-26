// List row activity like Desk (list/list_view.js get_meta_html, get_like_html, get_seen_class): comment counts,
// assignee avatars that filter, a like heart per row and the "liked by me" filter, unread rows bold for a DocType that
// tracks who opened each record (track_seen) — and opening a record clears it.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/listrowextras.mjs
import { start, BASE, slug } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Crema Row Extras";

async function cleanup() {
  // assignments are ToDos: an open one left by an earlier run would make the next "assign" a no-op
  const todos = await api(`api/resource/ToDo?filters=${encodeURIComponent(JSON.stringify([["reference_type", "=", DT]]))}&limit_page_length=100`).catch(() => null);
  for (const d of todos?.data ?? []) await post("frappe.client.delete", { doctype: "ToDo", name: d.name });
  const docs = await api(`api/resource/${encodeURIComponent(DT)}?limit_page_length=100`).catch(() => null);
  for (const d of docs?.data ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
  // saved list filters outlive the DocType (__UserSettings): a failed run must not leave the next one filtered
  await post("frappe.model.utils.user_settings.save", { doctype: DT, user_settings: JSON.stringify({ List: { filters: [] } }) });
}
await cleanup();

step("setup: a DocType with track_seen; Alpha assigned + commented, Beta untouched");
let r = await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "field:title", track_seen: 1, title_field: "title",
  fields: [{ fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1, unique: 1, in_list_view: 1 }],
  permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });
check(r.ok(), `DocType (${r.status()})`);
for (const title of ["Alpha", "Beta"]) await post("frappe.client.insert", { doc: { doctype: DT, title } });
r = await post("frappe.desk.form.assign_to.add", { doctype: DT, name: "Alpha", assign_to: JSON.stringify(["Administrator"]), description: "row extras" });
check(r.ok(), `Alpha assigned (${r.status()})`);
r = await post("frappe.desk.form.utils.add_comment", { reference_doctype: DT, reference_name: "Alpha", content: "a comment", comment_email: "admin@example.com", comment_by: "Administrator" });
check(r.ok(), `comment on Alpha (${r.status()})`);

const row = (name) => page.locator("tbody tr").filter({ has: page.getByRole("link", { name, exact: true }) });
const openList = async (q = "") => {
  await page.goto(`${BASE}/desk/${slug(DT)}${q}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await row("Alpha").waitFor({ timeout: 90000 });
};
await openList();

step("comment count, assignee avatars, unread bold");
check((await row("Alpha").locator("[data-comment-count]").getAttribute("data-comment-count")) === "1", "Alpha: 1 comment");
check((await row("Beta").locator("[data-comment-count]").getAttribute("data-comment-count")) === "0", "Beta: 0 shown (Desk shows the count always)");
check((await row("Alpha").getByRole("button", { name: "Filter by assigned to Administrator" }).count()) === 1, "Alpha: assignee avatar");
check((await row("Beta").getByRole("button", { name: /^Filter by assigned to/ }).count()) === 0, "Beta: no avatar");
check((await row("Alpha").getByRole("link", { name: "Alpha", exact: true }).getAttribute("data-unread")) === "true", "Alpha unread → bold");
check((await row("Beta").getByRole("link", { name: "Beta", exact: true }).getAttribute("data-unread")) === "true", "Beta unread → bold");
await shot("listrowextras", false);

step("opening Alpha marks it seen");
await row("Alpha").getByRole("link", { name: "Alpha", exact: true }).click();
await page.getByRole("textbox", { name: /^Title/ }).waitFor({ timeout: 60000 });
await openList();
await page.waitForTimeout(800);
check((await row("Alpha").getByRole("link", { name: "Alpha", exact: true }).getAttribute("data-unread")) === null, "Alpha no longer bold");
check((await row("Beta").getByRole("link", { name: "Beta", exact: true }).getAttribute("data-unread")) === "true", "Beta still bold");

step("like Beta; liked-by-me filter");
await row("Beta").getByRole("button", { name: "Like Beta" }).click();
await page.waitForTimeout(1200);
const beta = (await api(`api/resource/${encodeURIComponent(DT)}/Beta`)).data;
check(String(beta._liked_by ?? "").includes("Administrator"), `Beta _liked_by ${beta._liked_by}`);
check((await row("Beta").getByRole("button", { name: "Unlike Beta" }).getAttribute("aria-pressed")) === "true", "heart filled");
await page.getByRole("button", { name: "Liked by me" }).click();
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1, null, { timeout: 10000 });
check((await row("Beta").count()) === 1 && (await row("Alpha").count()) === 0, "only Beta listed");
await page.getByRole("button", { name: "Liked by me" }).click();
await row("Alpha").waitFor({ timeout: 10000 });

step("assignee avatar filters to that user's assignments");
await row("Alpha").getByRole("button", { name: "Filter by assigned to Administrator" }).click();
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1, null, { timeout: 10000 });
check((await row("Alpha").count()) === 1 && (await row("Beta").count()) === 0, "only Alpha listed");

step("unlike Beta");
// the list restores its last filters (Desk user_settings): start this step unfiltered
await post("frappe.model.utils.user_settings.save", { doctype: DT, user_settings: JSON.stringify({ List: { filters: [] } }) });
await openList();
await row("Beta").waitFor({ timeout: 10000 });
await row("Beta").getByRole("button", { name: "Unlike Beta" }).click();
await page.waitForTimeout(1200);
check(!String((await api(`api/resource/${encodeURIComponent(DT)}/Beta`)).data._liked_by ?? "").includes("Administrator"), "Beta unliked");

step("cleanup");
await post("frappe.desk.form.assign_to.remove", { doctype: DT, name: "Alpha", assign_to: "Administrator" });
await cleanup();
await t.finish();
