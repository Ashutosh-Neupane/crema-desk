// Frappe's two-step New DocType: list "Add" → "Create New DocType" dialog
// (from doctype_list.js primary_action, rendered by Trevo's frappe.ui.Dialog)
// → DocType inserted → DocType form opens to add fields → save → use it.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/doctype.create.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const NAME = `Trevo Test ${Date.now().toString(36)}`;

step("DocType list → Add opens the Create New DocType dialog");
await page.goto(`${BASE}/desk/doctype/DocType`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /Add DocType/ }).click();
const dlg = page.getByRole("dialog", { name: "Create New DocType" });
await dlg.waitFor({ timeout: 20000 });
check(await dlg.getByText("Is Submittable").isVisible(), "dialog shows doctype options");
await shot("doctype_dialog", false);

step("fill name, module, custom → Create & Continue");
await dlg.getByRole("textbox", { name: /^Name/ }).fill(NAME);
const MODULE = process.env.TREVO_MODULE ?? "Custom Vendor";
const mod = dlg.getByRole("combobox", { name: /^Module/ });
await mod.click();
await mod.fill(MODULE);
await page.getByRole("option", { name: MODULE, exact: true }).first().click();
const custom = dlg.getByLabel(/Custom\?/);
if (!(await custom.isChecked())) await custom.check();
await dlg.getByRole("button", { name: "Create & Continue" }).click();
await page.waitForURL(/\/desk\/doctype\/DocType\/Trevo/, { timeout: 30000 });
const created = (await api(`api/resource/DocType/${encodeURIComponent(NAME)}`)).data;
check(created?.custom === 1 && created?.module === MODULE, `DocType created (custom=${created?.custom}, module=${created?.module})`);
await page.waitForTimeout(3000);
await shot("doctype_form", true);

check(!(await page.getByRole("dialog", { name: "Create New DocType" }).isVisible()), "dialog closed after navigation");

step("form builder: add 'Book Title' (Data, mandatory) and 'Pages' (Int)");
await page.getByRole("button", { name: "Add field" }).first().click();
const label = page.locator("aside input").first();
await label.fill("Book Title");
await page.locator("aside").getByLabel("Mandatory").check();
await page.locator("aside").getByLabel("In List View").check();
await page.getByRole("button", { name: "Add field" }).first().click();
await page.locator("aside input").first().fill("Pages");
await page.locator("aside select").first().selectOption("Int");
await shot("doctype_builder", true);
await page.keyboard.press("Meta+s");
await page.waitForTimeout(4000);
const dt = (await api(`api/resource/DocType/${encodeURIComponent(NAME)}`)).data;
const fields = (dt?.fields ?? []).filter((f) => !["Section Break", "Column Break", "Tab Break"].includes(f.fieldtype));
check(fields.some((f) => f.fieldname === "book_title" && f.label === "Book Title" && f.reqd === 1 && f.in_list_view === 1), "book_title saved with its label (mandatory, in list view)");
check(fields.some((f) => f.fieldname === "pages" && f.label === "Pages" && f.fieldtype === "Int"), "pages saved as Int with its label");

step("use the new DocType: create a record");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(NAME)}/new`, { waitUntil: "domcontentloaded" });
try {
  await page.getByRole("textbox", { name: /^Book Title/ }).waitFor({ timeout: 60000 });
} catch (e) {
  await shot("doctype_new_record_fail", false);
  console.log("MAIN:", (await page.locator("main").innerText()).slice(0, 600));
  throw e;
}
await page.getByRole("textbox", { name: /^Book Title/ }).fill("Muna Madan");
await page.getByRole("textbox", { name: /^Pages/ }).fill("120");
await page.getByRole("textbox", { name: /^Pages/ }).press("Tab");
await page.getByRole("button", { name: /^Save$/ }).click();
try {
  await page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 30000 });
} catch (e) {
  await shot("doctype_record_save_fail", false);
  console.log("TOASTS:", await page.locator("[data-sonner-toast]").allInnerTexts());
  console.log("DIALOG:", await page.locator("[role=dialog]").allInnerTexts());
  throw e;
}
const recName = decodeURIComponent(page.url().split("/").pop());
const rec = (await api(`api/resource/${encodeURIComponent(NAME)}/${encodeURIComponent(recName)}`)).data;
check(rec?.book_title === "Muna Madan" && rec?.pages === 120, `record ${recName} saved with values`);
await page.request.post(`${BASE}/api/frappe/api/method/frappe.client.delete`, { data: { doctype: NAME, name: recName } });

console.log("cleanup:", (await page.request.post(`${BASE}/api/frappe/api/method/frappe.client.delete`, { data: { doctype: "DocType", name: NAME } })).status());
await t.finish();
