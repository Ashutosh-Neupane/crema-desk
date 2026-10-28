// Form navigation like Desk (form.js navigate_records, toolbar.js make_navigation): previous / next document in the
// list's sort (newest first by default), "No further records" at the end, Shift+Ctrl+> shortcut; a missing document
// shows "Not found" and a 403 shows "Not permitted" (pageview.js show_not_permitted) instead of a raw error.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/formnav.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const DT = "Crema Nav Doc";
const url = (n) => `${BASE}/desk/doctype/${encodeURIComponent(DT)}/${n}`;

async function cleanup() {
  for (const d of (await post("frappe.client.get_list", { doctype: DT, fields: ["name"] }).catch(() => [])) ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();
await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", allow_rename: 0, title_field: "title",
    fields: [{ fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 }],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
const ids = [];
for (const title of ["Oldest", "Middle", "Newest"]) {
  ids.push((await post("frappe.client.insert", { doc: { doctype: DT, title } })).name);
  await page.waitForTimeout(50);
}
const heading = (text) => page.getByRole("heading", { name: text, exact: true });

step("Next from the middle → the older one (list is newest first)");
await page.goto(url(ids[1]), { waitUntil: "domcontentloaded", timeout: 180000 });
await heading("Middle").waitFor({ timeout: 90000 });
check(await page.getByRole("button", { name: "Previous document" }).isVisible(), "previous / next buttons in the header");
await page.getByRole("button", { name: "Next document" }).click();
await heading("Oldest").waitFor({ timeout: 30000 });
check(page.url().endsWith(ids[0]), "next → Oldest");

step("Next at the end → No further records");
await page.getByRole("button", { name: "Next document" }).click();
await page.getByText("No further records").first().waitFor({ timeout: 15000 });
check(page.url().endsWith(ids[0]), "stays on the last record");

step("Previous twice → Newest; Shift+Ctrl+> back to Middle");
await page.getByRole("button", { name: "Previous document" }).click();
await heading("Middle").waitFor({ timeout: 30000 });
await page.getByRole("button", { name: "Previous document" }).click();
await heading("Newest").waitFor({ timeout: 30000 });
check(page.url().endsWith(ids[2]), "previous → Newest");
await page.locator("body").click({ position: { x: 5, y: 300 } });
await page.keyboard.press("Shift+Control+Period");
await heading("Middle").waitFor({ timeout: 30000 });
check(page.url().endsWith(ids[1]), "Shift+Ctrl+> → Middle");
await shot("formnav_header", false);

step("click the title → edit title_field (no allow_rename: title only)");
await page.getByRole("button", { name: "Middle", exact: true }).click();
const dlg = page.getByRole("dialog");
check(!(await dlg.getByLabel("New name").count()), "no name field when the DocType can't be renamed");
await dlg.getByLabel("Title").fill("Middle edited");
await dlg.getByRole("button", { name: "Rename" }).click();
await heading("Middle edited").waitFor({ timeout: 30000 });
const tv = await post("frappe.client.get_value", { doctype: DT, filters: { name: ids[1] }, fieldname: ["title"] });
check(tv?.title === "Middle edited" && page.url().endsWith(ids[1]), "title saved, name unchanged");

step("missing document → Not found");
await page.goto(url("does-not-exist-123"), { waitUntil: "domcontentloaded" });
await heading("Not found").waitFor({ timeout: 60000 });
check(await page.getByText(`${DT} does-not-exist-123 does not exist`).isVisible(), "explains the document is missing");
check(await page.getByRole("link", { name: `Back to ${DT} list` }).isVisible(), "link back to the list");

step("403 → Not permitted");
await page.route(/frappe\.desk\.form\.load\.getdoc\?/, (r) =>
  r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ exc_type: "PermissionError", _server_messages: JSON.stringify([JSON.stringify({ message: "Insufficient Permission" })]) }) }),
);
await page.goto(url(ids[0]), { waitUntil: "domcontentloaded" });
await heading("Not permitted").waitFor({ timeout: 60000 });
check(await page.getByText(/not permitted to view/).isVisible(), "Desk's not-permitted message");
await shot("formnav_not_permitted", false);
await page.unroute(/frappe\.desk\.form\.load\.getdoc\?/);

step("no read on the DocType (getdoctype 403) → Not permitted");
await page.route(/frappe\.desk\.form\.load\.getdoctype\?/, (r) => r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ exc_type: "PermissionError" }) }));
await page.goto(url(ids[0]), { waitUntil: "domcontentloaded" });
await heading("Not permitted").waitFor({ timeout: 60000 });
check(true, "meta 403 shows the same page");
await page.unroute(/frappe\.desk\.form\.load\.getdoctype\?/);

step("cleanup");
await cleanup();
await t.finish();
