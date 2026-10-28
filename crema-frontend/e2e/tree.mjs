// Tree view (Account via ERPNext tree settings, Item Group via defaults):
// default routing, expand lazily, add child prefilled with parent.
//   BASE=http://localhost:3001 OUT=/tmp/shots node e2e/tree.mjs
import { start, BASE } from "./lib.mjs";

const t = await start();
const { page, check, step, shot } = t;

step("Account list route opens the Chart of Accounts tree");
await page.goto(`${BASE}/desk/doctype/Account`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForURL(/\/view\/tree/, { timeout: 60000 });
await page.getByRole("heading", { name: "Chart of Accounts" }).waitFor({ timeout: 60000 });
check(true, "redirected to tree with ERPNext title");

step("expand Application of Funds (Assets)");
await page.getByRole("button", { name: /Expand Application of Funds/ }).click();
await page.waitForTimeout(2500);
const kids = await page.locator("ul[aria-label='Account tree'] ul ul > li").count();
check(kids > 0, `children loaded (${kids})`);
await shot("tree_expanded", false);

step("List tab still reachable");
await page.getByRole("link", { name: "List", exact: true }).click();
await page.waitForURL(/view=list/, { timeout: 30000 });
await page.locator("tbody tr").first().waitFor({ timeout: 60000 });
check((await page.locator("tbody tr").count()) > 0, "Account list shows rows");

step("Item Group: add child prefilled with parent");
await page.goto(`${BASE}/desk/doctype/Item%20Group/view/tree`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByText("All Item Groups").first().waitFor({ timeout: 60000 });
// header "Add" creates under the root group (All Item Groups)
await page.getByRole("button", { name: /^Add Item Group$/ }).click();
await page.getByRole("heading", { name: "New Item Group" }).waitFor({ timeout: 120000 });
const parent = await page.getByRole("combobox", { name: /^Parent Item Group/ }).inputValue();
check(!!parent, `Parent Item Group prefilled (${parent})`);

await t.finish();
