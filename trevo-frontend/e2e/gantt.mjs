// Gantt: Task (calendar JS gantt: true) — bars render, drag moves both dates, edge drag extends the end.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/gantt.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const base = new Date();
base.setHours(0, 0, 0, 0);
const tag = `Trevo gantt ${Date.now() % 100000}`;
const task = (await post("frappe.client.insert", { doc: { doctype: "Task", subject: tag, exp_start_date: ymd(addDays(base, 1)), exp_end_date: ymd(addDays(base, 3)), progress: 40 } })).name;

step("Task list offers Gantt");
await page.goto(`${BASE}/desk/doctype/Task?view=list`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Gantt" }).click({ timeout: 90000 });
await page.waitForURL(/\/view\/gantt/, { timeout: 60000 });
const bar = page.getByRole("slider", { name: new RegExp(`^${tag}:`) });
await bar.waitFor({ timeout: 60000 });
check((await bar.getAttribute("aria-label")).includes(`${ymd(addDays(base, 1))} to ${ymd(addDays(base, 3))}`), "bar spans the task dates");
check((await bar.getAttribute("aria-valuenow")) === "40", "progress 40%");
await shot("gantt", false);

step("drag bar +2 days");
let b = await bar.boundingBox();
await page.mouse.move(b.x + 15, b.y + b.height / 2);
await page.mouse.down();
await page.mouse.move(b.x + 15 + 36 * 2, b.y + b.height / 2, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(2500);
let d = await post("frappe.client.get_value", { doctype: "Task", filters: { name: task }, fieldname: ["exp_start_date", "exp_end_date"] });
check(String(d?.exp_start_date).slice(0, 10) === ymd(addDays(base, 3)) && String(d?.exp_end_date).slice(0, 10) === ymd(addDays(base, 5)), `moved (${d?.exp_start_date} → ${d?.exp_end_date})`);

step("drag right edge +1 day");
b = await bar.boundingBox();
await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2);
await page.mouse.down();
await page.mouse.move(b.x + b.width - 3 + 36, b.y + b.height / 2, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(2500);
d = await post("frappe.client.get_value", { doctype: "Task", filters: { name: task }, fieldname: ["exp_start_date", "exp_end_date"] });
check(String(d?.exp_start_date).slice(0, 10) === ymd(addDays(base, 3)) && String(d?.exp_end_date).slice(0, 10) === ymd(addDays(base, 6)), `end extended (${d?.exp_start_date} → ${d?.exp_end_date})`);

step("cleanup");
await post("frappe.client.delete", { doctype: "Task", name: task });
await t.finish();
