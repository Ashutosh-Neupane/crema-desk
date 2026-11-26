// Report view Group By like Desk (ui/group_by/group_by.js, views/reports/report_view.js) on Sales Order:
// count / sum / average checked against the API; a child-table field grouped with a child-table sum; the
// parent-to-child rule; settings saved in Desk's format ("`tabX`.`field`"); ?_group_by= share links; older
// plain settings; drill-down into a group; Remove.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/reportgroupby.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot, api } = t;
const post = (method, data) => page.request.post(`${BASE}/api/frappe/api/method/${method}`, { data });
const DT = "Sales Order";
const saveReport = (Report) => post("frappe.model.utils.user_settings.save", { doctype: DT, user_settings: JSON.stringify({ Report }) });
const userReport = async () => JSON.parse((await (await post("frappe.model.utils.user_settings.get", { doctype: DT })).json()).message || "{}").Report ?? {};
const grid = page.getByRole("table", { name: "Sales Order report" });
const groupBtn = () => page.getByRole("button", { name: /^(Add Group|Grouped by)/ });
const open = async (q = "") => {
  await page.goto(`${BASE}/desk/sales-order/view/report${q}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await grid.locator("tbody tr").first().waitFor({ timeout: 90000 });
};
// rows of the grouped grid → [value, aggregate] (the first column is the row number)
const groups = async () => {
  const rows = await grid.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.trim())));
  return rows.filter((r) => r.length >= 3).map((r) => [r[1], r[2]]);
};
// the grid keeps the old rows while the next query loads: act, then wait for the grouped response to render
const grouped = async (action) => {
  const res = page.waitForResponse((r) => r.url().includes("frappe.desk.reportview.get") && (r.request().postData() ?? "").includes("aggregate_function"), { timeout: 30000 });
  await action();
  await res;
  await page.waitForTimeout(600);
};
const num = (s) => Number(String(s).replace(/[^0-9.-]/g, ""));
const waitHeader = (name) => grid.getByRole("columnheader", { name }).waitFor({ timeout: 20000 });

// what the server holds, for the expected numbers (Report view has no docstatus filter: all orders)
const orders = (await api(`api/resource/Sales Order?fields=${encodeURIComponent('["customer","grand_total"]')}&limit_page_length=0`)).data;
// every order item, ungrouped (summed here, so the server's GROUP BY is checked against plain rows)
const itemRows = (await (await post("frappe.desk.reportview.get", { doctype: DT, fields: JSON.stringify(["`tabSales Order Item`.`item_code`", "`tabSales Order Item`.`qty`"]), filters: "[]", page_length: 100000, view: "Report", with_comment_count: 0 })).json()).message;
const items = itemRows.values.map(([item_code, qty]) => ({ item_code, qty })).filter((i) => i.item_code != null);
check(items.length > 0 && items.every((i) => i.item_code), `${items.length} order items from the API`);
const tally = (rows, k, v) => rows.reduce((m, r) => ((m[r[k] ?? ""] = (m[r[k] ?? ""] ?? 0) + (v ? Number(r[v]) : 1)), m), {});
const byCustomerCount = tally(orders, "customer");
const byCustomerSum = tally(orders, "customer", "grand_total");
const byItemQty = tally(items, "item_code", "qty");
const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])[0];

await saveReport({});
await open();

step("Add Group: Customer, Count (applied as soon as it is complete)");
check((await groupBtn().innerText()).includes("Add Group"), "button says Add Group");
await groupBtn().click();
await grouped(() => page.getByLabel("Group by field").selectOption("Sales Order::customer"));
await waitHeader("Count");
let g = await groups();
check(g.length === Math.min(Object.keys(byCustomerCount).length, 20), `one row per customer, first page (${g.length})`);
check(g[0][0] === top(byCustomerCount)[0] && num(g[0][1]) === top(byCustomerCount)[1], `largest first: ${g[0].join(" = ")}`);
check(g.every(([c, n]) => byCustomerCount[c] === num(n)), "every count matches the API");
check((await groupBtn().innerText()).replace(/\s+/g, " ").includes("Grouped by Customer"), "button says Grouped by Customer");

step("Sum of Grand Total");
await page.getByLabel("Aggregate function").selectOption("sum");
check((await page.getByLabel("Aggregate on").inputValue()) === "", "sum waits for a field (Select Field...)");
await grouped(() => page.getByLabel("Aggregate on").selectOption("Sales Order::grand_total"));
await waitHeader("Sum of Grand Total");
g = await groups();
check(g.every(([c, v]) => Math.abs(byCustomerSum[c] - num(v)) < 0.01), `sums match the API (${g[0].join(" = ")})`);

step("saved in Desk's format; ?_group_by= in the URL");
await page.waitForTimeout(1500);
const us = await userReport();
check(us.group_by?.group_by === "`tabSales Order`.`customer`" && us.group_by?.aggregate_on === "`tabSales Order`.`grand_total`" && us.group_by?.aggregate_function === "sum", `user settings ${JSON.stringify(us.group_by)}`);
const shared = new URL(page.url()).searchParams.get("_group_by");
check(JSON.stringify(JSON.parse(shared ?? "null")) === JSON.stringify(["`tabSales Order`.`customer`", "`tabSales Order`.`grand_total`", "sum"]), `_group_by ${shared}`);
await page.keyboard.press("Escape");

step("child table: Item Code (Sales Order Item), Sum of Quantity (Sales Order Item)");
await groupBtn().click();
await page.getByLabel("Group by field").selectOption("Sales Order Item::item_code");
await grouped(() => page.getByLabel("Aggregate on").selectOption("Sales Order Item::qty"));
await waitHeader("Sum of Quantity");
g = await groups();
// grouped results are paged like the rows (Desk base_list.js page_length, 20 by default): the first page is shown
check(g.length === Math.min(Object.keys(byItemQty).length, 20) && g.every(([i, q]) => Math.abs(byItemQty[i] - num(q)) < 0.001), `item quantities match the API (${g[0].join(" = ")})`);
await shot("reportgroupby_child", false);

step("parent field over a child's numbers is refused (Desk's rule)");
await page.getByLabel("Group by field").selectOption("Sales Order::customer");
check(await page.getByRole("alert").filter({ hasText: "Parent-to-child or child-to-different-child grouping is not allowed." }).isVisible(), "error shown");
check(await grid.getByRole("columnheader", { name: "Item Code" }).isVisible(), "previous grouping kept");

step("Average of Grand Total by Customer");
await page.getByLabel("Aggregate on").selectOption("Sales Order::grand_total");
await grouped(() => page.getByLabel("Aggregate function").selectOption("avg"));
await waitHeader("Average of Grand Total");
g = await groups();
check(g.every(([c, v]) => Math.abs(byCustomerSum[c] / byCustomerCount[c] - num(v)) < 0.01), "averages match the API");
await page.keyboard.press("Escape");

step("a shared link opens grouped; reload keeps it");
await saveReport({});
await grouped(() => open(`?_group_by=${encodeURIComponent(JSON.stringify(["`tabSales Order`.`customer`", null, "count"]))}`));
await waitHeader("Count");
check((await groups()).length === Math.min(Object.keys(byCustomerCount).length, 20), "grouped by customer from the link");
await page.waitForTimeout(1500);
await page.reload({ waitUntil: "domcontentloaded" });
await waitHeader("Count");
check(true, "still grouped after reload");

step("older plain settings ({ group_by: 'status' }) still load");
await saveReport({ group_by: { group_by: "status", aggregate_function: "count" } });
await grouped(() => open());
await waitHeader("Count");
check((await groupBtn().innerText()).replace(/\s+/g, " ").includes("Grouped by Status"), "Grouped by Status");

step("drill down: a group's value → its rows, ungrouped");
const [status, n] = (await groups())[0];
await grid.getByRole("button", { name: status, exact: true }).click();
await page.waitForFunction(() => !document.querySelector("th")?.textContent?.includes("Count") && document.querySelectorAll("table tbody tr").length > 0, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
check((await grid.getByRole("columnheader", { name: "Count" }).count()) === 0, "ungrouped");
check((await grid.locator("tbody tr").count()) === Math.min(num(n), 20), `${Math.min(num(n), 20)} rows with status ${status}`);
check(!new URL(page.url()).searchParams.get("_group_by"), "_group_by removed from the URL");

step("Remove");
await groupBtn().click();
await page.getByLabel("Group by field").selectOption("Sales Order::customer");
await waitHeader("Count");
await page.getByRole("button", { name: "Remove", exact: true }).click();
await page.waitForTimeout(1500);
check((await groupBtn().innerText()).includes("Add Group") && (await grid.getByRole("columnheader", { name: "Count" }).count()) === 0, "back to rows");

step("cleanup");
await saveReport({});
await t.finish();
