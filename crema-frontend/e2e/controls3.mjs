// Dialog controls against Desk (form/controls/multiselect.js, multiselect_pills.js, multiselect_list.js,
// multicheck.js, date_range.js, switch.js): a frappe.ui.Dialog built by a Client Script, filled in the UI, and
// d.get_values() compared with what Desk returns — MultiSelect "a, b", Pills / List / MultiCheck arrays of values,
// Date Range [from, to], Switch 0/1; options as lines, {label, value} items and get_data(txt).
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/controls3.mjs
import { start, BASE, slug } from "./lib.mjs";

// the site's date_format (System Settings), as the date inputs expect it typed
const toUser = (iso, fmt) => {
  const [y, m, d] = iso.split("-");
  return fmt.replace("yyyy", y).replace("mm", m).replace("dd", d);
};

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Crema Controls Three";
const CS = "Crema Controls Three Dialog";

async function cleanup() {
  await post("frappe.client.delete", { doctype: "Client Script", name: CS });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();

step("setup: a form whose button opens a dialog with every multi-value control");
let r = await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", fields: [{ fieldname: "title", label: "Title", fieldtype: "Data" }], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });
check(r.ok(), `DocType (${r.status()})`);
await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: DT, view: "Form", enabled: 1, script: `
frappe.ui.form.on("${DT}", { refresh(frm) {
  frm.add_custom_button("Open Multi", () => {
    const d = new frappe.ui.Dialog({ title: "Multi", fields: [
      { fieldtype: "MultiSelect", fieldname: "ms", label: "Fruits", options: "Apple\\nBanana\\nCherry" },
      { fieldtype: "MultiSelect Pills", fieldname: "pills", label: "Colours",
        get_data: (txt) => [{ label: "Red colour", value: "red" }, { label: "Green colour", value: "green" }, { label: "Blue colour", value: "blue" }].filter((o) => !txt || o.label.toLowerCase().includes(txt.toLowerCase())) },
      { fieldtype: "MultiSelect List", fieldname: "msl", label: "Cities", options: ["Kathmandu", "Pokhara", "Lalitpur"] },
      { fieldtype: "MultiCheck", fieldname: "mc", label: "Days", select_all: 1,
        options: [{ label: "Tue", value: "tue" }, { label: "Mon", value: "mon", checked: 1 }, { label: "Wed", value: "wed" }] },
      { fieldtype: "Date Range", fieldname: "dr", label: "Period" },
      { fieldtype: "Switch", fieldname: "sw", label: "Notify" },
    ], primary_action_label: "Done", primary_action(v) { globalThis.__multi = { v, all: d.get_values() }; d.hide(); } });
    d.show();
  });
} });` } });
r = await post("frappe.client.insert", { doc: { doctype: DT, title: "multi" } });
const name = (await r.json()).message?.name;
await page.goto(`${BASE}/desk/${slug(DT)}/${name}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("button", { name: "Open Multi" }).click({ timeout: 90000 });
const dlg = page.getByRole("dialog", { name: "Multi" });
await dlg.waitFor();

step("MultiSelect: lines, typed + Enter, click, Backspace");
const ms = dlg.getByRole("combobox", { name: "Fruits" });
await ms.click();
await ms.fill("ban");
await ms.press("Enter");
await ms.click();
await page.getByRole("option", { name: "Cherry" }).click();
await ms.fill("");
await ms.click();
await page.getByRole("option", { name: "Apple" }).click();
await ms.press("Backspace");
check((await dlg.locator('[data-fieldname="ms"] [data-pill]').allInnerTexts()).join("|") === "Banana|Cherry", "Banana, Cherry picked (Apple removed by Backspace)");

step("MultiSelect Pills: get_data(txt) with labels");
const pills = dlg.getByRole("combobox", { name: "Colours" });
await pills.click();
await pills.fill("gre");
await page.getByRole("option", { name: "Green colour" }).waitFor({ timeout: 5000 });
await page.waitForTimeout(600);
check((await page.getByRole("option").count()) === 1, "get_data filtered by the typed text");
await page.getByRole("option", { name: "Green colour" }).click();
await pills.fill("");
await page.getByRole("option", { name: "Red colour" }).click();
check((await dlg.locator('[data-fieldname="pills"] [data-pill]').allInnerTexts()).join("|") === "Green colour|Red colour", "pills show labels");

step("MultiSelect List: status text, Select All, toggle");
const msl = dlg.getByRole("button", { name: "Cities" });
await msl.click();
await page.getByRole("button", { name: "Select All" }).first().click();
check((await dlg.locator('[data-fieldname="msl"] [data-status]').innerText()) === "3 values selected", "3 values selected");
await page.getByRole("listbox", { name: "Cities options" }).getByRole("button", { name: "Pokhara" }).click();
await page.getByRole("listbox", { name: "Cities options" }).getByRole("button", { name: "Lalitpur" }).click();
check((await dlg.locator('[data-fieldname="msl"] [data-status]').innerText()) === "Kathmandu", "one value → its label");
await dlg.getByRole("heading", { name: "Multi" }).click();

step("MultiCheck: sorted by label, checked option starts checked, Select All");
const mc = dlg.getByRole("group", { name: "Days" });
check((await mc.locator("label").allInnerTexts()).map((s) => s.trim()).join(",") === "Mon,Tue,Wed", "sorted Mon, Tue, Wed");
check(await mc.getByRole("checkbox", { name: "Mon" }).isChecked(), "Mon checked from options");
await mc.getByRole("checkbox", { name: "Wed" }).check();

step("Date Range and Switch");
const fromBox = dlg.getByLabel("Period from");
await fromBox.click();
const fmt = (await api("api/method/frappe.client.get_single_value?doctype=System%20Settings&field=date_format")).message || "dd-mm-yyyy";
await fromBox.fill(toUser("2026-11-01", fmt));
await fromBox.press("Enter");
const toBox = dlg.getByLabel("Period to");
await toBox.click();
await toBox.fill(toUser("2026-11-05", fmt));
await toBox.press("Enter");
await dlg.getByRole("switch", { name: "Notify" }).click().catch(async () => dlg.getByRole("checkbox", { name: "Notify" }).click());
await shot("controls3_dialog", false);

step("Done → Desk's values");
await dlg.getByRole("button", { name: "Done" }).click();
const got = await page.evaluate(() => globalThis.__multi);
const v = got?.v ?? {};
check(v.ms === "Banana, Cherry", `MultiSelect → ${JSON.stringify(v.ms)}`);
check(JSON.stringify(v.pills) === '["green","red"]', `Pills → ${JSON.stringify(v.pills)}`);
check(JSON.stringify(v.msl) === '["Kathmandu"]', `List → ${JSON.stringify(v.msl)}`);
check(JSON.stringify([...(v.mc ?? [])].sort()) === '["mon","wed"]', `MultiCheck → ${JSON.stringify(v.mc)}`);
check(JSON.stringify(v.dr) === '["2026-11-01","2026-11-05"]', `Date Range → ${JSON.stringify(v.dr)}`);
check(v.sw === 1, `Switch → ${JSON.stringify(v.sw)}`);

step("cleanup");
await post("frappe.client.delete", { doctype: DT, name });
await cleanup();
await t.finish();
