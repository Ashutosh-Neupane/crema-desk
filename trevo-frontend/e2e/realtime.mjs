// Realtime: list_update refreshes the list; doc_update reloads a clean form and warns on a dirty one.
// Needs the bench's socketio process and NEXT_PUBLIC_SOCKETIO_URL.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/realtime.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const tag = `RT${Date.now() % 100000}`;
const made = [];

step("list refreshes on list_update");
await page.goto(`${BASE}/desk/doctype/ToDo?filters=${encodeURIComponent(JSON.stringify([["description", "like", `%${tag}%`]]))}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByText(/No ToDo matches these filters|You haven't created/).waitFor({ timeout: 90000 });
await page.waitForTimeout(2000); // socket joins the doctype room
made.push((await post("frappe.client.insert", { doc: { doctype: "ToDo", description: `${tag} first` } })).name);
await page.getByText(`${tag} first`).first().waitFor({ timeout: 15000 }).catch(() => {});
check(await page.getByText(`${tag} first`).first().isVisible(), "new ToDo appeared without reloading");

step("clean form reloads on doc_update");
await page.goto(`${BASE}/desk/doctype/ToDo/${made[0]}`, { waitUntil: "domcontentloaded" });
await page.getByRole("complementary", { name: "Document sidebar" }).waitFor({ timeout: 90000 });
await page.waitForTimeout(2000);
await post("frappe.client.set_value", { doctype: "ToDo", name: made[0], fieldname: "priority", value: "High" });
const priority = page.getByRole("combobox", { name: /^Priority/ }).first();
await page.waitForFunction(() => [...document.querySelectorAll("select")].some((s) => s.value === "High"), null, { timeout: 15000 }).catch(() => {});
check((await priority.inputValue()) === "High", `form shows the other user's change (${await priority.inputValue()})`);

step("dirty form shows a conflict banner");
await priority.selectOption("Low");
await post("frappe.client.set_value", { doctype: "ToDo", name: made[0], fieldname: "priority", value: "Medium" });
const banner = page.getByRole("alert").filter({ hasText: "changed by someone else" });
await banner.waitFor({ timeout: 15000 }).catch(() => {});
check(await banner.isVisible(), "conflict banner shown, edits kept");
check((await priority.inputValue()) === "Low", "unsaved edit not overwritten");
await banner.getByRole("button", { name: /Reload/ }).click();
await page.waitForTimeout(2000);
check((await priority.inputValue()) === "Medium", "Reload brings the server version");

step("cleanup");
for (const n of made) await post("frappe.client.delete", { doctype: "ToDo", name: n });
await t.finish();
