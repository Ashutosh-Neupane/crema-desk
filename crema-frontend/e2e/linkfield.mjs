// Link field extras, like Desk (form/controls/link.js, form/link_selector.js):
// link_filters from Customize Form narrow the search and are described ("Filtered by: …"); "Show Title in Link
// Fields" shows the title while the name is stored; "Create a new X" needs create permission and is hidden with
// only_select, as is "Advanced Search"; Advanced Search picks a value through the selector dialog.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/linkfield.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const TARGET = "Crema Link Target";
const DOC = "Crema Link Doc";
const SCRIPT = "Crema Link Only Select";

async function cleanup() {
  await post("frappe.client.delete", { doctype: "Client Script", name: SCRIPT });
  for (const dt of [DOC, TARGET]) {
    const docs = await api(`api/resource/${encodeURIComponent(dt)}?limit_page_length=100`).catch(() => null);
    for (const d of docs?.data ?? []) await post("frappe.client.delete", { doctype: dt, name: d.name });
    await post("frappe.client.delete", { doctype: "DocType", name: dt });
  }
}
await cleanup();

step("setup: a target DocType shown by title, three records (one inactive), a form with two Link fields");
let r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: TARGET, module: "Custom", custom: 1, autoname: "hash", title_field: "title", show_title_field_in_link: 1,
    fields: [
      { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1, in_list_view: 1 },
      { fieldname: "active", label: "Active", fieldtype: "Check", default: "1" },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
check(r.ok(), `target DocType (${r.status()})`);
const mk = async (title, active) => (await (await post("frappe.client.insert", { doc: { doctype: TARGET, title, active } })).json()).message.name;
const alpha = await mk("Alpha Co", 1);
const beta = await mk("Beta Co", 0);
const gamma = await mk("Gamma Co", 1);
r = await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DOC, module: "Custom", custom: 1, autoname: "hash",
    fields: [
      { fieldname: "target", label: "Target", fieldtype: "Link", options: TARGET, link_filters: JSON.stringify([[TARGET, "active", "=", 1]]) },
      { fieldname: "pick_only", label: "Pick Only", fieldtype: "Link", options: TARGET },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
check(r.ok(), `form DocType (${r.status()})`);
// only_select is not stored on a DocField: scripts set it (frm.set_df_property / df.only_select)
r = await post("frappe.client.insert", {
  doc: { doctype: "Client Script", name: SCRIPT, dt: DOC, view: "Form", enabled: 1, script: `frappe.ui.form.on(${JSON.stringify(DOC)}, { onload(frm) { frm.set_df_property("pick_only", "only_select", 1); } });` },
});
check(r.ok(), `Client Script setting only_select (${r.status()})`);
// the new DocType must reach boot.link_title_doctypes: Frappe's cached boot, then Crema's
await post("frappe.sessions.clear", {});
await page.request.post(`${BASE}/api/desk/shell`, { data: { action: "clear-cache" } });

await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DOC)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("heading", { name: `New ${DOC}` }).waitFor({ timeout: 90000 });
const target = page.getByRole("combobox", { name: "Target" });
const list = page.locator("#target-listbox");

step("link_filters narrow the search and are described");
await target.click();
await list.getByRole("option", { name: /Alpha Co/ }).waitFor({ timeout: 20000 });
const shown = await list.getByRole("option").allInnerTexts();
check(shown.some((s) => s.includes("Gamma Co")) && !shown.some((s) => s.includes("Beta Co")), `inactive record filtered out (${JSON.stringify(shown)})`);
check((await list.getByRole("note").innerText()) === "Filtered by: Active is enabled.", `filter described (${await list.getByRole("note").innerText()})`);
check(await list.getByRole("option", { name: `Create a new ${TARGET}` }).isVisible(), "Create a new … (user can create)");
check(await list.getByRole("option", { name: "Advanced Search" }).isVisible(), "Advanced Search");
await shot("linkfield_dropdown", false);

step("the title is shown, the name is stored");
await list.getByRole("option", { name: /Alpha Co/ }).click();
check((await target.inputValue()) === "Alpha Co", `box shows the title (${await target.inputValue()})`);
await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
await page.waitForURL(new RegExp(`${encodeURIComponent(DOC)}/(?!new)`), { timeout: 30000 });
const name = decodeURIComponent(page.url().split("/").pop());
let saved = (await api(`api/resource/${encodeURIComponent(DOC)}/${name}`)).data;
check(saved?.target === alpha, `saved the name ${alpha} (${saved?.target})`);
await page.reload({ waitUntil: "domcontentloaded" });
await target.waitFor({ timeout: 90000 });
await page.waitForFunction(() => document.querySelector('input[aria-label="Target"]')?.value === "Alpha Co", null, { timeout: 20000 }).catch(() => {});
check((await target.inputValue()) === "Alpha Co", `after reload the title is fetched (${await target.inputValue()})`);

step("Advanced Search picks through the selector dialog");
await target.click();
await list.getByRole("option", { name: "Advanced Search" }).click();
const dlg = page.getByRole("dialog");
await dlg.getByRole("heading", { name: `Select ${TARGET}` }).waitFor({ timeout: 10000 });
const results = dlg.getByRole("list", { name: `${TARGET} results` });
await results.getByRole("button").first().waitFor({ timeout: 20000 });
const found = await results.innerText();
check(found.includes("Gamma Co") && !found.includes("Beta Co"), "link_filters apply in the dialog too");
await shot("linkfield_advanced", false);
await results.getByRole("button", { name: new RegExp(gamma) }).click();
await dlg.waitFor({ state: "hidden", timeout: 10000 });
await page.waitForFunction(() => document.querySelector('input[aria-label="Target"]')?.value === "Gamma Co", null, { timeout: 10000 }).catch(() => {});
check((await target.inputValue()) === "Gamma Co", `picked Gamma Co (${await target.inputValue()})`);

step("save keeps the picked name");
await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
await page.waitForTimeout(2500);
saved = (await api(`api/resource/${encodeURIComponent(DOC)}/${name}`)).data;
check(saved?.target === gamma, `saved ${gamma} (${saved?.target})`);

step("only_select: no Create or Advanced Search");
const pick = page.getByRole("combobox", { name: "Pick Only" });
await pick.click();
const plist = page.locator("#pick_only-listbox");
await plist.getByRole("option", { name: /Alpha Co/ }).waitFor({ timeout: 20000 });
check(!(await plist.getByRole("option", { name: /Create a new/ }).count()), "no Create a new …");
check(!(await plist.getByRole("option", { name: "Advanced Search" }).count()), "no Advanced Search");
check((await plist.getByRole("option", { name: /Beta Co/ }).count()) === 1, "no link_filters on this field: Beta Co listed");
await page.keyboard.press("Escape");

step("cleanup");
await cleanup();
await t.finish();
