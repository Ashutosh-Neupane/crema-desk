// List sidebar group-by counts (Desk base_list.js / list_sidebar_group_by.js): Assigned To / Created By / Tags dropdowns
// with counts from get_group_by_count + get_sidebar_stats, click-to-filter, counts following filters, Customize.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/listsidebar.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;
const post = async (method, data) => (await (await page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data })).json()).message;
const PFX = "LSBTEST";
const TAG = "lsbtesttag";
const filt = [["ToDo", "description", "like", `%${PFX}%`]];
let names = [];
async function cleanup() {
  const rows = (await post("frappe.client.get_list", { doctype: "ToDo", filters: [["description", "like", `%${PFX}%`]], fields: ["name"], limit_page_length: 0 })) ?? [];
  for (const r of rows) await post("frappe.client.delete", { doctype: "ToDo", name: r.name });
  await post("frappe.client.delete", { doctype: "Tag", name: TAG });
  await post("frappe.model.utils.user_settings.save", { doctype: "ToDo", user_settings: JSON.stringify({ group_by_fields: null }) });
}
await cleanup();

step("seed 4 ToDos: 2 assigned to Administrator, 2 tagged, 1 High priority");
for (let i = 0; i < 4; i++) {
  const d = await post("frappe.client.insert", { doc: { doctype: "ToDo", description: `${PFX} item ${i}`, priority: i === 0 ? "High" : "Medium" } });
  names.push(d.name);
}
// the assign_to.add side-effect creates its own ToDo for the reference; only the reference is counted
for (const n of names.slice(0, 2)) await post("frappe.desk.form.assign_to.add", { assign_to: JSON.stringify(["Administrator"]), doctype: "ToDo", name: n, description: "lsb assignment" });
for (const n of names.slice(1, 3)) await post("frappe.desk.doctype.tag.tag.add_tag", { tag: TAG, dt: "ToDo", dn: n });

const apiCounts = async (field, filters = filt) => (await post("frappe.desk.listview.get_group_by_count", { doctype: "ToDo", current_filters: JSON.stringify(filters), field })) ?? [];
const apiAssigned = (await apiCounts("assigned_to")).find((r) => r.name === "Administrator")?.count;
const apiOwner = (await apiCounts("owner")).find((r) => r.name === "Administrator")?.count;
console.log(`  API: assigned_to Administrator=${apiAssigned}, owner Administrator=${apiOwner}`);
check(apiOwner >= 4, "API owner count covers the seeded rows");

const url = `${BASE}/desk/doctype/ToDo?filters=${encodeURIComponent(JSON.stringify(filt))}`;
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
const grp = page.getByRole("group", { name: "List sidebar" });
await grp.waitFor({ timeout: 240000 });
await page.getByText(`${PFX} item 0`).first().waitFor({ timeout: 60000 });
const rowCount = () => page.getByText(new RegExp(`${PFX} item \\d`)).count();
check((await rowCount()) === 4, "list shows the 4 seeded rows");
for (const l of ["Assigned To", "Created By", "Tags"]) check(await grp.getByRole("button", { name: `${l} group by` }).isVisible(), `${l} dropdown present`);
await shot("sidebar_list");

const open = async (l) => {
  await grp.getByRole("button", { name: `${l} group by` }).click();
  return page.getByRole("list", { name: `${l} values` });
};
const itemCount = async (list, label) => {
  const b = list.getByRole("button", { name: new RegExp(`^${label}\\s+\\d+$`) });
  await b.first().waitFor({ timeout: 30000 });
  return Number((await b.first().innerText()).trim().split(/\s+/).pop());
};

step("Assigned To counts match get_group_by_count");
let list = await open("Assigned To");
check((await itemCount(list, "Me")) === apiAssigned, `Assigned To: Me = ${apiAssigned}`);
await shot("sidebar_assigned");
await page.keyboard.press("Escape");

step("Created By counts");
list = await open("Created By");
check((await itemCount(list, "Me")) === apiOwner, `Created By: Me = ${apiOwner}`);
await page.keyboard.press("Escape");

