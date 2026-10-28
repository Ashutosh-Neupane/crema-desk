// Calendar view: Event (calendar JS field_map), drag to reschedule keeps duration, + creates a prefilled doc.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/calendar.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
// a day in the middle of the current month, and the next day
const d1 = new Date(now.getFullYear(), now.getMonth(), 12);
const d2 = new Date(now.getFullYear(), now.getMonth(), 13);
const title = `Crema cal ${Date.now() % 100000}`;
const ev = (await post("frappe.client.insert", { doc: { doctype: "Event", subject: title, starts_on: `${ymd(d1)} 10:00:00`, ends_on: `${ymd(d1)} 11:30:00`, event_type: "Private" } })).name;

step("/desk/calendar → Event calendar shows the event");
await page.goto(`${BASE}/desk/calendar`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForURL(/\/desk\/doctype\/Event\/view\/calendar/, { timeout: 60000 });
const chip = page.getByRole("link", { name: new RegExp(title) });
await chip.waitFor({ timeout: 60000 });
const cell1 = page.getByRole("gridcell", { name: d1.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }) });
check(await cell1.getByRole("link", { name: new RegExp(title) }).isVisible(), "event on its day with time");
await shot("calendar_month", false);

step("drag to the next day");
const cell2 = page.getByRole("gridcell", { name: d2.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }) });
const a = await chip.boundingBox();
const b = await cell2.boundingBox();
await page.mouse.move(a.x + 10, a.y + a.height / 2);
await page.mouse.down();
await page.mouse.move(a.x + 20, a.y + a.height / 2 + 5, { steps: 3 });
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(2500);
const after = await post("frappe.client.get_value", { doctype: "Event", filters: { name: ev }, fieldname: ["starts_on", "ends_on"] });
check(after?.starts_on === `${ymd(d2)} 10:00:00` && after?.ends_on === `${ymd(d2)} 11:30:00`, `rescheduled keeping duration (${after?.starts_on} → ${after?.ends_on})`);
check(await cell2.getByRole("link", { name: new RegExp(title) }).isVisible(), "event now on the new day");

step("+ on a day opens New Event prefilled");
await cell2.hover();
await cell2.getByRole("button", { name: /^New on / }).click();
await page.waitForURL(/Event\/new/, { timeout: 30000 });
await page.getByRole("heading", { name: "New Event" }).waitFor({ timeout: 60000 });
const startsOn = await page.getByLabel(/^Starts on$/i).first().inputValue();
check(startsOn.includes(String(d2.getDate()).padStart(2, "0")), `starts_on prefilled (${startsOn})`);

step("Task calendar (Date fields, ERPNext calendar JS) loads");
await page.goto(`${BASE}/desk/doctype/Task/view/calendar`, { waitUntil: "domcontentloaded" });
await page.getByRole("grid", { name: "Task calendar" }).waitFor({ timeout: 60000 });
check(true, "Task calendar grid rendered");

step("cleanup");
await post("frappe.client.delete", { doctype: "Event", name: ev });
await t.finish();
