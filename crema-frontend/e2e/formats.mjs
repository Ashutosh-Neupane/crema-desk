// Formatting from the site's settings (Desk number_format.js / formatters.js / datetime.js): System Settings
// switched to Indian/Nepali grouping (#,##,###.##), dd-mm-yyyy and HH:mm, then lists, forms, inputs and site
// scripts (format_currency, frappe.format) must follow; Datetime shows in the user's time zone. Settings are
// restored at the end.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/formats.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const DT = "Crema Format Test";
const CS = "Crema Format Test CS";
const SS = ["number_format", "date_format", "time_format", "float_precision", "currency_precision"];
const original = await post("frappe.client.get_value", { doctype: "System Settings", filters: "System Settings", fieldname: SS });
const lang = (await post("frappe.client.get_value", { doctype: "System Settings", filters: "System Settings", fieldname: ["language"] }))?.language;
const setSystem = async (values) => {
  // System Settings can't be saved with an empty (mandatory) language; "en" is what an empty one means
  const r = await page.request.post(`${BASE}/api/frappe/api/method/frappe.client.set_value`, { data: { doctype: "System Settings", name: "System Settings", fieldname: { ...values, ...(lang ? {} : { language: "en" }) } } });
  if (!r.ok()) throw new Error(`System Settings not saved: ${(await r.text()).slice(0, 200)}`);
  await page.request.post(`${BASE}/api/desk/shell`, { data: { action: "clear-cache" } });
};
const tz = await post("frappe.client.get_value", { doctype: "User", filters: "Administrator", fieldname: "time_zone" });
async function cleanup() {
  await post("frappe.client.delete", { doctype: "Client Script", name: CS });
  for (const d of (await post("frappe.client.get_list", { doctype: DT, fields: ["name"] }).catch(() => [])) ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();
await post("frappe.client.insert", { doc: { doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash", fields: [
  { fieldname: "amount", label: "Amount", fieldtype: "Currency", in_list_view: 1 },
  { fieldname: "qty", label: "Qty", fieldtype: "Float", in_list_view: 1 },
  { fieldname: "count", label: "Count", fieldtype: "Int", in_list_view: 1 },
  { fieldname: "on_date", label: "On Date", fieldtype: "Date", in_list_view: 1 },
  { fieldname: "at", label: "At", fieldtype: "Datetime", in_list_view: 1 },
  { fieldname: "note", label: "Note", fieldtype: "Data" },
], permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }] } });
await post("frappe.client.insert", { doc: { doctype: "Client Script", name: CS, dt: DT, view: "Form", enabled: 1, script: `
frappe.ui.form.on("${DT}", { refresh(frm) {
  frm.set_df_property("note", "description", "fc=" + format_currency(frm.doc.amount, "NPR") + " | fmt=" + frappe.format(frm.doc.at, { fieldtype: "Datetime" }) + " | flt=" + flt("1,23,456.789", 2));
} });` } });
const rec = await post("frappe.client.insert", { doc: { doctype: DT, amount: 1234567.5, qty: 2.5, count: 12000, on_date: "2026-10-21", at: "2026-10-21 12:00:00" } });

try {
  await setSystem({ number_format: "#,##,###.##", date_format: "dd-mm-yyyy", time_format: "HH:mm", float_precision: "", currency_precision: "" });
  const sys = await post("frappe.client.get_value", { doctype: "System Settings", filters: "System Settings", fieldname: ["time_zone"] });
  const expectAt = sys?.time_zone === "Asia/Kathmandu" && tz?.time_zone === "Asia/Kolkata" ? "21-10-2026 11:45" : null;

  step("list cells");
  await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const row = page.locator("#main-content").getByRole("row").filter({ hasText: "12,34,567.50" });
  await row.first().waitFor({ timeout: 60000 });
  const text = await row.first().innerText();
  check(text.includes("₨ 12,34,567.50"), "Currency: NPR symbol + lakh grouping");
  check(text.includes("2.5"), "Float: 2.5");
  check(text.includes("12000"), "Int: ungrouped like Desk");
  check(text.includes("21-10-2026"), "Date: dd-mm-yyyy");
  if (expectAt) check(text.includes(expectAt), `Datetime: user time zone + HH:mm (${expectAt})`);
  await shot("formats_list");

  step("form fields and inputs");
  await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/${rec.name}`, { waitUntil: "domcontentloaded" });
  const amount = page.getByRole("textbox", { name: "Amount" });
  await amount.waitFor({ timeout: 60000 });
  check((await amount.inputValue()) === "₨ 12,34,567.50", `Amount input shows ${await amount.inputValue()}`);
  if (expectAt) check((await page.getByLabel("At time").inputValue()) === "11:45", "Datetime input in the user's time zone");
  const desc = await page.getByText(/^fc=/).innerText();
  check(desc.includes("fc=₨ 12,34,567.50"), `format_currency in a site script (${desc.split(" | ")[0]})`);
  if (expectAt) check(desc.includes(`fmt=${expectAt}`), "frappe.format(Datetime) in a site script");
  check(desc.includes("flt=123456.79"), "flt strips the site's groups");

  step("typing a grouped number");
  await amount.click();
  await amount.fill("1,00,000.255");
  await amount.press("Enter");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
  await page.waitForTimeout(2500);
  const saved = await post("frappe.client.get_value", { doctype: DT, filters: rec.name, fieldname: "amount" });
  check(Number(saved?.amount) === 100000.26, `saved ${saved?.amount} (parsed with the number format, rounded to precision 2)`);
  if (expectAt) {
    step("datetime input converts back to the system time zone");
    await page.getByLabel("At time").fill("10:00");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
    await page.waitForTimeout(2500);
    const at = await post("frappe.client.get_value", { doctype: DT, filters: rec.name, fieldname: "at" });
    check(String(at?.at).startsWith("2026-10-21 10:15"), `saved ${at?.at} (10:00 Kolkata = 10:15 Kathmandu)`);
  }
} finally {
  step("restore");
  await setSystem(Object.fromEntries(SS.map((k) => [k, original?.[k] ?? ""])));
  await cleanup();
}
await t.finish();
