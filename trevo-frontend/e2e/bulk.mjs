// List bulk actions: Edit, Assign To, Add Tags, Delete — verified on the backend.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/bulk.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const tag = `BULK${Date.now() % 100000}`;

step("setup: two ToDos");
const names = [];
for (const n of [1, 2]) {
  const r = await post("frappe.client.insert", { doc: { doctype: "ToDo", description: `Trevo ${tag} ${n}`, status: "Open", priority: "Low" } });
  names.push((await r.json()).message.name);
}

const openList = async () => {
  await page.goto(`${BASE}/desk/doctype/ToDo?filters=${encodeURIComponent(JSON.stringify([["description", "like", `%${tag}%`]]))}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByLabel(`Select ${names[0]}`).waitFor({ timeout: 60000 });
  for (const n of names) await page.getByLabel(`Select ${n}`).check();
  await page.getByRole("button", { name: /^Actions \(2\)/ }).click();
};

step("Edit: priority → High");
await openList();
await page.getByRole("menuitem", { name: "Edit" }).click();
const dlg = page.getByRole("dialog");
await dlg.getByLabel("Field").selectOption("priority");
await dlg.getByLabel("Value").selectOption("High");
await dlg.getByRole("button", { name: /^Update 2 records/ }).click();
await page.waitForTimeout(2500);
for (const n of names) {
  const d = (await api(`api/resource/ToDo/${n}`)).data;
  check(d?.priority === "High", `${n} priority ${d?.priority}`);
}

step("Assign To Administrator");
await openList();
await page.getByRole("menuitem", { name: "Assign To" }).click();
const user = page.getByRole("dialog").getByPlaceholder("Add a user");
await user.fill("Administrator");
await page.getByRole("option", { name: /Administrator/ }).first().click();
check(await page.getByRole("dialog").getByText("Administrator", { exact: true }).isVisible(), "user chip added");
await page.getByRole("dialog").getByRole("button", { name: "Assign" }).click();
await page.waitForTimeout(2500);
for (const n of names) {
  const r = await post("frappe.client.get_value", { doctype: "ToDo", filters: { name: n }, fieldname: ["_assign"] });
  const a = (await r.json()).message?._assign;
  check(String(a ?? "").includes("Administrator"), `${n} assigned (${a})`);
}

step("Add Tags");
await openList();
await page.getByRole("menuitem", { name: "Add Tags" }).click();
await page.getByRole("dialog").getByRole("textbox", { name: "Tags" }).fill(`trevo-${tag.toLowerCase()}`);
await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
await page.waitForTimeout(2500);
for (const n of names) {
  const d = (await api(`api/resource/ToDo/${n}`)).data;
  check(String(d?._user_tags ?? "").includes(`trevo-${tag.toLowerCase()}`), `${n} tagged (${d?._user_tags})`);
}
await shot("bulk_tags", false);

step("Delete");
await openList();
await page.getByRole("menuitem", { name: "Delete" }).click();
await page.getByRole("button", { name: "Yes" }).click();
await page.waitForTimeout(2500);
for (const n of names) {
  const r = await page.request.get(`${BASE}/api/frappe/api/resource/ToDo/${n}`);
  check(r.status() === 404, `${n} deleted (${r.status()})`);
}

step("cleanup: assignment ToDos + tag");
const todos = await api(`api/resource/ToDo?filters=${encodeURIComponent(JSON.stringify([["reference_type", "=", "ToDo"], ["reference_name", "in", names]]))}`).catch(() => null);
for (const d of todos?.data ?? []) await post("frappe.client.delete", { doctype: "ToDo", name: d.name });
await post("frappe.client.delete", { doctype: "Tag", name: `trevo-${tag.toLowerCase()}` });
await t.finish();