step("Tags counts (get_sidebar_stats)");
list = await open("Tags");
check((await itemCount(list, TAG)) === 2, "Tags: tag count 2");
check((await itemCount(list, "No Tags")) === 2, "Tags: No Tags count 2");
await page.keyboard.press("Escape");

step("click Assigned To -> Me filters the list");
list = await open("Assigned To");
await list.getByRole("button", { name: /^Me/ }).click();
await page.waitForFunction(() => decodeURIComponent(location.search).includes("_assign"), null, { timeout: 30000 });
await page.waitForFunction((n) => document.body.innerText.match(/LSBTEST item \d/g)?.length === n, 2, { timeout: 30000 });
check(decodeURIComponent(page.url()).includes('"_assign","like","%Administrator%"'), "URL has _assign like %Administrator%");
check((await rowCount()) === 2, "2 rows after the Assigned To filter");
const after = await apiCounts("owner", [...filt, ["ToDo", "_assign", "like", "%Administrator%"]]);
step("counts follow the filters (Tags with the assignee filter)");
list = await open("Tags");
const tagN = await itemCount(list, TAG);
const apiTag = (await post("frappe.desk.reportview.get_sidebar_stats", { stats: JSON.stringify(["_user_tags"]), doctype: "ToDo", filters: JSON.stringify([...filt, ["ToDo", "_assign", "like", "%Administrator%"]]) }))?.stats?._user_tags?.find((r) => r[0] === TAG)?.[1];
check(tagN === 1 && tagN === apiTag, `Tags count with filter = ${tagN} (API ${apiTag})`);
await page.keyboard.press("Escape");
check(after.find((r) => r.name === "Administrator")?.count === 2, "API owner count under the filter = 2");
await shot("sidebar_filtered");

step("applied value shows a check; clicking again removes the filter");
list = await open("Assigned To");
check((await list.getByRole("button", { name: /^Me/ }).getAttribute("aria-pressed")) === "true", "Me is marked applied");
await list.getByRole("button", { name: /^Me/ }).click();
await page.waitForFunction(() => !decodeURIComponent(location.search).includes("_assign"), null, { timeout: 30000 });
check((await rowCount()) === 4, "4 rows again");

step("Tags -> tag filters via _user_tags like");
list = await open("Tags");
await list.getByRole("button", { name: new RegExp(`^${TAG}`) }).click();
await page.waitForFunction(() => decodeURIComponent(location.search).includes("_user_tags"), null, { timeout: 30000 });
await page.waitForFunction((n) => document.body.innerText.match(/LSBTEST item \d/g)?.length === n, 2, { timeout: 30000 });
check((await rowCount()) === 2, "2 rows tagged");

step("Created By -> Me gives owner =");
list = await open("Created By");
await list.getByRole("button", { name: /^Me/ }).click();
await page.waitForFunction(() => location.search.includes("owner") || decodeURIComponent(location.search).includes('"owner"'), null, { timeout: 30000 });
check(/owner/.test(decodeURIComponent(page.url())), "URL has the owner filter");

step("Customize: add Priority as a sidebar field (saved in user settings)");
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
await grp.waitFor({ timeout: 60000 });
await grp.getByRole("button", { name: "Customize sidebar filters" }).click();
await page.getByRole("checkbox", { name: "Priority" }).click();
await grp.getByRole("button", { name: "Priority group by" }).waitFor({ timeout: 20000 });
const us = JSON.parse((await post("frappe.model.utils.user_settings.get", { doctype: "ToDo" })) ?? "{}");
check(us.group_by_fields?.includes("priority"), "group_by_fields saved with priority");
await page.keyboard.press("Escape");
list = await open("Priority");
const apiPrio = (await apiCounts("priority")).find((r) => r.name === "High")?.count;
check((await itemCount(list, "High")) === apiPrio, `Priority: High = ${apiPrio}`);
await list.getByRole("button", { name: /^High/ }).click();
await page.waitForFunction(() => /priority/.test(decodeURIComponent(location.search)), null, { timeout: 30000 });
check(/priority=High|"priority","=","High"/.test(decodeURIComponent(page.url())), "priority = High filter in URL");
await shot("sidebar_priority");

await cleanup();
await t.finish();
