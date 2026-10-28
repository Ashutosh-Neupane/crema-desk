// Time and Datetime fields use Crema's TimePicker (popover of hour / minute / second columns), not the browser's
// <input type="time">: typing "2:30 pm" stores 14:30:00, picking from the columns changes one part, Now and Clear,
// Datetime's time part, saved values checked through the API.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/timepicker.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const DT = "Crema Time Doc";

async function cleanup() {
  for (const d of (await post("frappe.client.get_list", { doctype: DT, fields: ["name"] }).catch(() => [])) ?? []) await post("frappe.client.delete", { doctype: DT, name: d.name });
  await post("frappe.client.delete", { doctype: "DocType", name: DT });
}
await cleanup();
await post("frappe.client.insert", {
  doc: {
    doctype: "DocType", name: DT, module: "Custom", custom: 1, autoname: "hash",
    fields: [
      { fieldname: "starts", label: "Starts", fieldtype: "Time" },
      { fieldname: "ends", label: "Ends", fieldtype: "Time" },
      { fieldname: "meet_at", label: "Meet At", fieldtype: "Datetime" },
    ],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  },
});
const timeFormat = (await post("frappe.client.get_single_value", { doctype: "System Settings", field: "time_format" })) || "HH:mm:ss";
const secs = timeFormat.includes("ss");

step("new form: no native time inputs");
await page.goto(`${BASE}/desk/doctype/${encodeURIComponent(DT)}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
const starts = page.getByLabel("Starts", { exact: true });
await starts.waitFor({ timeout: 90000 });
check((await page.locator('input[type="time"]').count()) === 0, "no <input type=time> on the form");

step("type 2:30 pm → 14:30");
await starts.click();
await page.getByRole("dialog", { name: "Choose time" }).waitFor();
await starts.fill("2:30 pm");
await starts.press("Enter");
check((await starts.inputValue()) === (secs ? "14:30:00" : "14:30"), `shown as ${await starts.inputValue()}`);

step("pick hour 09 from the column → 09:30");
await starts.click();
const pop = page.getByRole("dialog", { name: "Choose time" });
await pop.getByRole("listbox", { name: "Hour" }).getByRole("option", { name: "09" }).click();
check((await starts.inputValue()).startsWith("09:30"), `hour changed, minutes kept (${await starts.inputValue()})`);
check(await pop.getByRole("listbox", { name: "Hour" }).getByRole("option", { name: "09" }).getAttribute("aria-selected") === "true", "09 marked selected");
const bg = (n) => pop.getByRole("listbox", { name: "Hour" }).getByRole("option", { name: n }).evaluate((el) => getComputedStyle(el).backgroundColor);
await page.waitForTimeout(400); // globals.css fades background-color over 0.2s
const [b9, b8] = [await bg("09"), await bg("08")];
check(b9 !== b8, `selected hour is highlighted (${b9} vs ${b8})`);
await shot("timepicker_open", false);
await page.keyboard.press("Escape");

step("Ends: Now, then Clear");
const ends = page.getByLabel("Ends", { exact: true });
await ends.click();
await page.getByRole("dialog", { name: "Choose time" }).getByRole("button", { name: "Now" }).click();
check(/^\d{2}:\d{2}/.test(await ends.inputValue()), `Now filled ${await ends.inputValue()}`);
await ends.click();
await page.getByRole("dialog", { name: "Choose time" }).getByRole("button", { name: "Clear" }).click();
check((await ends.inputValue()) === "", "Clear empties it");

step("unreadable text keeps the old value");
await starts.click();
await starts.fill("25:99");
await starts.press("Enter");
check((await starts.inputValue()).startsWith("09:30"), "25:99 ignored");

step("Datetime: date, then time from the picker");
await page.getByLabel("Meet At", { exact: true }).click();
await page.getByRole("dialog", { name: "Choose date" }).getByRole("button", { name: "Today", exact: true }).click();
const meetTime = page.getByLabel("Meet At time", { exact: true });
await meetTime.click();
await meetTime.fill("18:45");
await meetTime.press("Enter");

step("save → values in the API");
await page.keyboard.press("Control+s");
await page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 30000 });
const name = decodeURIComponent(page.url().split("/").pop());
const d = (await (await page.request.get(`${BASE}/api/frappe/api/resource/${encodeURIComponent(DT)}/${name}`)).json()).data;
// Frappe returns Time as str(timedelta): "9:30:00"
check(/^0?9:30:00/.test(String(d?.starts)), `starts = ${d?.starts}`);
check(!d?.ends, `ends empty (${d?.ends})`);
// stored in the system time zone, shown in the user's (Desk convert_to_user_tz): the form shows what was typed
check(/ \d{2}:\d{2}:00$/.test(String(d?.meet_at ?? "")), `meet_at stored as ${d?.meet_at} (system time zone)`);
check((await page.getByLabel("Meet At time", { exact: true }).inputValue()).startsWith("18:45"), "form shows 18:45 after save (user time zone)");

step("cleanup");
await cleanup();
await t.finish();
