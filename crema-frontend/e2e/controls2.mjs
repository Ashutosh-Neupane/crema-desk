// Table MultiSelect, Autocomplete, Password, Color, Icon against Desk (form/controls/table_multiselect.js,
// autocomplete.js, password.js, color.js, icon.js): stored values in Desk's format, Desk's validation, and Table
// MultiSelect in a frappe.ui.Dialog.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/controls2.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Crema Controls Two";
const CDT = "Crema Pick Row";
const CS = "Crema Controls Two Dialog";
const mod = process.platform === "darwin" ? "Meta" : "Control";

async function cleanup() {
  await post("frappe.client.delete", { doctype: "Client Script", name: CS });
  const docs = await api(`api/resource/${encodeURIComponent(DT)}?limit_page_length=100`).catch(() => null);
  for (const d of docs?.data ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
  await post("frappe.client.delete", { doctype: "DocType", name: CDT });
}
await cleanup();

step("setup: child table with a Role link; Table MultiSelect, Autocomplete, Password, Color, Icon");
let r = await post("frappe.client.insert", { doc: { doctype: "DocType", name: CDT, module: "Custom", custom: 1, istable: 1, fields: [{ fieldname: "role", label: "Role", fieldtype: "Link", options: "Role", in_list_view: 1 }] } });
check(r.ok(), `child DocType (${r.status()})`);
r = await post("frappe.client.insert", { doc: {
  doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash",
  fields: [
    { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
    { fieldname: "roles", label: "Roles", fieldtype: "Table MultiSelect", options: CDT },
    { fieldname: "mood", label: "Mood", fieldtype: "Autocomplete", options: "Happy\nSad\nCalm" },
    { fieldname: "secret", label: "Secret", fieldtype: "Password" },
    { fieldname: "shade", label: "Shade", fieldtype: "Color" },
    { fieldname: "glyph", label: "Glyph", fieldtype: "Icon" },
  ],
  permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
} });
check(r.ok(), `DocType (${r.status()})`);
await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: DT, view: "Form", enabled: 1, script: `
frappe.ui.form.on("${DT}", { refresh(frm) {
  frm.add_custom_button("Pick Roles", () => {
    const d = new frappe.ui.Dialog({ title: "Pick Roles", fields: [{ fieldtype: "Table MultiSelect", fieldname: "picked", label: "Picked", options: "${CDT}" }],
      primary_action_label: "Done", primary_action(v) { globalThis.__picked = v.picked; d.hide(); } });
    d.show();
  });
} });` } });
r = await post("frappe.client.insert", { doc: { doctype: DT, title: "From Desk", roles: [{ role: "System Manager" }], mood: "Calm", secret: "abc12345", shade: "#268c5c", glyph: "folder" } });
const name = (await r.json()).message?.name;
check(!!name, `document ${name}`);

await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/${name}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("textbox", { name: /^Title/ }).waitFor({ timeout: 90000 });
const roles = page.locator('[data-fieldname="roles"]');
await roles.locator("[data-pill]").first().waitFor({ timeout: 20000 });

step("Desk's values shown right");
check((await roles.locator("[data-pill]").allInnerTexts()).join() === "System Manager", "Table MultiSelect: one pill, System Manager");
check((await page.getByRole("combobox", { name: "Mood" }).inputValue()) === "Calm", "Autocomplete: Calm");
const secret = page.locator('input[aria-label="Secret"]');
check((await secret.inputValue()).includes("*") && !(await page.getByRole("button", { name: "Show password" }).count()), "Password masked, no eye for the mask");
check((await page.getByRole("textbox", { name: "Shade" }).inputValue()) === "#268c5c", "Color: #268c5c");
check((await page.locator('[data-icon="folder"]').count()) === 1, "Icon: folder");
check(!(await page.getByText("Not Saved").isVisible()), "opening leaves it clean");

step("Table MultiSelect: add, chosen values not offered, unknown refused, ✕ and Backspace remove");
const box = roles.getByRole("combobox", { name: "Roles" });
await box.click();
await box.fill("Accounts User");
await page.getByRole("option", { name: /^Accounts User/ }).first().click();
await roles.locator('[data-pill="Accounts User"]').waitFor({ timeout: 10000 });
check((await box.inputValue()) === "", "box empties after a pick");
await box.fill("System Man");
await page.waitForTimeout(800);
check((await page.getByRole("option", { name: /^System Manager/ }).count()) === 0, "System Manager (already chosen) not offered");
await box.fill("No Such Role 42");
await box.press("Enter");
await page.getByText("does not exist").first().waitFor({ timeout: 10000 });
check((await roles.locator("[data-pill]").count()) === 2, "unknown value refused");
await box.fill("");
await box.press("Backspace");
check((await roles.locator("[data-pill]").count()) === 1, "Backspace in the empty box removes the last pill");
await box.fill("Accounts User");
await page.getByRole("option", { name: /^Accounts User/ }).first().click();
await roles.locator('[data-pill="Accounts User"]').waitFor({ timeout: 10000 });
await roles.getByRole("button", { name: "Remove System Manager" }).click();
check((await roles.locator("[data-pill]").allInnerTexts()).join() === "Accounts User", "✕ removes System Manager");

