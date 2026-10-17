// Kanban: board picker/create, cards per column, drag between columns, move menu,
// add-card prefill, archive/restore column — verified on the backend.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/kanban.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const BOARD = "Trevo E2E ToDo";
const tag = `KB-${Date.now() % 100000}`;

async function cleanup() {
  const todos = await api(`api/resource/ToDo?filters=${encodeURIComponent(JSON.stringify([["description", "like", "%Trevo kanban%"]]))}&limit_page_length=50`).catch(() => null);
  for (const d of todos?.data ?? []) await post("frappe.client.delete", { doctype: "ToDo", name: d.name });
  await post("frappe.client.delete", { doctype: "Kanban Board", name: BOARD });
}
await cleanup();

step("setup: two ToDos");
const names = [];
for (const n of [1, 2]) {
  const r = await post("frappe.client.insert", { doc: { doctype: "ToDo", description: `Trevo kanban ${tag} card ${n}`, status: "Open" } });
  names.push((await r.json()).message.name);
}
check(names.length === 2, `created ${names.join(", ")}`);

step("create a board from the Kanban view");
await page.goto(`${BASE}/desk/doctype/ToDo`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Kanban" }).click();
await page.waitForURL(/\/view\/kanban/, { timeout: 30000 });
await page.getByRole("button", { name: "New Kanban Board" }).click({ timeout: 30000 });
await page.getByLabel("Kanban Board Name").fill(BOARD);
await page.getByLabel("Column Based On").selectOption("status");
await page.getByRole("button", { name: "Create" }).click();
await page.waitForURL(new RegExp(`/view/kanban/${encodeURIComponent(BOARD)}`), { timeout: 30000 });
const open = page.getByRole("region", { name: "Open column" });
const closed = page.getByRole("region", { name: "Closed column" });
await open.waitFor({ timeout: 60000 });
check(await closed.isVisible(), "Open + Closed columns from Select options");
const card1 = open.locator("article", { hasText: `${tag} card 1` });
await card1.waitFor({ timeout: 30000 });
check(true, "card shown in Open");
await shot("kanban_board");

step("drag card 1 to Closed");
const from = await card1.boundingBox();
const to = await closed.boundingBox();
await page.mouse.move(from.x + 40, from.y + from.height - 8);
await page.mouse.down();
await page.mouse.move(from.x + 60, from.y + from.height + 10, { steps: 5 });
await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(2500);
let d = (await api(`api/resource/ToDo/${names[0]}`)).data;
check(d?.status === "Closed", `status after drag: ${d?.status}`);
check(await closed.locator("article", { hasText: `${tag} card 1` }).isVisible(), "card now in Closed");

step("move card 2 via the card menu");
const card2 = open.locator("article", { hasText: `${tag} card 2` });
await card2.hover();
await card2.getByRole("button", { name: /^Move / }).click();
await page.getByRole("menuitem", { name: "Move to Cancelled" }).click();
await page.waitForTimeout(2000);
d = (await api(`api/resource/ToDo/${names[1]}`)).data;
check(d?.status === "Cancelled", `status after menu move: ${d?.status}`);

step("+ on a column opens New with the column value");
await closed.getByRole("button", { name: "Add to Closed" }).click();
await page.waitForURL(/ToDo\/new/, { timeout: 30000 });
await page.getByRole("heading", { name: "New ToDo" }).waitFor({ timeout: 60000 });
const status = page.getByRole("combobox", { name: /^Status/ }).first();
check((await status.inputValue()) === "Closed", `status prefilled: ${await status.inputValue()}`);

step("archive + restore a column");
await page.goto(`${BASE}/desk/doctype/ToDo/view/kanban/${encodeURIComponent(BOARD)}`, { waitUntil: "domcontentloaded" });
const cancelled = page.getByRole("region", { name: "Cancelled column" });
await cancelled.waitFor({ timeout: 60000 });
await cancelled.getByRole("button", { name: "Cancelled column menu" }).click();
await page.getByRole("menuitem", { name: /Archive column/ }).click();
await page.waitForTimeout(2000);
check(!(await cancelled.isVisible()), "column archived");
await page.getByRole("button", { name: "Board menu" }).click();
await page.getByRole("menuitem", { name: /Restore “Cancelled”/ }).click();
await page.waitForTimeout(2000);
check(await cancelled.isVisible(), "column restored");

step("cleanup");
await cleanup();
await t.finish();