step("Autocomplete: text not in the list is not stored; typed label + Enter picks");
const mood = page.getByRole("combobox", { name: "Mood" });
await mood.fill("Grumpy");
await page.getByRole("textbox", { name: /^Title/ }).click();
await page.waitForTimeout(300);
check((await mood.inputValue()) === "", `not in the list → cleared (${await mood.inputValue()})`);
await mood.fill("ha");
await mood.press("Enter");
check((await mood.inputValue()) === "Happy", "ha + Enter → Happy");

step("Password: typing shows the strength");
await secret.fill("");
await secret.fill("correct horse battery staple 9!");
await page.locator("[data-password-strength]").waitFor({ timeout: 10000 });
check(["Strong", "Excellent"].includes(await page.locator("[data-password-strength]").getAttribute("data-password-strength")), `strength ${await page.locator("[data-password-strength]").getAttribute("data-password-strength")}`);
check((await page.getByRole("button", { name: "Show password" }).count()) === 1, "eye offered for typed text");

step("Color: invalid text refused; swatch picks");
const shade = page.getByRole("textbox", { name: "Shade" });
await shade.fill("red");
await shade.press("Enter");
check((await shade.getAttribute("aria-invalid")) === "true" || (await page.getByText("Use a colour like").count()) > 0 || (await shade.inputValue()) === "#268c5c", "red not stored");
await page.getByRole("button", { name: "Shade colour picker" }).click();
await page.getByRole("button", { name: "#077ddf" }).click();
check((await shade.inputValue()) === "#077ddf", "swatch → #077ddf");

step("Icon: Desk's icons, search and pick");
const glyph = page.getByRole("textbox", { name: "Glyph" });
await glyph.click();
await page.getByRole("listbox", { name: "Icon options" }).getByRole("option").first().waitFor({ timeout: 20000 });
const total = await page.evaluate(() => document.querySelectorAll("#crema-symbols symbol[id^='icon-']").length);
check(total > 1000, `${total} Desk icons loaded`);
await glyph.fill("calendar");
await page.getByRole("option", { name: "calendar", exact: true }).click();
check((await page.locator('[data-icon="calendar"]').count()) === 1, "calendar picked");
await shot("controls2_edited", false);

step("save → Desk's formats");
await page.keyboard.press(`${mod}+s`);
await page.waitForTimeout(3000);
const d = (await api(`api/resource/${encodeURIComponent(DT)}/${name}`)).data;
check(JSON.stringify(d.roles.map((x) => [x.doctype, x.role])) === JSON.stringify([[CDT, "Accounts User"]]), `roles → ${JSON.stringify(d.roles.map((x) => x.role))}`);
check(d.mood === "Happy", `mood → ${d.mood}`);
check(d.shade === "#077ddf", `shade → ${d.shade}`);
check(d.glyph === "calendar", `glyph → ${d.glyph}`);
const pw = await api(`api/method/frappe.client.get_password?doctype=${encodeURIComponent(DT)}&name=${name}&fieldname=secret`).catch(() => null);
check(pw?.message === "correct horse battery staple 9!", "password stored");

step("Table MultiSelect in a dialog");
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Pick Roles" }).click();
const dlg = page.getByRole("dialog", { name: "Pick Roles" });
const dbox = dlg.getByRole("combobox", { name: "Picked" });
await dbox.click();
await dbox.fill("Accounts Manager");
await page.getByRole("option", { name: /^Accounts Manager/ }).first().click();
await dlg.locator('[data-pill="Accounts Manager"]').waitFor({ timeout: 10000 });
await dlg.getByRole("button", { name: "Done" }).click();
const picked = await page.evaluate(() => globalThis.__picked);
check(Array.isArray(picked) && picked.length === 1 && picked[0].role === "Accounts Manager", `dialog value ${JSON.stringify(picked)}`);

step("cleanup");
await cleanup();
await t.finish();
